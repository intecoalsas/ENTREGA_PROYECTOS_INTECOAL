import os
import json
import shutil
import asyncio
import inspect
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI, HTTPException, Request, Query, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt, JWTError

try:
    from backend.modelos import (
        CATALOGO_21_DOCUMENTOS, ESTADOS, GRUPOS_CARPETA,
        generar_numero_radicado, generar_id, calcular_porcentaje,
        fecha_limite_revision, dias_restantes, _solo_fecha,
    )
except ImportError:
    from modelos import (
        CATALOGO_21_DOCUMENTOS, ESTADOS, GRUPOS_CARPETA,
        generar_numero_radicado, generar_id, calcular_porcentaje,
        fecha_limite_revision, dias_restantes, _solo_fecha,
    )

try:
    from backend.grafos import GraphService
except ImportError:
    try:
        from grafos import GraphService
    except ImportError as _imp_err:
        print(f"[WARNING] No se pudo importar GraphService: {_imp_err}")
        GraphService = None

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

MIME_PERMITIDOS = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/bmp",
    "image/gif",
    "application/dwg",
    "application/dxf",
    "application/x-dwg",
    "application/x-dxf",
    "application/acad",
    "application/octet-stream",
}
EXTENSIONES_PERMITIDAS = {".pdf", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".gif", ".dwg", ".dxf"}


def archivo_permitido(nombre_archivo: str, mime: str) -> bool:
    if (mime or "") in MIME_PERMITIDOS:
        return True
    ext = Path(nombre_archivo or "").suffix.lower()
    return ext in EXTENSIONES_PERMITIDAS


def detalle_archivo_no_permitido(nombre_archivo: str, mime: str) -> str:
    return (
        f"Tipo no permitido en '{nombre_archivo or '?'}' ({mime or 'desconocido'}). "
        "Solo PDF, imágenes (JPEG, PNG, TIFF, BMP, GIF) y AutoCAD (DWG, DXF)."
    )


def mime_efectivo(nombre_archivo: str, mime: str) -> str:
    if mime:
        return mime
    ext = Path(nombre_archivo or "").suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".tif": "image/tiff",
        ".tiff": "image/tiff",
        ".bmp": "image/bmp",
        ".gif": "image/gif",
        ".dwg": "application/dwg",
        ".dxf": "application/dxf",
    }.get(ext, "application/octet-stream")

UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


async def guardar_archivo(destino: Path, upload_file, nombre: str) -> int:
    try:
        destino.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        with destino.open("wb") as salida:
            while True:
                bloque = await upload_file.read(1024 * 1024)
                if not bloque:
                    break
                salida.write(bloque)
                total += len(bloque)
        return total
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"No se pudo guardar '{nombre}' en disco: {e}")


_PARAMETROS_FORM = frozenset(inspect.signature(Request.form).parameters)


async def leer_form(request: Request, max_files: int, max_fields: int):
    if "max_part_size" in _PARAMETROS_FORM:
        return await request.form(max_files=max_files, max_fields=max_fields, max_part_size=2**31 - 1)
    return await request.form(max_files=max_files, max_fields=max_fields)

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DATA_FILE = DATA_DIR / "radicaciones.json"

radicaciones_db = []
graph_service = None


