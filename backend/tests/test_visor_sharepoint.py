from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import backend.main as M
from backend.grafos import GraphService


def _rad(local_path, sub_local=None):
    subs = []
    if sub_local is not None:
        subs = [{"subId": "25a", "subCode": "CEAP-A", "subName": "Tarjeta", "fileName": "tarjeta.pdf",
                 "fileType": "application/pdf", "status": "CUMPLE", "localPath": sub_local}]
    return {
        "id": "s-vis-1",
        "numeroRadicado": "RAD-VIS-001",
        "estado": "En Revisión",
        "metadata": {"creadorEmail": "b@t.com"},
        "creadorEmail": "b@t.com",
        "archivos": [
            {"docId": 14, "docCode": "B14", "fileName": "certificado.pdf", "fileType": "application/pdf",
             "status": "CUMPLE", "localPath": local_path, "folderPath": "/B_Certificaciones/"},
            {"docId": 25, "docCode": "CEAP", "fileName": "", "status": "CUMPLE", "localPath": "",
             "subFiles": subs},
        ],
        "historial": [],
    }


class _GraphDescarga:
    def __init__(self, contenido):
        self.contenido = contenido
        self.llamadas = []

    async def descargar_archivo(self, numero, archivo, sub=None):
        self.llamadas.append((numero, archivo.get("docCode"), sub.get("subId") if sub else None))
        return self.contenido


@pytest.fixture
def cliente():
    with TestClient(M.app, raise_server_exceptions=False) as c:
        yield c


def _token(cliente):
    r = cliente.post("/api/auth/msal-verify",
                     json={"account": {"username": "b@t.com"}, "role": "contratista"})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_ruta_de_descarga_es_la_misma_que_la_de_subida():
    g = GraphService()
    a = {"docId": 1, "docCode": "A1", "fileName": "certificado final.pdf", "folderPath": "/A_Tecnicos/"}
    assert g._ruta_archivo("RAD-1", a) == "Documentos_Radicacion/RAD-1/A_Tecnicos/01_A1_certificado_final.pdf"
    ceap = {"docId": 25, "docCode": "CEAP", "fileName": ""}
    sub = {"subId": "25a", "subCode": "CEAP-A", "subName": "Tarjeta"}
    assert g._ruta_archivo("RAD-1", ceap, sub) == (
        "Documentos_Radicacion/RAD-1/E_Otros/Documentos para circuitos exclusivos de AP/CEAP_CEAP-A_Tarjeta"
    )


def test_visor_recupera_de_sharepoint_si_no_esta_en_disco(cliente, monkeypatch, tmp_path):
    local = tmp_path / "carpeta" / "certificado.pdf"
    monkeypatch.setattr(M, "radicaciones_db", [_rad(str(local))])
    espia = _GraphDescarga(b"%PDF-1.4 desde sharepoint")
    monkeypatch.setattr(M, "graph_service", espia)
    r = cliente.get("/api/files/view/s-vis-1/14", headers=_token(cliente))
    assert r.status_code == 200, r.text
    assert r.content == b"%PDF-1.4 desde sharepoint"
    assert espia.llamadas == [("RAD-VIS-001", "B14", None)]
    assert local.exists() and local.read_bytes() == b"%PDF-1.4 desde sharepoint"


def test_visor_sub_archivo_recupera_de_sharepoint(cliente, monkeypatch, tmp_path):
    monkeypatch.setattr(M, "radicaciones_db", [_rad("", sub_local=str(tmp_path / "no.pdf"))])
    espia = _GraphDescarga(b"%PDF-1.4 sub")
    monkeypatch.setattr(M, "graph_service", espia)
    r = cliente.get("/api/files/view/s-vis-1/25?subId=25a", headers=_token(cliente))
    assert r.status_code == 200, r.text
    assert r.content == b"%PDF-1.4 sub"
    assert espia.llamadas == [("RAD-VIS-001", "CEAP", "25a")]


def test_visor_sin_disco_ni_sharepoint_responde_404(cliente, monkeypatch, tmp_path):
    monkeypatch.setattr(M, "radicaciones_db", [_rad(str(tmp_path / "no.pdf"))])
    monkeypatch.setattr(M, "graph_service", _GraphDescarga(None))
    r = cliente.get("/api/files/view/s-vis-1/14", headers=_token(cliente))
    assert r.status_code == 404
    assert "SharePoint" in r.json()["detail"]
