from fastapi.testclient import TestClient

import backend.main as M


def _radicado():
    return {
        "id": "L-1",
        "numeroRadicado": "RAD-T-LIG",
        "estado": "Radicado",
        "fechaRadicacion": "2026-09-01T10:00:00+00:00",
        "creadorEmail": "c@t.com",
        "metadata": {
            "nombreProyecto": "P",
            "municipio": "Tuluá",
            "contratista": "C",
            "creadorEmail": "c@t.com",
            "firmaContratista": {"dataUrl": "data:image/jpeg;base64,AAAA", "nombreSignatario": "X"},
            "firmaInterventoria": {"dataUrl": "data:image/jpeg;base64,BBBB", "nombreSignatario": "Y"},
        },
        "archivos": [],
        "historial": [],
    }


def _tok(cliente, rol="interventor"):
    r = cliente.post("/api/auth/msal-verify",
                     json={"account": {"username": "rev@intecoalsas.com"}, "role": rol})
    return r.json()["token"]


def test_lista_omite_firmas_y_detalle_las_incluye(monkeypatch):
    with TestClient(M.app) as c:
        tok = _tok(c)
        monkeypatch.setattr(M, "radicaciones_db", [_radicado()])

        r = c.get("/api/radicacion/lista", headers={"Authorization": "Bearer " + tok})
        assert r.status_code == 200
        meta = r.json()["data"][0]["metadata"]
        assert "firmaContratista" not in meta
        assert "firmaInterventoria" not in meta
        assert meta["nombreProyecto"] == "P"

        d = c.get("/api/radicacion/RAD-T-LIG", headers={"Authorization": "Bearer " + tok})
        assert d.status_code == 200
        assert d.json()["data"]["metadata"]["firmaContratista"]["nombreSignatario"] == "X"
