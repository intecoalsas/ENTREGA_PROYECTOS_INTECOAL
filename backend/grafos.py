import os
import html
from pathlib import Path
import httpx


def esc(valor):
    return html.escape(str(valor or ""), quote=True)


class GraphService:
    def __init__(self):
        self.tenant_id = os.getenv("AZURE_TENANT_ID", "")
        self.client_id = os.getenv("AZURE_CLIENT_ID", "")
        self.client_secret = os.getenv("AZURE_CLIENT_SECRET", "")
        self.site_id = os.getenv("SHAREPOINT_SITE_ID", "")
        self.list_id = os.getenv("SHAREPOINT_LIST_ID", "")
        self.library_name = os.getenv("SHAREPOINT_LIBRARY_ID", "Documents")
        self.sender_email = os.getenv("M365_SENDER_EMAIL", "coord.tecnico@intecoalsas.com")
        self.notification_recipient = os.getenv("M365_NOTIFICATION_RECIPIENT", "")
        self._token = None
        self._token_expiry = 0
        self._resolved_drive_id = None

    def _sanitizar_codigo(self, codigo):
        return "".join(c for c in codigo if c.isalnum())

    async def _obtener_token(self):
        import time
        ahora = time.time()
        if self._token and ahora < self._token_expiry:
            return self._token

        if not self.client_id or not self.client_secret or not self.tenant_id:
            raise Exception("Faltan credenciales Azure AD (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)")

        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": "https://graph.microsoft.com/.default",
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=30.0)) as cliente:
            resp = await cliente.post(url, data=data)
            resp.raise_for_status()
            resultado = resp.json()

        self._token = resultado["access_token"]
        self._token_expiry = ahora + resultado.get("expires_in", 3600) - 120
        return self._token

    async def _headers(self):
        token = await self._obtener_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def _obtener_drive_id(self):
        if self._resolved_drive_id:
            return self._resolved_drive_id

        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}"}

        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/drives"
        async with httpx.AsyncClient() as cliente:
            resp = await cliente.get(url, headers=headers)
            resp.raise_for_status()
            drives = resp.json().get("value", [])

        for drive in drives:
            name = drive.get("name", "")
            if name.lower() == self.library_name.lower():
                self._resolved_drive_id = drive["id"]
                print(f"[GRAPH] Drive '{name}' resuelto: {self._resolved_drive_id}")
                return self._resolved_drive_id

        if drives:
            self._resolved_drive_id = drives[0]["id"]
            print(f"[GRAPH] Drive '{self.library_name}' no encontrado, usando '{drives[0].get('name', '?')}' ({self._resolved_drive_id})")
        else:
            raise Exception(f"No se encontraron drives en el sitio {self.site_id}")

        return self._resolved_drive_id

    async def _drive_url(self):
        drive_id = await self._obtener_drive_id()
        return f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/drives/{drive_id}"

    RAIZ = "Documentos_Radicacion"

    SUBCARPETAS = [
        "A_Tecnicos", "B_Certificaciones", "C_Contractuales",
        "D_Inventario", "E_Otros", "F_Documentos_Adicionales",
    ]

    CEAP_SUBCARPETA = "Documentos para circuitos exclusivos de AP"

    OTROS_IDS = {22, 23, 24}
    OTROS_CODES = {"CAUE", "CANT", "CVP"}

    def _sanitizar_nombre(self, nombre):
        if not nombre:
            return "documento"
        limpio = "".join(c if c not in '/\\?%*:|" <>' else "_" for c in str(nombre)).strip()
        while "__" in limpio:
            limpio = limpio.replace("__", "_")
        return limpio.strip("_") or "documento"

    def _nombre_ordenado(self, archivo):
        original = archivo.get("fileName") or archivo.get("docName") or "documento.pdf"
        code = archivo.get("docCode") or str(archivo.get("docId", "X"))
        try:
            orden = int(archivo.get("docId", 0))
        except Exception:
            orden = 0
        base = self._sanitizar_nombre(original)
        if not base.upper().startswith(str(code).upper()):
            base = f"{code}_{base}"
        return f"{orden:02d}_{base}"

    def _es_ceap(self, archivo):
        try:
            doc_id = int(archivo.get("docId", 0))
        except (TypeError, ValueError):
            doc_id = 0
        code = str(archivo.get("docCode", "")).upper()
        return doc_id == 25 or code == "CEAP"

    def _carpeta_destino(self, archivo):
        try:
            doc_id = int(archivo.get("docId", 0))
        except (TypeError, ValueError):
            doc_id = 0
        code = str(archivo.get("docCode", "")).upper()
        if self._es_ceap(archivo) or doc_id in self.OTROS_IDS or code in self.OTROS_CODES:
            return "E_Otros"
        if doc_id == 21 or code == "D21":
            return "D_Inventario"
        if archivo.get("esManual"):
            return "F_Documentos_Adicionales"
        folder_path = archivo.get("folderPath") or ""
        if "Documentos_Adicionales" in folder_path:
            return "F_Documentos_Adicionales"
        partes = [p for p in folder_path.split("/") if p]
        if partes:
            candidato = partes[-1]
            if candidato in self.SUBCARPETAS:
                return candidato
            if candidato == "E_SST_Ambiental":
                return "E_Otros"  
        if code.startswith("A"):
            return "A_Tecnicos"
        if code.startswith("B"):
            return "B_Certificaciones"
        if code.startswith("C"):
            return "C_Contractuales"
        if code.startswith("D"):
            return "D_Inventario"
        if code.startswith("E"):
            return "E_Otros"
        return "F_Documentos_Adicionales"

    async def sincronizar_a_sharepoint(self, radicacion):
        return await self.guardar_radicacion_en_sharepoint(radicacion)

    @staticmethod
    def _filtro_seguro(valor):
        return str(valor or "").replace("'", "''")

    async def _asegurar_carpeta(self, cliente, headers, base, parent_rel, nombre):
        rel = f"{parent_rel}/{nombre}" if parent_rel else nombre
        url_get = f"{base}/root:/{rel}"
        try:
            resp = await cliente.get(url_get, headers=headers)
            if resp.status_code == 200:
                return True
        except Exception:
            pass
        if parent_rel:
            url_create = f"{base}/root:/{parent_rel}:/children"
        else:
            url_create = f"{base}/root/children"
        try:
            resp = await cliente.post(
                url_create,
                headers=headers,
                json={"name": nombre, "folder": {}, "@microsoft.graph.conflictBehavior": "fail"},
            )
            if resp.status_code in (200, 201):
                print(f"[GRAPH] Carpeta creada: {rel}")
                return True
            if resp.status_code == 409:
                return True
            print(f"[GRAPH] Error creando carpeta {rel}: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            print(f"[GRAPH] Excepcion creando carpeta {rel}: {e}")
        return False

    async def _crear_carpeta_proyecto(self, codigo):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        base = await self._drive_url()

        async with httpx.AsyncClient(timeout=30.0) as cliente:
            await self._asegurar_carpeta(cliente, headers, base, "", self.RAIZ)
            await self._asegurar_carpeta(cliente, headers, base, self.RAIZ, codigo)
            padre = f"{self.RAIZ}/{codigo}"
            for sub in self.SUBCARPETAS:
                await self._asegurar_carpeta(cliente, headers, base, padre, sub)
            await self._asegurar_carpeta(
                cliente, headers, base,
                f"{padre}/E_Otros", self.CEAP_SUBCARPETA,
            )

    async def _subir_contenido(self, cliente, headers_auth, base, rel_path, contenido):
        LIMITE_SIMPLE = 4 * 1024 * 1024
        if len(contenido) <= LIMITE_SIMPLE:
            url = f"{base}/root:/{rel_path}:/content"
            resp = await cliente.put(url, headers=headers_auth, content=contenido)
            if resp.status_code in (200, 201):
                print(f"[GRAPH] Archivo subido a SharePoint: {rel_path}")
                return True
            print(f"[GRAPH] Error subiendo {rel_path}: {resp.status_code} {resp.text[:200]}")
            return False
        url_sesion = f"{base}/root:/{rel_path}:/createUploadSession"
        resp = await cliente.post(url_sesion, headers={**headers_auth, "Content-Type": "application/json"}, json={})
        if resp.status_code != 200:
            print(f"[GRAPH] Error creando sesión de subida {rel_path}: {resp.status_code} {resp.text[:200]}")
            return False
        upload_url = resp.json().get("uploadUrl", "")
        if not upload_url:
            print(f"[GRAPH] Sesión sin uploadUrl para {rel_path}")
            return False
        total = len(contenido)
        parte = 5 * 1024 * 1024
        try:
            async with httpx.AsyncClient(timeout=120.0) as up:
                for inicio in range(0, total, parte):
                    fin = min(inicio + parte, total) - 1
                    trozo = contenido[inicio:fin + 1]
                    r = await up.put(
                        upload_url,
                        headers={"Content-Length": str(len(trozo)), "Content-Range": f"bytes {inicio}-{fin}/{total}"},
                        content=trozo,
                    )
                    if r.status_code not in (200, 201, 202):
                        print(f"[GRAPH] Error fragmento {inicio}-{fin} {rel_path}: {r.status_code} {r.text[:200]}")
                        return False
            print(f"[GRAPH] Archivo grande subido a SharePoint: {rel_path} ({total} bytes)")
            return True
        except Exception as e:
            print(f"[GRAPH] Excepcion subiendo archivo grande {rel_path}: {e}")
            return False

    async def _subir_archivos(self, radicacion, codigo):
        token = await self._obtener_token()
        headers_auth = {"Authorization": f"Bearer {token}"}
        base = await self._drive_url()

        subidos = 0
        omitidos = 0
        async with httpx.AsyncClient(timeout=120.0) as cliente:
            for a in radicacion.get("archivos", []):
                local_path = (a.get("localPath") or "").strip()
                file_name = (a.get("fileName") or "").strip()
                if a.get("status") == "N/A":
                    continue
                if not local_path and not file_name:
                    omitidos += 1
                    continue
                if not local_path:
                    print(f"[GRAPH] Sin localPath (solo metadato), se omite: {a.get('docCode')}")
                    omitidos += 1
                    continue
                file_path = Path(local_path)
                if not file_path.exists():
                    print(f"[GRAPH] Archivo local no encontrado: {local_path}")
                    omitidos += 1
                    continue
                try:
                    contenido = file_path.read_bytes()
                except Exception as e:
                    print(f"[GRAPH] No se pudo leer {local_path}: {e}")
                    omitidos += 1
                    continue
                subcarpeta = self._carpeta_destino(a)
                destino = self._nombre_ordenado(a)
                if self._es_ceap(a):
                    rel = f"{self.RAIZ}/{codigo}/{subcarpeta}/{self.CEAP_SUBCARPETA}/{destino}"
                else:
                    rel = f"{self.RAIZ}/{codigo}/{subcarpeta}/{destino}"
                try:
                    ok = await self._subir_contenido(cliente, headers_auth, base, rel, contenido)
                    subidos += 1 if ok else 0
                    omitidos += 0 if ok else 1
                except Exception as e:
                    print(f"[GRAPH] Excepcion subiendo {rel}: {e}")
                    omitidos += 1

                for sf in a.get("subFiles", []) or []:
                    sf_local = (sf.get("localPath") or "").strip()
                    if not sf_local:
                        continue
                    sf_path = Path(sf_local)
                    if not sf_path.exists():
                        print(f"[GRAPH] Sub-archivo local no encontrado: {sf_local}")
                        continue
                    try:
                        sf_cont = sf_path.read_bytes()
                    except Exception as e:
                        print(f"[GRAPH] No se pudo leer sub-archivo {sf_local}: {e}")
                        continue
                    sf_nombre = self._sanitizar_nombre(
                        sf.get("subName") or sf.get("fileName") or "anexo"
                    )
                    sf_code = sf.get("subCode") or "ANEXO"
                    sf_base = f"{self._sanitizar_nombre(a.get('docCode', 'DOC'))}_{self._sanitizar_nombre(sf_code)}_{sf_nombre}"
                    if self._es_ceap(a):
                        rel_sf = f"{self.RAIZ}/{codigo}/{subcarpeta}/{self.CEAP_SUBCARPETA}/{sf_base}"
                    else:
                        rel_sf = f"{self.RAIZ}/{codigo}/{subcarpeta}/{sf_base}"
                    try:
                        if await self._subir_contenido(cliente, headers_auth, base, rel_sf, sf_cont):
                            subidos += 1
                    except Exception as e:
                        print(f"[GRAPH] Excepcion subiendo {rel_sf}: {e}")


        print(f"[GRAPH] Subida {codigo}: {subidos} archivos OK, {omitidos} omitidos")
        return {"subidos": subidos, "omitidos": omitidos}

    def _nombre_seguro_raiz(self, nombre):
        seguro = "".join(c for c in str(nombre or "") if c not in '/\\?%*:|"<>').strip() or "formato.pdf"
        if not seguro.lower().endswith(".pdf"):
            seguro += ".pdf"
        return seguro

    async def subir_formato_a_sharepoint(self, numero, formato):
        token = await self._obtener_token()
        headers_auth = {"Authorization": f"Bearer {token}"}
        headers_json = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        base = await self._drive_url()

        local = (formato.get("localPath") or "").strip()
        if not local:
            raise Exception("El formato no tiene archivo local para subir")
        ruta = Path(local)
        if not ruta.exists():
            raise Exception(f"Archivo local del formato no encontrado: {local}")
        contenido = ruta.read_bytes()

        async with httpx.AsyncClient(timeout=120.0) as cliente:
            await self._asegurar_carpeta(cliente, headers_json, base, "", self.RAIZ)
            await self._asegurar_carpeta(cliente, headers_json, base, self.RAIZ, numero)
            rel = f"{self.RAIZ}/{numero}/{self._nombre_seguro_raiz(formato.get('nombre') or formato.get('fileName'))}"
            ok = await self._subir_contenido(cliente, headers_auth, base, rel, contenido)
            if not ok:
                raise Exception(f"No se pudo subir el formato a {rel}")
        return {"ok": True, "ruta": rel}

    ASSETS_CORREOS = Path(__file__).resolve().parent / "assets" / "correos"

    def _normalizar_municipio(self, municipio):
        import unicodedata
        m = (municipio or "").lower().strip()
        return "".join(c for c in unicodedata.normalize("NFD", m) if unicodedata.category(c) != "Mn")

    def _logo_por_municipio(self, municipio):
        m = self._normalizar_municipio(municipio)
        if "tulua" in m:
            nombre = "logo-tulua.jpg"
        elif "andalucia" in m:
            nombre = "logo-andalucia.jpg"
        elif "san pedro" in m:
            nombre = "logo-sanpedro.jpg"
        elif "calima" in m:
            nombre = "logo-calima.jpg"
        elif "villavicencio" in m:
            nombre = "logo-villavicencio.png"
        else:
            nombre = "logo-general.png"
        ruta = self.ASSETS_CORREOS / nombre
        if not ruta.exists():
            ruta = self.ASSETS_CORREOS / "logo-general.png"
        cid = ruta.stem.replace("-", "_")
        tipo = "image/png" if ruta.suffix.lower() == ".png" else "image/jpeg"
        return cid, str(ruta), tipo

    def _pie_logo_html(self, municipio):
        cid, _, _ = self._logo_por_municipio(municipio)
        return f'<img src="cid:{cid}" alt="INTECOAL SAS" style="max-width:520px;width:100%;height:auto;margin:12px 0 4px 0;" />'

    def _adjunto_logo(self, municipio):
        import base64
        cid, ruta, tipo = self._logo_por_municipio(municipio)
        try:
            data = Path(ruta).read_bytes()
        except Exception as e:
            print(f"[GRAPH] No se pudo leer logo {ruta}: {e}")
            return None
        return {
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": Path(ruta).name,
            "contentType": tipo,
            "contentId": cid,
            "contentBytes": base64.b64encode(data).decode(),
            "isInline": True,
        }

    def _plantilla_correo(self, titulo, cuerpo_interno, municipio):
        return f"""<html><body style="font-family:Arial,sans-serif;color:#1E222A;">
<h2 style="margin:0 0 12px 0;font-size:17px;color:#1E222A;">{titulo}</h2>
{cuerpo_interno}
{self._pie_logo_html(municipio)}
<p style="font-size:11px;color:#999;">INTECOAL SAS — Interventoría Técnica</p>
</body></html>"""

    def _remitente_municipio(self, municipio):
        return self._correo_municipio(municipio) or self.sender_email

    def _copia_municipio(self, municipio, destino):
        correo = self._correo_municipio(municipio)
        if correo and destino and correo.lower() == destino.lower():
            return []
        return [correo] if correo else []

    async def _enviar_correo(self, destino, asunto, cuerpo, adjuntos=None, para_extra=None, remitente=None):
        if not destino:
            return False
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        remitente = remitente or self.sender_email
        destinatarios = [{"emailAddress": {"address": destino}}]
        for extra in para_extra or []:
            if extra and extra.lower() != destino.lower():
                destinatarios.append({"emailAddress": {"address": extra}})
        mensaje = {
            "message": {
                "subject": asunto,
                "body": {"contentType": "HTML", "content": cuerpo},
                "from": {"emailAddress": {"address": remitente}},
                "toRecipients": destinatarios,
            }
        }
        if adjuntos:
            mensaje["message"]["attachments"] = adjuntos
        url = f"https://graph.microsoft.com/v1.0/users/{remitente}/sendMail"
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=30.0)) as cliente:
            try:
                resp = await cliente.post(url, headers=headers, json=mensaje)
                print(f"[GRAPH] Correo de {remitente} a {destino} | status={resp.status_code}")
                if resp.status_code not in (200, 202):
                    print(f"[GRAPH] Detalle: {resp.text[:300]}")
                return resp.status_code in (200, 202)
            except Exception as e:
                print(f"[GRAPH] Error enviando correo a {destino}: {e}")
                return False

    def _revisor_email(self):
        return self.notification_recipient

    def _correo_municipio(self, municipio):
        m = self._normalizar_municipio(municipio)
        if "tulua" in m:
            return "tulua@intecoalsas.com"
        if "andalucia" in m:
            return "andalucia@intecoalsas.com"
        if "san pedro" in m:
            return "sanpedro@intecoalsas.com"
        if "calima" in m:
            return "calima@intecoalsas.com"
        if "villavicencio" in m:
            return "villavicencio@intecoalsas.com"
        return None

    def _contratista_email(self, radicacion):
        meta = radicacion.get("metadata", {})
        return (
            radicacion.get("creadorEmail", "")
            or meta.get("creadorEmail", "")
            or meta.get("correoResponsable", "")
        )

    async def enviar_correo_nuevo_radicado_revisor(self, radicacion):
        destino = self._revisor_email()
        if not destino:
            return
        meta = radicacion["metadata"]
        municipio = meta.get("municipio", "")
        asunto = f"Nuevo Radicado por Revisar — {esc(radicacion['numeroRadicado'])}"
        interno = f"""
            <p>Se ha registrado un nuevo radicado y requiere su revisión:</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Radicado:</td><td>{esc(radicacion['numeroRadicado'])}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Proyecto:</td><td>{esc(meta.get('nombreProyecto', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Municipio:</td><td>{esc(meta.get('municipio', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Contratista:</td><td>{esc(meta.get('contratista', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Responsable:</td><td>{esc(meta.get('responsable', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Tipo Entrega:</td><td>{esc(meta.get('tipoEntrega', ''))}</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Acceda al portal para revisar y evaluar la documentación.</p>
        """
        cuerpo = self._plantilla_correo("INTECOAL SAS — Nuevo Radicado para Revisar", interno, municipio)
        adj = self._adjunto_logo(municipio)
        await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None,
                                  self._copia_municipio(municipio, destino))

    async def enviar_correo_nuevo_radicado_contratista(self, radicacion):
        destino = self._contratista_email(radicacion)
        if not destino:
            return
        meta = radicacion["metadata"]
        municipio = meta.get("municipio", "")
        asunto = f"Radicado Registrado — {esc(radicacion['numeroRadicado'])}"
        interno = f"""
            <p>Su radicado fue creado correctamente y quedó en <strong>revisión por la Interventoría Técnica</strong>.</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Radicado:</td><td>{esc(radicacion['numeroRadicado'])}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Proyecto:</td><td>{esc(meta.get('nombreProyecto', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Municipio:</td><td>{esc(meta.get('municipio', ''))}</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Le notificaremos el resultado una vez sea evaluado.</p>
        """
        cuerpo = self._plantilla_correo("INTECOAL SAS — Radicado Registrado", interno, municipio)
        adj = self._adjunto_logo(municipio)
        await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None,
                                  self._copia_municipio(municipio, destino),
                                  self._remitente_municipio(municipio))

    async def enviar_correo_estado(self, radicacion, estado_anterior, observaciones):
        meta = radicacion["metadata"]
        destino = self._contratista_email(radicacion)
        if not destino:
            return

        estado_final = radicacion.get("estado", "")
        municipio = meta.get("municipio", "")

        asunto = f"Radicado {esc(radicacion['numeroRadicado'])} — {estado_final}"
        interno = f"""
            <p>Su radicado fue evaluado por la Interventoría Técnica:</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Radicado:</td><td>{esc(radicacion['numeroRadicado'])}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Proyecto:</td><td>{esc(meta.get('nombreProyecto', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Estado:</td><td><strong style="font-size:14px;">{esc(estado_final)}</strong></td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Acceda al portal para revisar los detalles completos.</p>
        """
        cuerpo = self._plantilla_correo("INTECOAL SAS — Resultado de Evaluación", interno, municipio)
        adj = self._adjunto_logo(municipio)
        await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None,
                                  self._copia_municipio(municipio, destino),
                                  self._remitente_municipio(municipio))

    async def enviar_correo_reesubido_revisor(self, radicacion):
        destino = self._revisor_email()
        if not destino:
            return
        meta = radicacion["metadata"]
        municipio = meta.get("municipio", "")
        asunto = f"Radicado para Revisar — {esc(radicacion['numeroRadicado'])}"
        interno = f"""
            <p>El contratista <strong>{esc(meta.get('contratista', ''))}</strong> envió o actualizó un radicado que requiere su revisión. Tiene uno (1) radicado pendiente por evaluar:</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Radicado:</td><td>{esc(radicacion['numeroRadicado'])}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Proyecto:</td><td>{esc(meta.get('nombreProyecto', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Estado:</td><td>En Revisión</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Acceda al portal para evaluar la documentación del radicado.</p>
        """
        cuerpo = self._plantilla_correo("INTECOAL SAS — Radicado pendiente de Revisión", interno, municipio)
        adj = self._adjunto_logo(municipio)
        await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None,
                                  self._copia_municipio(municipio, destino))

    async def enviar_correo_reenvio_contratista(self, radicacion):
        meta = radicacion["metadata"]
        municipio = meta.get("municipio", "")
        destino = self._contratista_email(radicacion)
        if not destino:
            return
        asunto = f"Radicado Actualizado — {esc(radicacion['numeroRadicado'])}"
        interno = f"""
            <p>Confirmamos que su radicado fue <strong>actualizado y subido correctamente</strong>. Ahora quedó en <strong>revisión por la Interventoría Técnica</strong>.</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse;margin:12px 0;">
                <tr><td style="padding:6px 0;font-weight:bold;width:140px;">Radicado:</td><td>{esc(radicacion['numeroRadicado'])}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Proyecto:</td><td>{esc(meta.get('nombreProyecto', ''))}</td></tr>
                <tr><td style="padding:6px 0;font-weight:bold;">Municipio:</td><td>{esc(meta.get('municipio', ''))}</td></tr>
            </table>
            <p style="font-size:12px;color:#666;">Le notificaremos el resultado una vez sea evaluado por la Interventoría.</p>
        """
        cuerpo = self._plantilla_correo("INTECOAL SAS — Radicado Actualizado", interno, municipio)
        adj = self._adjunto_logo(municipio)
        await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None,
                                  self._copia_municipio(municipio, destino),
                                  self._remitente_municipio(municipio))

    @staticmethod
    def _dias_txt(cantidad):
        n = abs(int(cantidad or 0))
        return f"{n} día" if n == 1 else f"{n} días"

    async def enviar_correo_vencimiento_resumen(self, pend_8, pend_4, vencidos):
        destino = self._revisor_email()
        if not destino:
            print("[GRAPH] Sin destinatario revisor (M365_NOTIFICATION_RECIPIENT), no se envía resumen de vencimientos")
            return False

        def _cnt(n):
            return f"{n} radicado" if n == 1 else f"{n} radicados"

        def _situacion(dias):
            if dias < 0:
                return f"Vencido hace {self._dias_txt(dias)}"
            if dias == 0:
                return "Vence hoy"
            return f"Faltan {self._dias_txt(dias)}"

        def _tabla(items):
            filas = "".join(
                "<tr>"
                f"<td style='padding:5px 8px 5px 0;'><strong>{esc(it['radicacion'].get('numeroRadicado', '?'))}</strong></td>"
                f"<td style='padding:5px 8px 5px 0;'>{esc(it['radicacion'].get('metadata', {}).get('nombreProyecto', ''))}</td>"
                f"<td style='padding:5px 8px 5px 0;'>{esc(it['radicacion'].get('metadata', {}).get('municipio', ''))}</td>"
                f"<td style='padding:5px 8px 5px 0;'>{esc(it['radicacion'].get('metadata', {}).get('contratista', ''))}</td>"
                f"<td style='padding:5px 8px 5px 0;'>{esc(it['radicacion'].get('estado', ''))}</td>"
                f"<td style='padding:5px 8px 5px 0;'>{esc(str(it.get('limite', '')))}</td>"
                f"<td style='padding:5px 0;'>{esc(_situacion(it['dias']))}</td>"
                "</tr>"
                for it in items
            )
            return (
                "<table style='width:100%;font-size:13px;border-collapse:collapse;margin:4px 0 14px 0;'>"
                "<tr style='background:#f1f3f5;'>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Radicado</th>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Proyecto</th>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Municipio</th>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Contratista</th>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Estado</th>"
                "<th style='padding:6px 8px 6px 0;text-align:left;'>Límite</th>"
                "<th style='padding:6px 0;text-align:left;'>Situación</th></tr>"
                + filas + "</table>"
            )

        n_venc = len(vencidos)
        n_por = len(pend_8) + len(pend_4)
        if n_venc and n_por:
            asunto = f"URGENTE: {_cnt(n_venc)} vencido(s) y {_cnt(n_por)} por vencer — resumen de revisión"
        elif n_venc:
            asunto = f"URGENTE: {_cnt(n_venc)} vencido(s) de revisión"
        else:
            asunto = f"Radicados por vencer ({n_por}) — resumen de revisión"

        secciones = []
        if vencidos:
            secciones.append(
                "<p style='margin:14px 0 0 0;'><strong style='color:#b02a37;'>Vencidos — requieren atención inmediata</strong></p>"
                + _tabla(vencidos)
            )
        vence_hoy = [i for i in pend_4 if i["dias"] == 0]
        faltan_4 = [i for i in pend_4 if i["dias"] > 0]
        if vence_hoy:
            secciones.append(
                "<p style='margin:14px 0 0 0;'><strong style='color:#b02a37;'>Vencen hoy</strong></p>"
                + _tabla(vence_hoy)
            )
        if faltan_4:
            secciones.append(
                "<p style='margin:14px 0 0 0;'><strong style='color:#996515;'>Faltan 4 días o menos</strong></p>"
                + _tabla(faltan_4)
            )
        if pend_8:
            secciones.append(
                "<p style='margin:14px 0 0 0;'><strong>Faltan 8 días o menos</strong></p>"
                + _tabla(pend_8)
            )

        interno = (
            "<p style='margin:0 0 8px 0;'>Resumen único de plazos de revisión (15 días hábiles) "
            f"con <strong>{_cnt(n_venc)} vencido(s)</strong> y <strong>{_cnt(n_por)} por vencer</strong>:</p>"
            + "".join(secciones)
            + "<p style='font-size:12px;color:#666;'>Evalue los radicados listados y, si aplica, suba el Formato 4.3.7 C y el Recibo Técnico. "
            "Este resumen se envía como máximo una vez al día (lunes a viernes).</p>"
            + "<p style='font-size:11px;color:#999;'>INTECOAL SAS — Interventoría Técnica (aviso automático)</p>"
        )
        municipio = (vencidos[0]["radicacion"].get("metadata", {}) or {}).get("municipio", "") if vencidos else ""
        cuerpo = self._plantilla_correo("INTECOAL SAS — Alerta de vencimiento de revisión", interno, municipio)
        adj = self._adjunto_logo(municipio)
        return await self._enviar_correo(destino, asunto, cuerpo, [adj] if adj else None)

    def obtener_config(self):
        return {
            "azureClientId": self.client_id,
            "azureTenantId": self.tenant_id,
            "sharepointSiteId": self.site_id,
            "sharepointListId": self.list_id,
            "sharepointLibrary": self.library_name,
            "senderEmail": self.sender_email,
            "notificationRecipient": self.notification_recipient,
            "isConnected": bool(self.client_id and self.client_secret and self.tenant_id),
        }

    async def _columnas_lista(self):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}"}
        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/columns"
        async with httpx.AsyncClient() as cliente:
            resp = await cliente.get(url, headers=headers)
            resp.raise_for_status()
            cols = resp.json().get("value", [])
            return {c["name"]: c.get("displayName", c["name"]) for c in cols}

    async def probar_conexion(self):
        resultados = {"pasos": []}

        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient() as cliente:
            resultados["pasos"].append({"paso": "Token OAuth2", "ok": True})

            url_site = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}"
            resp = await cliente.get(url_site, headers=headers)
            resultados["pasos"].append({
                "paso": "Acceso al sitio",
                "ok": resp.status_code == 200,
                "status": resp.status_code,
                "detalle": resp.json().get("displayName", resp.json().get("error", {}).get("message", "")) if resp.status_code == 200 else resp.text[:200],
            })

            try:
                drive_id = await self._obtener_drive_id()
                url_drives = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/drives"
                resp_d = await cliente.get(url_drives, headers=headers)
                drives_nombres = [d.get("name", "?") for d in resp_d.json().get("value", [])]
                resultados["pasos"].append({
                    "paso": "Resolver drive/librería",
                    "ok": True,
                    "driveId": drive_id,
                    "drivesDisponibles": drives_nombres,
                })
            except Exception as e:
                resultados["pasos"].append({"paso": "Resolver drive/librería", "ok": False, "error": str(e)})

            url_list = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}"
            resp_l = await cliente.get(url_list, headers=headers)
            resultados["pasos"].append({
                "paso": "Acceso a lista SharePoint",
                "ok": resp_l.status_code == 200,
                "status": resp_l.status_code,
                "detalle": resp_l.json().get("displayName", resp_l.json().get("error", {}).get("message", "")) if resp_l.status_code == 200 else resp_l.text[:300],
            })

            if resp_l.status_code == 200:
                url_items = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/items?$top=1&$select=id,fields"
                resp_items = await cliente.get(url_items, headers=headers)
                items_count = len(resp_items.json().get("value", []))
                resultados["pasos"].append({
                    "paso": "Listar items de la lista",
                    "ok": resp_items.status_code == 200,
                    "status": resp_items.status_code,
                    "itemsEncontrados": items_count,
                })

            try:
                drive_id = await self._obtener_drive_id()
                url_root = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/drives/{drive_id}/root/children"
                resp_r = await cliente.get(url_root, headers=headers)
                carpetas = [i.get("name", "?") for i in resp_r.json().get("value", [])[:5]]
                resultados["pasos"].append({
                    "paso": "Listar contenido raíz del drive",
                    "ok": resp_r.status_code == 200,
                    "status": resp_r.status_code,
                    "primerosElementos": carpetas,
                })
            except Exception as e:
                resultados["pasos"].append({"paso": "Listar contenido raíz del drive", "ok": False, "error": str(e)})

        todos_ok = all(p.get("ok", False) for p in resultados["pasos"])
        resultados["ok"] = todos_ok
        resultados["message"] = "Todos los pasos OK" if todos_ok else "Algunos pasos fallaron - revisa los detalles"

        return resultados

    async def cargar_radicaciones_desde_sharepoint(self):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}"}
        radicaciones = []
        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/items"
        params = {"$expand": "fields", "$top": 500}

        async with httpx.AsyncClient(timeout=30.0) as cliente:
            try:
                resp = await cliente.get(url, headers=headers, params=params)
                if resp.status_code != 200:
                    print(f"[GRAPH] Error leyendo lista: {resp.status_code}")
                    return []

                items = resp.json().get("value", [])
                print(f"[GRAPH] {len(items)} items encontrados en lista SharePoint")

                for item in items:
                    fields = item.get("fields", {})
                    raw_json = fields.get("RawJson", "")
                    if raw_json:
                        try:
                            import json
                            rad = json.loads(raw_json)
                            rad["m365Synced"] = True
                            if not rad.get("creadorEmail"):
                                rad["creadorEmail"] = rad.get("metadata", {}).get("creadorEmail", "") or fields.get("CreadorEmail", "")
                            radicaciones.append(rad)
                            continue
                        except Exception as e:
                            print(f"[GRAPH] RawJson parse error para {fields.get('Title', '?')}: {e}")

                    numero = fields.get("NumeroRadicado", fields.get("Title", ""))
                    if not numero:
                        continue

                    estado_sp = fields.get("Estado", "Pendiente_Firma")
                    estado_map = {"Aprobado": "Aprobado", "Revision": "Con Observaciones", "Pendiente_Firma": "Radicado", "En_Revision": "En Revisión"}
                    estado = estado_map.get(estado_sp, "Radicado")

                    docs_str = fields.get("DocumentosOk", "0/22")
                    try:
                        docs_ok = int(docs_str.split("/")[0])
                    except Exception:
                        docs_ok = 0

                    try:
                        pct = int(fields.get("PorcentajeConformidad", 0))
                    except Exception:
                        pct = 0

                    rad = {
                        "id": item.get("id", ""),
                        "numeroRadicado": numero,
                        "metadata": {
                            "nombreProyecto": fields.get("NombreProyecto", numero),
                            "municipio": fields.get("Municipio", ""),
                            "contratista": fields.get("Operador", ""),
                            "nitContratista": fields.get("NIT", ""),
                            "responsable": fields.get("Responsable", ""),
                            "correoResponsable": fields.get("CorreoResponsable", ""),
                            "tipoEntrega": fields.get("TipoEntrega", "Inicial"),
                            "creadorEmail": fields.get("CreadorEmail", ""),
                        },
                        "estado": estado,
                        "documentosOk": docs_ok,
                        "totalDocumentos": 22,
                        "fechaRadicacion": fields.get("FechaRadicacion", ""),
                        "fechaActualizacion": fields.get("FechaRadicacion", ""),
                        "porcentajeCumplimiento": pct,
                        "archivos": [],
                        "elementosEntregados": [],
                        "observacionesGenerales": "",
                        "creadorEmail": fields.get("CreadorEmail", ""),
                        "creadorName": "",
                        "m365Synced": True,
                    }
                    radicaciones.append(rad)

                print(f"[GRAPH] {len(radicaciones)} filas encontradas desde SharePoint, deduplicando por radicado...")
                unicos = {}
                for rad in radicaciones:
                    num = rad.get("numeroRadicado", "")
                    if not num:
                        continue
                    fecha = rad.get("fechaActualizacion") or rad.get("fechaRadicacion") or ""
                    existente = unicos.get(num)
                    if not existente or (fecha or "") > (existente.get("fechaActualizacion") or existente.get("fechaRadicacion") or ""):
                        unicos[num] = rad
                radicaciones = list(unicos.values())
                print(f"[GRAPH] {len(radicaciones)} radicaciones únicas reconstruidas desde SharePoint")
                return radicaciones

            except Exception as e:
                print(f"[GRAPH] Error cargando radicaciones: {e}")
                return []

    async def guardar_radicacion_en_sharepoint(self, radicacion):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        meta = radicacion["metadata"]
        numero = radicacion["numeroRadicado"]
        estado = radicacion.get("estado", "Radicado")

        estado_map = {
            "Aprobado": "Aprobado",
            "Con Observaciones": "Revision",
            "Radicado": "Pendiente_Firma",
            "En Revisión": "En_Revision",
        }
        estado_sp = estado_map.get(estado, "Pendiente_Firma")

        docs_str = f"{radicacion.get('documentosOk', 0)}/{radicacion.get('totalDocumentos', 22)}"

        import json

        rad_clean = {k: v for k, v in radicacion.items() if k != "archivos" or not v}
        if "archivos" in radicacion and radicacion["archivos"]:
            rad_clean["archivos"] = []
            for a in radicacion["archivos"]:
                rad_clean["archivos"].append({
                    "docId": a.get("docId"),
                    "docCode": a.get("docCode", ""),
                    "docName": a.get("docName", ""),
                    "fileName": a.get("fileName", ""),
                    "status": a.get("status", ""),
                    "notes": a.get("notes", ""),
                    "esManual": a.get("esManual", False),
                })

        raw_json = json.dumps(rad_clean, ensure_ascii=False, default=str)

        from datetime import datetime, timezone
        ahora = datetime.now(timezone.utc)
        contador = int(ahora.timestamp())

        campos_todos = {
            "Title": f"{numero} - {estado} - {contador}",
            "NumeroRadicado": numero,
            "NombreProyecto": meta.get("nombreProyecto", numero),
            "Municipio": meta.get("municipio", ""),
            "Operador": meta.get("contratista", ""),
            "NIT": meta.get("nitContratista", ""),
            "Responsable": meta.get("responsable", ""),
            "CorreoResponsable": meta.get("correoResponsable", ""),
            "TipoEntrega": meta.get("tipoEntrega", ""),
            "Estado": estado_sp,
            "DocumentosOk": docs_str,
            "PorcentajeConformidad": radicacion.get("porcentajeCumplimiento", 0),
            "FechaRadicacion": radicacion.get("fechaRadicacion", "")[:10],
            "RutaOneDrive": f"/Documentos_Radicacion/{numero}/",
            "CreadorEmail": radicacion.get("creadorEmail", "") or meta.get("creadorEmail", ""),
            "RawJson": raw_json[:64000] if len(raw_json) > 64000 else raw_json,
        }

        try:
            cols_existentes = await self._columnas_lista()
            campos = {k: v for k, v in campos_todos.items() if k in cols_existentes}
            col_faltantes = [k for k in campos_todos if k not in cols_existentes]
            if col_faltantes:
                print(f"[GRAPH] Columnas no encontradas (se omiten): {col_faltantes}")
        except Exception:
            campos = campos_todos

        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/items"
        async with httpx.AsyncClient(timeout=30.0) as cliente:
            resp = await cliente.post(url, headers=headers, json={"fields": campos})
            print(f"[GRAPH] Item {numero} ({estado}) creado en SharePoint: {resp.status_code}")
            if resp.status_code not in (200, 201):
                raise Exception(
                    f"SharePoint rechazó la fila de la lista ({resp.status_code}): {resp.text[:300]}"
                )

        resumen = {"fila": f"{numero} ({estado_sp})", "carpetas": "ok", "archivos": {}}
        try:
            await self._crear_carpeta_proyecto(numero)
        except Exception as e:
            resumen["carpetas"] = f"error: {e}"
            print(f"[GRAPH] Error creando carpetas de {numero}: {e}")
        try:
            resumen["archivos"] = await self._subir_archivos(radicacion, numero)
        except Exception as e:
            resumen["archivos"] = {"error": str(e)}
            print(f"[GRAPH] Error subiendo archivos de {numero}: {e}")

        return {"ok": True, "resumen": resumen}

    async def eliminar_radicacion_de_sharepoint(self, numero):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}"}

        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/items"
        params = {
            "$filter": f"fields/NumeroRadicado eq '{self._filtro_seguro(numero)}'",
            "$expand": "fields",
            "$select": "id",
        }

        async with httpx.AsyncClient(timeout=30.0) as cliente:
            resp = await cliente.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                print(f"[GRAPH] Error buscando items a eliminar para {numero}: {resp.status_code}")
                return
            items = resp.json().get("value", [])
            for item in items:
                del_url = f"{url}/{item['id']}"
                del_resp = await cliente.delete(del_url, headers=headers)
                print(f"[GRAPH] Item {item['id']} de {numero} eliminado de SharePoint: {del_resp.status_code}")

    async def asegurar_columna_rawjson(self):
        token = await self._obtener_token()
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        try:
            cols = await self._columnas_lista()
            if "RawJson" in cols:
                print("[GRAPH] Columna RawJson ya existe")
                return
        except Exception:
            pass

        url = f"https://graph.microsoft.com/v1.0/sites/{self.site_id}/lists/{self.list_id}/columns"
        columna = {
            "name": "RawJson",
            "text": {"maxLength": 65535},
            "displayName": "RawJson",
        }
        async with httpx.AsyncClient(timeout=30.0) as cliente:
            resp = await cliente.post(url, headers=headers, json=columna)
            if resp.status_code in (200, 201):
                print("[GRAPH] Columna RawJson creada OK")
            else:
                print(f"[GRAPH] Error creando columna RawJson: {resp.status_code} {resp.text[:200]}")

        for col_name in ["NombreProyecto", "CreadorEmail"]:
            if col_name not in cols:
                col_data = {"name": col_name, "text": {"maxLength": 255}, "displayName": col_name}
                async with httpx.AsyncClient(timeout=30.0) as cliente:
                    resp = await cliente.post(url, headers=headers, json=col_data)
                    print(f"[GRAPH] Columna {col_name}: {resp.status_code}")