def guardar_db():
    try:
        DATA_FILE.write_text(json.dumps(radicaciones_db, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[DB] Error guardando: {e}")


def cargar_db():
    global radicaciones_db
    try:
        if DATA_FILE.exists():
            radicaciones_db = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            print(f"[DB] Cargados {len(radicaciones_db)} radicaciones desde disco")
        else:
            radicaciones_db = []
            print("[DB] No hay archivo previo, base vacía")
    except Exception as e:
        print(f"[DB] Error cargando: {e}")
        radicaciones_db = []


def lanzar_background(coro, nombre="tarea"):
    async def _envuelto():
        try:
            await coro
        except Exception as e:
            print(f"[BG:{nombre}] Error: {e}")
    try:
        asyncio.get_running_loop().create_task(_envuelto())
    except RuntimeError:
        print(f"[BG:{nombre}] Sin event loop, se omite ejecución en background")


async def revisar_vencimientos(forzar=False):
    notificados = []
    if not graph_service:
        return notificados
    ahora = datetime.now(timezone.utc)
    hoy = ahora.date()
    hora_colombia = ahora.astimezone(timezone(timedelta(hours=-5))).hour
    if not forzar:
        dia_semana = ahora.weekday()
        if dia_semana > 4 or not (8 <= hora_colombia < 9):
            return []
    pend_8, pend_4, vencidos = [], [], []
    for r in radicaciones_db:
        if r.get("estado") == "Aprobado":
            continue
        numero = r.get("numeroRadicado", "?")
        limite = fecha_limite_revision(r.get("fechaRadicacion"))
        if not limite:
            print(f"[VENC] {numero} sin fecha de radicación válida: se omite, NO recibirá avisos de plazo")
            continue
        rest = dias_restantes(limite, hoy)
        flags = r.setdefault("notifVencimiento", {})
        item = {"radicacion": r, "dias": rest, "limite": limite.isoformat(), "flags": flags}
        if rest < 0:
            ultima = _solo_fecha(flags.get("diaria"))
            if ultima != hoy:
                vencidos.append(item)
        elif rest <= 4 and not flags.get("4"):
            pend_4.append(item)
        elif 0 <= rest <= 8 and not flags.get("8"):
            pend_8.append(item)
    if not (pend_8 or pend_4 or vencidos):
        return []
    try:
        ok = await graph_service.enviar_correo_vencimiento_resumen(pend_8, pend_4, vencidos)
        if not ok:
            return []
        marca = datetime.now(timezone.utc).isoformat()
        for it in pend_8:
            it["flags"]["8"] = marca
            notificados.append({"numeroRadicado": it["radicacion"].get("numeroRadicado"), "diasRestantes": it["dias"], "aviso": "8 dias"})
        for it in pend_4:
            it["flags"]["4"] = marca
            it["flags"]["8"] = it["flags"].get("8") or marca
            notificados.append({"numeroRadicado": it["radicacion"].get("numeroRadicado"), "diasRestantes": it["dias"], "aviso": "4 dias"})
        for it in vencidos:
            it["flags"]["diaria"] = marca
            if not it["flags"].get("4"):
                it["flags"]["4"] = marca
                it["flags"]["8"] = it["flags"].get("8") or marca
            notificados.append({"numeroRadicado": it["radicacion"].get("numeroRadicado"), "diasRestantes": it["dias"], "aviso": "diaria"})
    except Exception as e:
        print(f"[VENC] Error enviando resumen de vencimientos: {e}")
        return []
    guardar_db()
    return notificados


async def vigilar_vencimientos():
    await asyncio.sleep(60)
    while True:
        try:
            notif = await revisar_vencimientos()
            if notif:
                print(f"[VENC] Avisos enviados: {notif}")
        except Exception as e:
            print(f"[VENC] Error en vigilancia: {e}")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph_service
    cargar_db()
    if SECRET_KEY == "dev-secret-change-in-production":
        print("[SECURITY] ADVERTENCIA: SECRET_KEY de desarrollo en uso. Defina una clave real de 32+ caracteres en producción.")
    if GraphService:
        graph_service = GraphService()
        cfg = graph_service.obtener_config()
        print(f"[STARTUP] GraphService OK | isConnected={cfg.get('isConnected')}")
        try:
            await graph_service.asegurar_columna_rawjson()
        except Exception as e:
            print(f"[STARTUP] No se pudo verificar columna RawJson: {e}")
        if len(radicaciones_db) == 0:
            print("[STARTUP] DB local vacía, intentando cargar desde SharePoint...")
            for attempt in range(3):
                try:
                    sp_rads = await graph_service.cargar_radicaciones_desde_sharepoint()
                    if sp_rads:
                        radicaciones_db.extend(sp_rads)
                        guardar_db()
                        print(f"[STARTUP] OK: {len(sp_rads)} radicaciones cargadas desde SharePoint")
                    else:
                        print("[STARTUP] SharePoint devolvió 0 radicaciones")
                    break
                except Exception as e:
                    print(f"[STARTUP] ERROR cargando de SharePoint (intento {attempt+1}/3): {e}")
                    if attempt < 2:
                        await asyncio.sleep(3 * (attempt + 1))
        else:
            print(f"[STARTUP] DB local tiene {len(radicaciones_db)} radicaciones, omitiendo carga SP")
    else:
        print("[STARTUP] GraphService NO DISPONIBLE - grafos.py no importado")
    asyncio.create_task(vigilar_vencimientos())
    yield


app = FastAPI(title="Portal INTECOAL - Radicación Técnica", lifespan=lifespan)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
cors_origins = ["http://localhost:5173", "http://localhost:8000"]
if FRONTEND_URL and FRONTEND_URL not in cors_origins:
    cors_origins.append(FRONTEND_URL)
for origen in os.getenv("ALLOWED_ORIGINS", "").split(","):
    origen = origen.strip().rstrip("/")
    if origen and origen not in cors_origins:
        cors_origins.append(origen)
if "*" in cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def _error_interno(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno del servidor: {type(exc).__name__}: {exc}"},
    )



def _extraer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip() or None
    return request.query_params.get("token") or None


def requerir_usuario(request: Request) -> dict:
    token = _extraer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado. Inicie sesión.")
    datos = verificar_token(token)
    if not datos or not datos.get("email"):
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada. Inicie sesión de nuevo.")
    return datos


def requerir_interventor(usuario: dict = Depends(requerir_usuario)) -> dict:
    if usuario.get("role") != "interventor":
        raise HTTPException(status_code=403, detail="Solo el Responsable de Revisión puede realizar esta acción.")
    return usuario


def requerir_contratista(usuario: dict = Depends(requerir_usuario)) -> dict:
    if usuario.get("role") != "contratista":
        raise HTTPException(status_code=403, detail="Solo el contratista puede realizar esta acción.")
    return usuario


class MetadataRadicacion(BaseModel):
    nombreProyecto: str
    municipio: str
    contratista: str
    nitContratista: str
    responsable: str
    correoResponsable: Optional[str] = ""
    responsableRevision: Optional[str] = ""
    tipoEntrega: Optional[str] = "Inicial"
    fechaEntrega: Optional[str] = ""
    observaciones: Optional[str] = ""
    firmaContratista: Optional[dict] = None
    creadorEmail: Optional[str] = ""
    creadorName: Optional[str] = ""


class ActualizacionEstado(BaseModel):
    estado: str
    observaciones: Optional[str] = ""
    archivos: Optional[List[dict]] = None
    metadata: Optional[dict] = None
    usuarioEmail: Optional[str] = ""
    usuarioNombre: Optional[str] = ""


class ActualizacionMetadata(BaseModel):
    metadata: Optional[dict] = None
    archivos: Optional[List[dict]] = None
    estado: Optional[str] = None
    observacionesGenerales: Optional[str] = None
    elementosEntregados: Optional[List[dict]] = None
    soloAvance: Optional[bool] = False


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/documentos/catalogo")
async def obtener_catalogo():
    return {"data": CATALOGO_21_DOCUMENTOS, "total": len(CATALOGO_21_DOCUMENTOS)}


@app.get("/api/sharepoint/schema")
async def schema_sharepoint():
    columnas = [
        "Title", "NumeroRadicado", "CodigoProyecto", "NombreProyecto",
        "Municipio", "Contratista", "NIT", "Responsable", "CorreoResponsable",
        "TipoEntrega", "FechaEntrega", "Estado", "DocumentosOK",
        "PorcentajeCumplimiento", "FechaRadicacion", "ObservacionesGenerales",
    ]
    return {"columns": columnas, "listName": "Radicaciones_AP"}


@app.get("/api/radicacion/lista")
async def listar_radicaciones(
    usuario: dict = Depends(requerir_usuario),
    search: Optional[str] = Query(None),
    municipio: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
):
    resultados = list(radicaciones_db)
    email = (usuario.get("email") or "").lower().strip()
    rol = usuario.get("role")

    if rol != "interventor":
        resultados = [
            r for r in resultados
            if (r.get("creadorEmail", "").lower().strip() == email
                or r.get("metadata", {}).get("creadorEmail", "").lower().strip() == email)
        ]

    if search:
        s = search.lower()
        resultados = [
            r for r in resultados
            if s in (r.get("numeroRadicado") or "").lower()
            or s in ((r.get("metadata") or {}).get("nombreProyecto", "") or "").lower()
            or s in ((r.get("metadata") or {}).get("contratista", "") or "").lower()
            or s in ((r.get("metadata") or {}).get("municipio", "") or "").lower()
        ]

    if municipio and municipio != "TODOS":
        resultados = [r for r in resultados if (r.get("metadata") or {}).get("municipio") == municipio]

    if estado and estado != "TODOS":
        resultados = [r for r in resultados if r.get("estado") == estado]

    if tipo and tipo != "TODOS":
        resultados = [r for r in resultados if (r.get("metadata") or {}).get("tipoEntrega") == tipo]

    ligeras = []
    for r in resultados:
        r2 = dict(r)
        meta = r.get("metadata")
        if isinstance(meta, dict) and ("firmaContratista" in meta or "firmaInterventoria" in meta):
            r2["metadata"] = {k: v for k, v in meta.items()
                              if k not in ("firmaContratista", "firmaInterventoria")}
        ligeras.append(r2)

    ultimo = max(radicaciones_db, key=lambda r: r.get("numeroRadicado", ""), default=None)
    return {
        "data": ligeras,
        "total": len(ligeras),
        "ultimoGlobal": {"id": ultimo.get("id"), "numeroRadicado": ultimo.get("numeroRadicado")} if ultimo else None,
    }


@app.get("/api/radicacion/{identificador}")
async def obtener_radicacion(identificador: str, usuario: dict = Depends(requerir_usuario)):
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            if usuario.get("role") != "interventor":
                email = (usuario.get("email") or "").lower().strip()
                creador = (r.get("creadorEmail", "") or r.get("metadata", {}).get("creadorEmail", "") or "").lower().strip()
                if creador != email:
                    raise HTTPException(status_code=403, detail="No tiene acceso a este radicado.")
            return {"data": r}
    raise HTTPException(status_code=404, detail="Radicación no encontrada")


@app.get("/api/radicacion/{identificador}/historial")
async def obtener_historial(identificador: str, usuario: dict = Depends(requerir_usuario)):
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            if usuario.get("role") != "interventor":
                email = (usuario.get("email") or "").lower().strip()
                creador = (r.get("creadorEmail", "") or r.get("metadata", {}).get("creadorEmail", "") or "").lower().strip()
                if creador != email:
                    raise HTTPException(status_code=403, detail="No tiene acceso a este radicado.")
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            historial = r.get("historial", [])
            if not historial:
                historial = [
                    {
                        "estado": r.get("estado", "Radicado"),
                        "fecha": r.get("fechaRadicacion"),
                        "usuario": r.get("creadorEmail", ""),
                        "usuarioNombre": r.get("creadorName", ""),
                        "observaciones": r.get("observacionesGenerales", ""),
                    }
                ]
            return {"data": historial, "numeroRadicado": r.get("numeroRadicado", "")}
    raise HTTPException(status_code=404, detail="Radicación no encontrada")


@app.delete("/api/radicacion/{identificador}")
async def eliminar_radicacion(identificador: str, usuario: dict = Depends(requerir_contratista)):
    email = (usuario.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=403, detail="Falta el correo del solicitante.")

    radicacion = next(
        (
            r for r in radicaciones_db
            if r.get("id") == identificador
            or r.get("numeroRadicado") == identificador
            or r.get("identificador") == identificador
        ),
        None,
    )
    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicado no encontrado.")

    creador = (radicacion.get("creadorEmail", "") or radicacion.get("metadata", {}).get("creadorEmail", "") or "")
    if creador.lower().strip() != email.lower().strip():
        raise HTTPException(status_code=403, detail="Solo el contratista que creó el radicado puede eliminarlo.")

    ultimo_global = max(radicaciones_db, key=lambda r: r.get("numeroRadicado", ""), default=None)

    if ultimo_global is None or ultimo_global.get("id") != radicacion.get("id"):
        raise HTTPException(
            status_code=403,
            detail="Solo se puede eliminar el último radicado creado. Ya existe un radicado más reciente."
        )

    if radicacion.get("estado") == "Aprobado":
        raise HTTPException(status_code=403, detail="No se puede eliminar un radicado ya aprobado.")

    radicaciones_db.remove(radicacion)
    guardar_db()

    numero = radicacion.get("numeroRadicado", "")
    rid = radicacion.get("id", "")

    async def _limpieza():
        try:
            shutil.rmtree(UPLOADS_DIR / rid, ignore_errors=True)
        except Exception as e:
            print(f"[DELETE] No se pudo borrar carpeta local {rid}: {e}")
        if graph_service:
            try:
                await graph_service.eliminar_radicacion_de_sharepoint(numero)
            except Exception as e:
                print(f"[DELETE] Error borrando {numero} de SharePoint: {e}")

    lanzar_background(_limpieza(), f"delete-{numero}")

    return {"ok": True, "mensaje": f"Radicado {radicacion['numeroRadicado']} eliminado correctamente."}


@app.post("/api/radicacion/nueva")
async def crear_radicacion(request: Request, usuario: dict = Depends(requerir_usuario)):
    form = await leer_form(request, 5000, 5000)

    text_fields = {}
    uploaded_files = {}
    for key in form:
        value = form[key]
        if hasattr(value, "read"):
            uploaded_files[key] = value
        else:
            text_fields[key] = value

    meta = elems = na = docs_adic = None
    try:
        meta = json.loads(text_fields.get("metadatos", "{}"))
        elems = json.loads(text_fields.get("elementos", "[]"))
        na = json.loads(text_fields.get("naDocs", "[]"))
        docs_adic = json.loads(text_fields.get("docsAdicionales", "[]"))
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Campos JSON inválidos en el formulario: {e}")

    numero = generar_numero_radicado(radicaciones_db)
    nuevo_id = generar_id()
    total_docs = len(CATALOGO_21_DOCUMENTOS) + len(docs_adic)

    for r in radicaciones_db:
        if r.get("numeroRadicado") == numero:
            raise HTTPException(status_code=409, detail=f"El número de radicado {numero} ya existe. Intente nuevamente.")

    upload_dir = UPLOADS_DIR / nuevo_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_files = {}
    extra_sub_files = {}
    slot_sub_files = {}
    for field_name, upload_file in uploaded_files.items():
        if field_name.startswith('subFile_'):
            try:
                _, doc_id_s, sub_id = field_name.split('_', 2)
                doc_id = int(doc_id_s)
            except (ValueError, TypeError):
                continue
            meta_str = text_fields.get(f'subFileMeta_{doc_id}_{sub_id}', '{}')
            try:
                meta_info = json.loads(meta_str)
            except (json.JSONDecodeError, ValueError, TypeError):
                meta_info = {}
            mime = upload_file.content_type or ""
            if not archivo_permitido(upload_file.filename or "", mime):
                continue
            doc_code = str(doc_id)
            for doc in CATALOGO_21_DOCUMENTOS:
                if doc["id"] == doc_id:
                    doc_code = doc["code"]
                    break
            sub_dir = upload_dir / doc_code
            safe_name = (upload_file.filename or f"{sub_id}.pdf").replace("/", "_").replace("\\", "_")
            file_path = sub_dir / safe_name
            bytes_guardados = await guardar_archivo(file_path, upload_file, safe_name)
            slot_sub_files.setdefault(doc_id, []).append({
                "subId": sub_id,
                "subCode": meta_info.get('subCode', sub_id),
                "subName": meta_info.get('subName', safe_name),
                "fileName": upload_file.filename,
                "fileSize": bytes_guardados,
                "fileType": mime_efectivo(upload_file.filename or "", mime),
                "uploadDate": datetime.now(timezone.utc).isoformat(),
                "localPath": str(file_path),
                "status": "CUMPLE",
            })
            continue
        if field_name.startswith('extraSub_'):
            parts = field_name.split('_')
            doc_id = int(parts[1])
            idx = int(parts[2])
            meta_key = f'extraSubMeta_{doc_id}_{idx}'
            meta_str = text_fields.get(meta_key, '{}')
            meta_info = json.loads(meta_str)
            mime = upload_file.content_type or ""
            if not archivo_permitido(upload_file.filename or "", mime):
                continue
            sub_name = meta_info.get('subFileName', f'Anexo {idx + 1}')
            safe_sub_name = sub_name.replace("/", "_").replace("\\", "_")
            doc_code = str(doc_id)
            for doc in CATALOGO_21_DOCUMENTOS:
                if doc["id"] == doc_id:
                    doc_code = doc["code"]
                    break
            sub_dir = upload_dir / doc_code
            file_path = sub_dir / safe_sub_name
            bytes_guardados = await guardar_archivo(file_path, upload_file, safe_sub_name)
            if doc_id not in extra_sub_files:
                extra_sub_files[doc_id] = []
            extra_sub_files[doc_id].append({
                "subId": f"extra_{idx + 1}",
                "subCode": f"ANEXO-{idx + 1}",
                "subName": sub_name,
                "fileName": upload_file.filename,
                "fileSize": bytes_guardados,
                "fileType": mime_efectivo(upload_file.filename or "", mime),
                "uploadDate": datetime.now(timezone.utc).isoformat(),
                "localPath": str(file_path),
                "status": "CUMPLE",
            })
            continue

        mime = upload_file.content_type or ""
        if not archivo_permitido(upload_file.filename or "", mime):
            raise HTTPException(status_code=400, detail=detalle_archivo_no_permitido(upload_file.filename, mime))

        safe_name = (upload_file.filename or "file.pdf").replace("/", "_").replace("\\", "_")
        file_path = upload_dir / safe_name
        bytes_guardados = await guardar_archivo(file_path, upload_file, safe_name)

        saved_files[field_name] = {
            "filename": safe_name,
            "originalName": upload_file.filename,
            "size": bytes_guardados,
            "mimeType": mime_efectivo(upload_file.filename or "", mime),
        }

    archivos_estado = []
    for doc in CATALOGO_21_DOCUMENTOS:
        status = "N/A" if doc["id"] in na else "PENDIENTE"
        file_info = saved_files.get(f"archivo_{doc['code']}")
        if file_info and status != "N/A":
            status = "CUMPLE"
        archivos_estado.append({
            "docId": doc["id"],
            "docCode": doc["code"],
            "docName": doc["name"],
            "fileName": file_info["originalName"] if file_info else "",
            "fileSize": file_info["size"] if file_info else 0,
            "fileType": file_info["mimeType"] if file_info else "application/pdf",
            "uploadDate": datetime.now(timezone.utc).isoformat() if file_info else "",
            "status": status,
            "folderPath": f"/Documentos_Radicacion/{numero}/{doc['folderGroup']}/",
            "notes": "",
            "esManual": False,
            "localPath": str(upload_dir / file_info["filename"]) if file_info else "",
        })

    for doc_adic in docs_adic:
        file_info = saved_files.get(f"archivo_custom_{doc_adic['docId']}")
        if file_info:
            archivos_estado.append({
                "docId": doc_adic["docId"],
                "docCode": doc_adic.get("docCode", f"X{doc_adic['docId']}"),
                "docName": doc_adic.get("docName", "Documento Adicional"),
                "fileName": file_info["originalName"],
                "fileSize": file_info["size"],
                "fileType": file_info["mimeType"],
                "uploadDate": datetime.now(timezone.utc).isoformat(),
                "status": "CUMPLE",
                "folderPath": f"/Documentos_Radicacion/{numero}/F_Documentos_Adicionales/",
                "notes": "",
                "esManual": True,
                "localPath": str(upload_dir / file_info["filename"]) if file_info else "",
            })
        else:
            archivos_estado.append({
                "docId": doc_adic["docId"],
                "docCode": doc_adic.get("docCode", f"X{doc_adic['docId']}"),
                "docName": doc_adic.get("docName", "Documento Adicional"),
                "fileName": "",
                "fileSize": 0,
                "fileType": "application/pdf",
                "uploadDate": "",
                "status": "PENDIENTE",
                "folderPath": f"/Documentos_Radicacion/{numero}/F_Documentos_Adicionales/",
                "notes": "",
                "esManual": True,
                "localPath": "",
            })

    documentos_ok = sum(1 for a in archivos_estado if a["status"] in ("CUMPLE", "N/A"))

    meta["creadorEmail"] = (usuario.get("email") or "").lower().strip()
    meta["creadorName"] = usuario.get("name") or meta.get("creadorName", "") or meta.get("responsable", "")

    for doc_id, subs in extra_sub_files.items():
        for archivo in archivos_estado:
            if archivo["docId"] == doc_id:
                if "subFiles" not in archivo:
                    archivo["subFiles"] = []
                archivo["subFiles"].extend(subs)
                break

    for doc_id, subs in slot_sub_files.items():
        for archivo in archivos_estado:
            if archivo["docId"] == doc_id:
                if "subFiles" not in archivo:
                    archivo["subFiles"] = []
                vistos = {s.get("subId") for s in archivo["subFiles"]}
                for s in subs:
                    if s.get("subId") not in vistos:
                        archivo["subFiles"].append(s)
                        vistos.add(s.get("subId"))
                if archivo.get("status") != "N/A":
                    archivo["status"] = "CUMPLE"
                    archivo["uploadDate"] = archivo["uploadDate"] or datetime.now(timezone.utc).isoformat()
                break

    documentos_ok = sum(1 for a in archivos_estado if a["status"] in ("CUMPLE", "N/A"))

    radicacion = {
        "id": nuevo_id,
        "numeroRadicado": numero,
        "metadata": meta,
        "estado": "Radicado",
        "documentosOk": documentos_ok,
        "totalDocumentos": total_docs,
        "fechaRadicacion": datetime.now(timezone.utc).isoformat(),
        "fechaActualizacion": datetime.now(timezone.utc).isoformat(),
        "porcentajeCumplimiento": calcular_porcentaje(archivos_estado),
        "archivos": archivos_estado,
        "elementosEntregados": elems,
        "observacionesGenerales": "",
        "creadorEmail": meta.get("creadorEmail", ""),
        "creadorName": meta.get("creadorName", ""),
        "historial": [
            {
                "estado": "Radicado",
                "fecha": datetime.now(timezone.utc).isoformat(),
                "usuario": meta.get("creadorEmail", ""),
                "usuarioNombre": meta.get("creadorName", ""),
                "observaciones": "",
            }
        ],
    }

    radicaciones_db.insert(0, radicacion)
    guardar_db()

    print(f"[MAIN] graph_service={'DISPONIBLE' if graph_service else 'NULL'}")

    if graph_service:
        async def _post_creacion(rad):
            try:
                await graph_service.enviar_correo_nuevo_radicado_revisor(rad)
                print(f"[MAIN] Correo de nuevo radicado enviado al revisor para {rad.get('numeroRadicado')}")
            except Exception as e:
                print(f"[MAIN] Error correo nuevo radicado al revisor: {e}")
            try:
                await graph_service.enviar_correo_nuevo_radicado_contratista(rad)
                print(f"[MAIN] Correo de radicado creado enviado al contratista para {rad.get('numeroRadicado')}")
            except Exception as e:
                print(f"[MAIN] Error correo radicado creado al contratista: {e}")

        lanzar_background(_post_creacion(radicacion), f"nueva-{numero}")

    return {"data": radicacion, "ok": True}


@app.post("/api/radicacion/{identificador}/archivo")
async def subir_archivo(request: Request, identificador: str, usuario: dict = Depends(requerir_usuario)):
    form = await leer_form(request, 100, 100)
    doc_id_raw = form.get("docId")
    archivo = form.get("archivo")
    sub_file_name = form.get("subFileName")

    if doc_id_raw is None or archivo is None or not hasattr(archivo, "read"):
        raise HTTPException(status_code=400, detail="Faltan los campos 'docId' y 'archivo'.")

    try:
        docId = int(doc_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="El campo 'docId' debe ser numérico.")

    subFileName = str(sub_file_name) if sub_file_name not in (None, "") else None
    sub_id = form.get("subId")
    sub_id = str(sub_id) if sub_id not in (None, "") else None
    sub_code = form.get("subCode")
    sub_code = str(sub_code) if sub_code not in (None, "") else None
    radicacion = None
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            radicacion = r
            break

    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicacion no encontrada")

    mime = archivo.content_type or ""
    if not archivo_permitido(archivo.filename or "", mime):
        raise HTTPException(
            status_code=400,
            detail=detalle_archivo_no_permitido(archivo.filename, mime),
        )

    upload_dir = UPLOADS_DIR / radicacion["id"]

    if subFileName:
        doc_code = ""
        for doc in (radicacion.get("archivos") or []):
            if doc.get("docId") == docId:
                doc_code = doc.get("docCode") or str(docId)
                break
        sub_dir = upload_dir / doc_code
        safe_name = subFileName.replace("/", "_").replace("\\", "_")
        file_path = sub_dir / safe_name
    else:
        safe_name = (archivo.filename or "file.pdf").replace("/", "_").replace("\\", "_")
        file_path = upload_dir / safe_name

    bytes_guardados = await guardar_archivo(file_path, archivo, safe_name)

    for doc in (radicacion.get("archivos") or []):
        if doc.get("docId") == docId:
            if subFileName:
                if "subFiles" not in doc:
                    doc["subFiles"] = []
                if sub_id:
                    slot = next((s for s in doc["subFiles"] if str(s.get("subId")) == sub_id), None)
                    datos_slot = {
                        "subId": sub_id,
                        "subCode": sub_code or (slot.get("subCode") if slot else sub_id),
                        "subName": subFileName,
                        "fileName": archivo.filename,
                        "fileSize": bytes_guardados,
                        "fileType": mime_efectivo(archivo.filename or "", mime),
                        "uploadDate": datetime.now(timezone.utc).isoformat(),
                        "localPath": str(file_path),
                        "status": "CUMPLE",
                    }
                    if slot:
                        slot.update(datos_slot)
                    else:
                        doc["subFiles"].append(datos_slot)
                else:
                    doc["subFiles"].append({
                        "subId": f"extra_{len(doc['subFiles']) + 1}",
                        "subCode": f"ANEXO-{len(doc['subFiles']) + 1}",
                        "subName": subFileName,
                        "fileName": archivo.filename,
                        "fileSize": bytes_guardados,
                        "fileType": mime_efectivo(archivo.filename or "", mime),
                        "uploadDate": datetime.now(timezone.utc).isoformat(),
                        "localPath": str(file_path),
                        "status": "CUMPLE",
                    })
                if doc.get("status") != "N/A":
                    doc["status"] = "CUMPLE"
            else:
                doc["fileName"] = archivo.filename
                doc["fileSize"] = bytes_guardados
                doc["fileType"] = mime_efectivo(archivo.filename or "", mime)
                doc["uploadDate"] = datetime.now(timezone.utc).isoformat()
                doc["status"] = "CUMPLE"
                doc["localPath"] = str(file_path)
            break

    radicacion["documentosOk"] = sum(
        1 for a in (radicacion.get("archivos") or []) if a.get("status") in ("CUMPLE", "N/A")
    )
    radicacion["porcentajeCumplimiento"] = calcular_porcentaje(radicacion.get("archivos") or [])
    radicacion["fechaActualizacion"] = datetime.now(timezone.utc).isoformat()
    guardar_db()

    return {"ok": True, "data": radicacion}


@app.post("/api/radicacion/{identificador}/formato")
async def subir_formato(request: Request, identificador: str, usuario: dict = Depends(requerir_usuario)):
    form = await leer_form(request, 100, 100)
    nombre = form.get("nombre")
    archivo = form.get("archivo")

    if not nombre or archivo is None or not hasattr(archivo, "read"):
        raise HTTPException(status_code=400, detail="Faltan los campos 'nombre' y 'archivo'.")
    nombre = str(nombre)
    radicacion = None
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            radicacion = r
            break

    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicación no encontrada")

    upload_dir = UPLOADS_DIR / radicacion["id"]
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = nombre.replace("/", "_").replace("\\", "_")
    file_path = upload_dir / safe_name
    bytes_guardados = await guardar_archivo(file_path, archivo, safe_name)

    if "formatos" not in radicacion:
        radicacion["formatos"] = []

    radicacion["formatos"].append({
        "nombre": nombre,
        "fileName": archivo.filename,
        "fileSize": bytes_guardados,
        "fileType": archivo.content_type or "application/pdf",
        "uploadDate": datetime.now(timezone.utc).isoformat(),
        "localPath": str(file_path),
    })

    radicacion["fechaActualizacion"] = datetime.now(timezone.utc).isoformat()
    guardar_db()

    if graph_service:
        numero = radicacion.get("numeroRadicado", "")
        formato_guardado = radicacion["formatos"][-1]

        async def _subir_un_formato(num, fmt):
            try:
                await graph_service.subir_formato_a_sharepoint(num, fmt)
                print(f"[MAIN] Formato de {num} subido a SharePoint")
            except Exception as e:
                print(f"[MAIN] Error subiendo formato de {num} a SharePoint: {e}")

        lanzar_background(_subir_un_formato(numero, formato_guardado), f"formato-{numero}")

    return {"ok": True, "data": radicacion}


@app.patch("/api/radicacion/{identificador}/estado")
async def actualizar_estado(identificador: str, body: ActualizacionEstado, usuario: dict = Depends(requerir_usuario)):
    radicacion = None
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            radicacion = r
            break

    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicación no encontrada")

    if body.estado in ("Aprobado", "Con Observaciones") and usuario.get("role") != "interventor":
        raise HTTPException(status_code=403, detail="Solo el Responsable de Revisión puede emitir este dictamen.")
    body.usuarioEmail = (usuario.get("email") or "").lower().strip()
    body.usuarioNombre = usuario.get("name") or body.usuarioNombre or ""

    estado_anterior = radicacion["estado"]
    radicacion["estado"] = body.estado
    radicacion["observacionesGenerales"] = body.observaciones or ""

    if body.archivos:
        local_paths = {a.get("docId"): a.get("localPath", "") for a in (radicacion.get("archivos") or [])}
        for a in body.archivos:
            a["localPath"] = local_paths.get(a.get("docId"), "")
        radicacion["archivos"] = body.archivos
        radicacion["documentosOk"] = sum(
            1 for a in body.archivos if a.get("status") in ("CUMPLE", "N/A")
        )
        radicacion["porcentajeCumplimiento"] = calcular_porcentaje(body.archivos)

    if body.metadata:
        radicacion["metadata"].update(body.metadata)

    radicacion["fechaActualizacion"] = datetime.now(timezone.utc).isoformat()

    if "historial" not in radicacion:
        radicacion["historial"] = []
    radicacion["historial"].append({
        "estado": body.estado,
        "fecha": datetime.now(timezone.utc).isoformat(),
        "usuario": body.usuarioEmail or "",
        "usuarioNombre": body.usuarioNombre or "",
        "observaciones": body.observaciones or "",
    })

    radicacion["m365Synced"] = False
    guardar_db()
    respuesta = {"ok": True, "data": radicacion}

    if graph_service:
        estado_final = body.estado
        obs = body.observaciones or ""

        async def _post_estado(numero, estado_ant):
            rad = next(
                (r for r in radicaciones_db if r.get("numeroRadicado") == numero),
                None,
            )
            if not rad:
                return
            if estado_final == "Aprobado":
                try:
                    await graph_service.guardar_radicacion_en_sharepoint(rad)
                    rad["m365Synced"] = True
                    guardar_db()
                    print(f"[MAIN] SharePoint sync OK para {numero} (Aprobado)")
                except Exception as e:
                    rad["m365Synced"] = False
                    guardar_db()
                    print(f"[MAIN] SharePoint sync FALLO para {numero}: {e}")
                    traceback.print_exc()
            else:
                print(f"[MAIN] Sin subida a SharePoint para {numero} ({estado_final}): solo se sube al aprobar")
            if estado_final != estado_ant:
                if estado_final in ("Aprobado", "Con Observaciones"):
                    try:
                        await asyncio.wait_for(
                            graph_service.enviar_correo_estado(rad, estado_ant, obs),
                            timeout=25,
                        )
                        print(f"[MAIN] Correo de estado enviado para {numero}: {estado_ant} -> {estado_final}")
                    except Exception as e:
                        print(f"[MAIN] Error correo cambio de estado: {e}")
                if estado_final == "En Revisión" and estado_ant != "En Revisión":
                    try:
                        await asyncio.wait_for(graph_service.enviar_correo_reesubido_revisor(rad), timeout=25)
                    except Exception as e:
                        print(f"[MAIN] Error correo radicado corregido: {e}")
                    try:
                        await asyncio.wait_for(graph_service.enviar_correo_reenvio_contratista(rad), timeout=25)
                    except Exception as e:
                        print(f"[MAIN] Error correo confirmación subida contratista: {e}")

        lanzar_background(
            _post_estado(radicacion["numeroRadicado"], estado_anterior),
            f"estado-{radicacion['numeroRadicado']}",
        )

    return respuesta


@app.post("/api/radicacion/{identificador}/sincronizar")
async def sincronizar_manual(identificador: str, usuario: dict = Depends(requerir_interventor)):
    radicacion = next(
        (
            r for r in radicaciones_db
            if r.get("id") == identificador or r.get("numeroRadicado") == identificador
        ),
        None,
    )
    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicación no encontrada.")
    if radicacion.get("estado") != "Aprobado":
        raise HTTPException(status_code=400, detail="Solo se suben a SharePoint los radicados aprobados.")
    if not graph_service:
        raise HTTPException(
            status_code=503,
            detail="Integración Microsoft 365 no configurada en el servidor (revise AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, SHAREPOINT_SITE_ID y SHAREPOINT_LIST_ID).",
        )
    try:
        resumen = await asyncio.wait_for(
            graph_service.guardar_radicacion_en_sharepoint(radicacion), timeout=180
        )
        radicacion["m365Synced"] = True
        guardar_db()
        return {"ok": True, "data": radicacion, "detalle": resumen}
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="La subida tardó más de 3 minutos y se interrumpió. Intente de nuevo con mejor conexión.",
        )
    except HTTPException:
        raise
    except Exception as e:
        radicacion["m365Synced"] = False
        guardar_db()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"No se pudo subir a SharePoint: {e}")


