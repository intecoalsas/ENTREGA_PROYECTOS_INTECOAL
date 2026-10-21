import time

import pytest
from fastapi.testclient import TestClient

import backend.main as M


def _rad(numero, creador, estado="Radicado"):
    return {
        "id": "s-" + numero,
        "numeroRadicado": numero,
        "estado": estado,
        "fechaRadicacion": "2026-09-01T10:00:00+00:00",
        "fechaActualizacion": "2026-09-01T10:00:00+00:00",
        "metadata": {"nombreProyecto": "P", "municipio": "Tuluá",
                     "contratista": "C", "creadorEmail": creador},
        "creadorEmail": creador,
        "archivos": [],
        "historial": [],
    }


class _GraphEspia:

    def __init__(self):
        self.guardados = []
        self.eliminados = []
        self.correos = []

    async def guardar_radicacion_en_sharepoint(self, rad):
        self.guardados.append(rad.get("numeroRadicado"))
        return {"ok": True, "resumen": {}}

    async def eliminar_radicacion_de_sharepoint(self, numero):
        self.eliminados.append(numero)

    async def enviar_correo_estado(self, rad, anterior, obs):
        self.correos.append(("estado", rad.get("numeroRadicado")))
        return True

    async def enviar_correo_reesubido_revisor(self, rad):
        self.correos.append(("revisor", rad.get("numeroRadicado")))
        return True

    async def enviar_correo_reenvio_contratista(self, rad):
        self.correos.append(("contratista", rad.get("numeroRadicado")))
        return True


@pytest.fixture(scope="module")
def cliente():
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _token(cliente, email, rol):
    r = cliente.post("/api/auth/msal-verify",
                     json={"account": {"username": email}, "role": rol})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def _base_datos(monkeypatch):
    regs = [
        _rad("RAD-T-001", "b@t.com"),
        _rad("RAD-T-002", "a@t.com"),
        _rad("RAD-T-003", "b@t.com"),
    ]
    espia = _GraphEspia()
    monkeypatch.setattr(M, "radicaciones_db", regs)
    monkeypatch.setattr(M, "graph_service", espia)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    return regs, espia


def _foto(regs):
    import json
    return json.dumps(regs, sort_keys=True, default=str)


def test_a_no_borra_radicado_de_b(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    antes = _foto(regs)
    ha = _token(cliente, "a@t.com", "contratista")
    r = cliente.delete("/api/radicacion/RAD-T-001", headers=ha)
    assert r.status_code == 403
    r = cliente.delete("/api/radicacion/RAD-T-003", headers=ha)
    assert r.status_code == 403
    assert _foto(regs) == antes
    assert espia.eliminados == []
    assert espia.guardados == []


def test_estado_sin_aprobar_no_toca_sharepoint(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    ha = _token(cliente, "a@t.com", "contratista")
    hi = _token(cliente, "rev@intecoalsas.com", "interventor")
    r = cliente.patch("/api/radicacion/RAD-T-002/estado", headers=ha,
                      json={"estado": "En Revisión", "observaciones": "",
                            "usuarioEmail": "a@t.com", "usuarioNombre": "A"})
    assert r.status_code == 200
    r = cliente.patch("/api/radicacion/RAD-T-002/estado", headers=hi,
                      json={"estado": "Con Observaciones", "observaciones": "x",
                            "usuarioEmail": "r@i.com", "usuarioNombre": "R"})
    assert r.status_code == 200
    time.sleep(1.5)  
    assert espia.guardados == [], "Graph fue tocado sin Aprobado"
    r = cliente.post("/api/radicacion/RAD-T-002/sincronizar", headers=hi)
    assert r.status_code == 400
    assert espia.guardados == []


def test_aprobado_si_sube_una_vez(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    hi = _token(cliente, "rev@intecoalsas.com", "interventor")
    r = cliente.patch("/api/radicacion/RAD-T-003/estado", headers=hi,
                      json={"estado": "Aprobado", "observaciones": "ok",
                            "usuarioEmail": "r@i.com", "usuarioNombre": "R"})
    assert r.status_code == 200
    time.sleep(1.5)
    assert espia.guardados == ["RAD-T-003"]  


def test_borrar_no_ultimo_falla_aunque_sea_suyo(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    antes = _foto(regs)
    hb = _token(cliente, "b@t.com", "contratista")
    r = cliente.delete("/api/radicacion/RAD-T-001", headers=hb)
    assert r.status_code == 403
    assert _foto(regs) == antes
    assert espia.eliminados == []


def test_borrar_ultimo_propio_no_aprobado_ok(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    hb = _token(cliente, "b@t.com", "contratista")
    r = cliente.delete("/api/radicacion/RAD-T-003", headers=hb)
    assert r.status_code == 200
    assert [x["numeroRadicado"] for x in regs] == ["RAD-T-001", "RAD-T-002"]
    time.sleep(1.0)
    assert espia.eliminados == ["RAD-T-003"]


def test_borrar_ultimo_aprobado_falla(cliente, monkeypatch):
    regs = [
        _rad("RAD-T-001", "b@t.com"),
        _rad("RAD-T-009", "b@t.com", estado="Aprobado"),
    ]
    espia = _GraphEspia()
    monkeypatch.setattr(M, "radicaciones_db", regs)
    monkeypatch.setattr(M, "graph_service", espia)
    monkeypatch.setattr(M, "guardar_db", lambda: None)
    antes = _foto(regs)
    hb = _token(cliente, "b@t.com", "contratista")
    r = cliente.delete("/api/radicacion/RAD-T-009", headers=hb)
    assert r.status_code == 403
    assert _foto(regs) == antes
    assert espia.eliminados == []


def test_lista_informa_ultimo_global_para_el_boton(cliente, monkeypatch):
    regs, espia = _base_datos(monkeypatch)
    ha = _token(cliente, "a@t.com", "contratista")
    r = cliente.get("/api/radicacion/lista", headers=ha)
    assert r.status_code == 200
    assert r.json()["ultimoGlobal"]["numeroRadicado"] == "RAD-T-003"
    assert all(x["creadorEmail"] == "a@t.com" for x in r.json()["data"])
