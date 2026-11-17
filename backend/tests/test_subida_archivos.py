import io
import shutil
import time

import pytest
from fastapi.testclient import TestClient

import backend.main as M


def _rad():
    return {
        "id": "s-sub-1",
        "numeroRadicado": "RAD-SUB-001",
        "estado": "Con Observaciones",
        "fechaRadicacion": "2026-09-01T10:00:00+00:00",
        "fechaActualizacion": "2026-09-01T10:00:00+00:00",
        "metadata": {"nombreProyecto": "P", "municipio": "Tuluá",
                     "contratista": "C", "creadorEmail": "b@t.com"},
        "creadorEmail": "b@t.com",
        "archivos": [
            {"docId": 14, "docCode": "B14", "docName": "Certificado", "fileName": "",
             "fileSize": 0, "fileType": "application/pdf", "uploadDate": "",
             "status": "PENDIENTE", "localPath": "", "folderPath": "/X/"},
        ],
        "historial": [],
    }


@pytest.fixture(scope="module")
def cliente():
    from backend.main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    shutil.rmtree(M.UPLOADS_DIR / "s-sub-1", ignore_errors=True)


def _token(cliente):
    r = cliente.post("/api/auth/msal-verify",
                     json={"account": {"username": "b@t.com"}, "role": "contratista"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_subida_de_documento_se_guarda_y_marca_cumple(cliente, monkeypatch):
    regs = [_rad()]
    monkeypatch.setattr(M, "radicaciones_db", regs)
    monkeypatch.setattr(M, "graph_service", None)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    contenido = b"%PDF-1.4 contenido de prueba"
    r = cliente.post("/api/radicacion/s-sub-1/archivo", headers=_token(cliente),
                     data={"docId": "14"},
                     files={"archivo": ("certificado.pdf", io.BytesIO(contenido), "application/pdf")})
    assert r.status_code == 200, r.text
    doc = next(d for d in regs[0]["archivos"] if d["docId"] == 14)
    assert doc["status"] == "CUMPLE"
    assert doc["fileSize"] == len(contenido)
    assert (M.UPLOADS_DIR / "s-sub-1" / "certificado.pdf").exists()


def test_error_interno_devuelve_el_motivo_en_el_detalle(cliente, monkeypatch):
    monkeypatch.setattr(M, "radicaciones_db", [{"numeroRadicado": "RAD-SIN-ID", "archivos": []}])
    monkeypatch.setattr(M, "graph_service", None)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    r = cliente.post("/api/radicacion/RAD-SIN-ID/archivo", headers=_token(cliente),
                     data={"docId": "14"},
                     files={"archivo": ("a.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")})
    assert r.status_code == 500
    assert "KeyError" in r.json()["detail"]


def test_subida_funciona_con_starlette_sin_max_part_size(cliente, monkeypatch):
    regs = [_rad()]
    monkeypatch.setattr(M, "radicaciones_db", regs)
    monkeypatch.setattr(M, "graph_service", None)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    monkeypatch.setattr(M, "_PARAMETROS_FORM", frozenset({"self", "max_files", "max_fields"}))
    contenido = b"%PDF-1.4 en starlette antiguo"
    r = cliente.post("/api/radicacion/s-sub-1/archivo", headers=_token(cliente),
                     data={"docId": "14"},
                     files={"archivo": ("prueba.pdf", io.BytesIO(contenido), "application/pdf")})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["archivos"][0]["fileSize"] == len(contenido)


class _GraphCopia:
    """Espía del nuevo método de copia en caliente a SharePoint."""

    def __init__(self):
        self.llamadas = []

    async def subir_expediente_a_sharepoint(self, rad, solo_doc_id=None):
        self.llamadas.append((rad.get("numeroRadicado"), solo_doc_id))
        return {"subidos": 1, "omitidos": 0}


def test_subir_archivo_programa_la_copia_a_sharepoint(cliente, monkeypatch):
    """Al subir/corregir un documento se agenda de inmediato su copia a SharePoint,
    mientras el archivo todavía existe en disco."""
    regs = [_rad()]
    monkeypatch.setattr(M, "radicaciones_db", regs)
    espia = _GraphCopia()
    monkeypatch.setattr(M, "graph_service", espia)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    r = cliente.post("/api/radicacion/s-sub-1/archivo", headers=_token(cliente),
                     data={"docId": "14"},
                     files={"archivo": ("copia.pdf", io.BytesIO(b"%PDF-1.4 copia"), "application/pdf")})
    assert r.status_code == 200, r.text
    time.sleep(1.5)
    assert espia.llamadas == [("RAD-SUB-001", 14)]


def test_subir_expediente_sube_subarchivos_aun_sin_archivo_propio(tmp_path, monkeypatch):
    """El CEAP no tiene archivo propio: sus 4 sub-archivos deben subirse igual,
    y el filtro solo_doc_id limita la subida a un documento."""
    import asyncio

    from backend.grafos import GraphService

    g = GraphService()
    subidas = []
    carpetas = []

    async def _tok():
        return "token-falso"

    async def _drive():
        return "base-falsa"

    async def _crear_carpetas(numero):
        carpetas.append(numero)

    async def _contenido(cliente, headers, base, rel, contenido):
        subidas.append(rel)
        return True

    monkeypatch.setattr(g, "_obtener_token", _tok)
    monkeypatch.setattr(g, "_drive_url", _drive)
    monkeypatch.setattr(g, "_crear_carpeta_proyecto", _crear_carpetas)
    monkeypatch.setattr(g, "_subir_contenido", _contenido)

    a1 = tmp_path / "A1.pdf"
    a1.write_bytes(b"%PDF-1.4 A1")
    ceap_a = tmp_path / "CEAP-A.pdf"
    ceap_a.write_bytes(b"%PDF-1.4 CEAP-A")
    a2 = tmp_path / "A2.pdf"
    a2.write_bytes(b"%PDF-1.4 A2")

    rad = {
        "numeroRadicado": "RAD-T-SP-1",
        "archivos": [
            {"docId": 1, "docCode": "A1", "fileName": "A1.pdf", "status": "CUMPLE",
             "localPath": str(a1), "folderPath": "/A_Tecnicos/"},
            {"docId": 25, "docCode": "CEAP", "fileName": "", "status": "CUMPLE",
             "localPath": "", "folderPath": "/E_Otros/",
             "subFiles": [{"subId": "25a", "subCode": "CEAP-A", "subName": "Tarjeta",
                           "fileName": "CEAP-A.pdf", "status": "CUMPLE",
                           "localPath": str(ceap_a)}]},
            {"docId": 2, "docCode": "A2", "fileName": "A2.pdf", "status": "CUMPLE",
             "localPath": str(a2), "folderPath": "/A_Tecnicos/"},
        ],
    }

    res = asyncio.run(g.subir_expediente_a_sharepoint(rad))
    assert res == {"subidos": 3, "omitidos": 0, "perdidos": []}
    assert carpetas == ["RAD-T-SP-1"]
    assert any(rel.endswith("/01_A1.pdf") for rel in subidas)
    assert any("CEAP_CEAP-A_Tarjeta" in rel for rel in subidas), "sub-archivo del CEAP no subido"
    assert sum(1 for rel in subidas if "/E_Otros/" in rel) == 1

    # con filtro: solo el documento pedido
    subidas.clear()
    res2 = asyncio.run(g.subir_expediente_a_sharepoint(rad, solo_doc_id=25))
    assert res2 == {"subidos": 1, "omitidos": 0, "perdidos": []}
    assert len(subidas) == 1 and "CEAP_CEAP-A_Tarjeta" in subidas[0]

    # sin número de radicado no toca Graph
    carpetas.clear()
    res3 = asyncio.run(g.subir_expediente_a_sharepoint({"archivos": []}))
    assert res3 == {"subidos": 0, "omitidos": 0}
    assert carpetas == []


def test_archivo_registrado_sin_bytes_en_disco_se_reporta_como_perdido(tmp_path, monkeypatch):
    """Tras un reinicio la BD restaurada apunta a rutas que ya no existen: la
    subida no debe darse por completa en silencio."""
    import asyncio

    from backend.grafos import GraphService

    g = GraphService()

    async def _tok():
        return "token-falso"

    async def _drive():
        return "base-falsa"

    async def _contenido(cliente, headers, base, rel, contenido):
        return True

    async def _carpetas(numero):
        return None

    monkeypatch.setattr(g, "_obtener_token", _tok)
    monkeypatch.setattr(g, "_drive_url", _drive)
    monkeypatch.setattr(g, "_crear_carpeta_proyecto", _carpetas)
    monkeypatch.setattr(g, "_subir_contenido", _contenido)

    rad = {
        "numeroRadicado": "RAD-T-PERDIDO",
        "archivos": [
            {"docId": 1, "docCode": "A1", "fileName": "A1.pdf", "status": "CUMPLE",
             "localPath": str(tmp_path / "no_existe.pdf"), "folderPath": "/A_Tecnicos/"},
        ],
    }
    res = asyncio.run(g.subir_expediente_a_sharepoint(rad))
    assert res["subidos"] == 0
    assert res["perdidos"] == ["A1"]