@app.patch("/api/radicacion/{identificador}/metadata")
async def actualizar_metadata(identificador: str, body: ActualizacionMetadata, usuario: dict = Depends(requerir_usuario)):
    radicacion = None
    for r in radicaciones_db:
        if r.get("id") == identificador or r.get("numeroRadicado") == identificador:
            radicacion = r
            break

    if not radicacion:
        raise HTTPException(status_code=404, detail="Radicación no encontrada")

    if body.metadata:
        radicacion["metadata"].update(body.metadata)
    if body.archivos:
        local_paths = {a.get("docId"): a.get("localPath", "") for a in (radicacion.get("archivos") or [])}
        for a in body.archivos:
            a["localPath"] = local_paths.get(a.get("docId"), "")
        radicacion["archivos"] = body.archivos
        radicacion["documentosOk"] = sum(
            1 for a in body.archivos if a.get("status") in ("CUMPLE", "N/A")
        )
        radicacion["porcentajeCumplimiento"] = calcular_porcentaje(body.archivos)
    if body.estado:
        radicacion["estado"] = body.estado
    if body.observacionesGenerales is not None:
        radicacion["observacionesGenerales"] = body.observacionesGenerales
    if body.elementosEntregados is not None:
        radicacion["elementosEntregados"] = body.elementosEntregados

    radicacion["fechaActualizacion"] = datetime.now(timezone.utc).isoformat()
    guardar_db()

    if body.soloAvance:
        return {"ok": True, "data": radicacion, "soloAvance": True}

    return {"ok": True, "data": radicacion}


