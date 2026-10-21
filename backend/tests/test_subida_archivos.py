import io
import shutil

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
