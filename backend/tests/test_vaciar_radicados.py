from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import backend.main as M


class _GraphVaciar:
    def __init__(self):
        self.filas = []
        self.carpetas = []
        self.respaldos = 0

    async def eliminar_radicacion_de_sharepoint(self, numero):
        self.filas.append(numero)

    async def eliminar_carpeta_radicado(self, numero):
        self.carpetas.append(numero)

    async def subir_backup_db(self, contenido):
        self.respaldos += 1
        return True


@pytest.fixture
def cliente():
    with TestClient(M.app, raise_server_exceptions=False) as c:
        yield c


def _token(cliente, email="rev@intecoalsas.com", rol="interventor"):
    r = cliente.post("/api/auth/msal-verify",
                     json={"account": {"username": email}, "role": rol})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def _datos(monkeypatch, tmp_path):
    regs = [
        {"id": "v-1", "numeroRadicado": "RAD-V-001", "estado": "Aprobado"},
        {"id": "v-2", "numeroRadicado": "RAD-V-002", "estado": "En Revisión"},
    ]
    monkeypatch.setattr(M, "radicaciones_db", regs)
    espia = _GraphVaciar()
    monkeypatch.setattr(M, "graph_service", espia)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    for rid in ("v-1", "v-2"):
        carpeta = M.UPLOADS_DIR / rid
        carpeta.mkdir(parents=True, exist_ok=True)
        (carpeta / "doc.pdf").write_bytes(b"%PDF-1.4")
    return regs, espia


def test_reporte_no_borra_nada(cliente, monkeypatch, tmp_path):
    regs, espia = _datos(monkeypatch, tmp_path)
    r = cliente.post("/api/m365/vaciar-radicados", headers=_token(cliente))
    assert r.status_code == 200
    data = r.json()
    assert data["confirmado"] is False and data["total"] == 2
    assert [x["numeroRadicado"] for x in data["a_eliminar"]] == ["RAD-V-001", "RAD-V-002"]
    assert espia.filas == [] and espia.carpetas == []
    assert len(regs) == 2
    assert (M.UPLOADS_DIR / "v-1" / "doc.pdf").exists()


def test_confirmado_vacia_todo(cliente, monkeypatch, tmp_path):
    regs, espia = _datos(monkeypatch, tmp_path)
    r = cliente.post("/api/m365/vaciar-radicados?confirmar=true", headers=_token(cliente))
    assert r.status_code == 200
    data = r.json()
    assert data["eliminados"] == 2 and data["fallos"] == [] and data["respaldo"] is True
    assert espia.filas == ["RAD-V-001", "RAD-V-002"]
    assert espia.carpetas == ["RAD-V-001", "RAD-V-002"]
    assert regs == []
    assert not (M.UPLOADS_DIR / "v-1").exists() and not (M.UPLOADS_DIR / "v-2").exists()
    assert espia.respaldos == 1