@app.get("/api/m365/status")
async def estado_m365():
    if graph_service:
        return graph_service.obtener_config()
    return {
        "azureClientId": os.getenv("AZURE_CLIENT_ID", ""),
        "azureTenantId": os.getenv("AZURE_TENANT_ID", ""),
        "sharepointSiteId": os.getenv("SHAREPOINT_SITE_ID", ""),
        "sharepointListId": os.getenv("SHAREPOINT_LIST_ID", ""),
        "isConnected": False,
    }


@app.get("/api/m365/list-columns")
async def columnas_lista(usuario: dict = Depends(requerir_usuario)):
    if not graph_service:
        raise HTTPException(status_code=503, detail="GraphService no disponible")
    try:
        cols = await graph_service._columnas_lista()
        return {"columns": cols, "total": len(cols)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/m365/test-connection")
async def probar_conexion(usuario: dict = Depends(requerir_usuario)):
    if graph_service:
        try:
            return await graph_service.probar_conexion()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=503, detail="GraphService no disponible")


@app.post("/api/m365/revisar-vencimientos")
async def forzar_revision_vencimientos(usuario: dict = Depends(requerir_interventor)):
    if not graph_service:
        raise HTTPException(status_code=503, detail="GraphService no disponible")
    notificados = await revisar_vencimientos(forzar=True)
    return {"ok": True, "notificados": notificados, "total": len(notificados)}


@app.get("/api/m365/webhook-config")
async def obtener_webhook(usuario: dict = Depends(requerir_usuario)):
    return {
        "webhookUrl": os.getenv("POWER_AUTOMATE_WEBHOOK_URL", ""),
        "autoSyncOnApprove": True,
    }


@app.post("/api/m365/webhook-config")
async def actualizar_webhook(request: Request, usuario: dict = Depends(requerir_interventor)):
    body = await request.json()
    os.environ["POWER_AUTOMATE_WEBHOOK_URL"] = body.get("webhookUrl", "")
    return {"ok": True}


def crear_token(data: dict) -> str:
    payload = {
        "sub": data.get("email", ""),
        "email": data.get("email", ""),
        "role": data.get("role", "contratista"),
        "company": data.get("company", ""),
        "name": data.get("name", ""),
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verificar_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


@app.post("/api/auth/msal-verify")
async def verificar_msal(request: Request):
    body = await request.json()
    account = body.get("account", {})
    email = (account.get("username", account.get("localAccountId", "")) or "").strip()
    rol_solicitado = (body.get("role") or "").strip().lower()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Cuenta no válida")

    email = email.lower()
    dominio = email.split("@")[-1]
    es_interventor = dominio in ("intecoalsas.com", "intecoal.com", "intecoal.com.co")

    if rol_solicitado == "interventor":
        if not es_interventor:
            raise HTTPException(
                status_code=403,
                detail="El Responsable de Revisión solo puede entrar con correo de INTECOAL.",
            )
        rol = "interventor"
    elif rol_solicitado == "contratista":
        rol = "contratista"
    else:
        rol = "interventor" if es_interventor else "contratista"

    if es_interventor:
        empresa = "INTECOAL S.A.S."
    elif dominio in ("soy.sena.edu.co", "sena.edu.co"):
        rol = "contratista"
        empresa = "SENA"
    elif dominio in ("electroingenieria.com.co",):
        empresa = "ELECTROINGENIERIA S.A.S."
    else:
        empresa = dominio.upper().replace(".COM", "").replace(".CO", "")

    nombre = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    token = crear_token({"email": email, "company": empresa, "role": rol, "name": nombre})

    return {
        "token": token,
        "user": {
            "isAuthenticated": True,
            "name": nombre,
            "email": email,
            "role": rol,
            "company": empresa,
        }
    }


@app.get("/api/files/view/{radicacion_id}/{doc_id}")
async def ver_archivo(
    radicacion_id: str,
    doc_id: int,
    usuario: dict = Depends(requerir_usuario),
    subId: Optional[str] = Query(None),
):
    for r in radicaciones_db:
        if r.get("id") == radicacion_id or r.get("numeroRadicado") == radicacion_id:
            if usuario.get("role") != "interventor":
                email = (usuario.get("email") or "").lower().strip()
                creador = (r.get("creadorEmail", "") or r.get("metadata", {}).get("creadorEmail", "") or "").lower().strip()
                if creador != email:
                    raise HTTPException(status_code=403, detail="No tiene acceso a este archivo.")
            for a in (r.get("archivos") or []):
                if a.get("docId") != doc_id:
                    continue
                if subId is not None:
                    sf = next((s for s in (a.get("subFiles") or []) if str(s.get("subId")) == str(subId)), None)
                    if not sf or not sf.get("localPath"):
                        raise HTTPException(status_code=404, detail="Sub-archivo no encontrado")
                    sf_path = Path(sf["localPath"])
                    if not sf_path.exists():
                        raise HTTPException(status_code=404, detail="Sub-archivo no encontrado en disco")
                    return FileResponse(
                        path=str(sf_path),
                        media_type=sf.get("fileType", "application/pdf"),
                        filename=sf.get("fileName", "documento.pdf"),
                        content_disposition_type="inline",
                    )
                if a.get("docId") == doc_id and a.get("localPath"):
                    file_path = Path(a["localPath"])
                    if file_path.exists():
                        return FileResponse(
                            path=str(file_path),
                            media_type=a.get("fileType", "application/pdf"),
                            filename=a.get("fileName", "documento.pdf"),
                            content_disposition_type="inline",
                        )
                    raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
                if a.get("docId") == doc_id and a.get("fileName"):
                    return {
                        "fileName": a["fileName"],
                        "fileType": a.get("fileType", "application/pdf"),
                        "fileSize": a.get("fileSize", 0),
                        "folderPath": a.get("folderPath", ""),
                        "status": a.get("status", ""),
                    }
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
    raise HTTPException(status_code=404, detail="Radicacion no encontrada")
