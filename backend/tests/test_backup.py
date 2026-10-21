import asyncio
import json

import backend.main as M


class _GrafosFalso:
    def __init__(self):
        self.subidas = []
        self.descargas = []
        self.ok = True

    async def subir_backup_db(self, contenido):
        self.subidas.append(contenido)
        return self.ok

    async def descargar_backup_db(self):
        if self.descargas:
            return self.descargas.pop(0)
        return None


def _rad(numero):
    return {
        "id": "bk-" + numero,
        "numeroRadicado": numero,
        "estado": "Radicado",
        "fechaRadicacion": "2026-10-21T10:00:00+00:00",
        "metadata": {"nombreProyecto": "P-" + numero},
        "creadorEmail": "c@t.com",
        "notifVencimiento": {},
    }


def _arrancar_backup(monkeypatch, radicados):
    g = _GrafosFalso()
    monkeypatch.setattr(M, "graph_service", g)
    monkeypatch.setattr(M, "radicaciones_db", radicados)
    monkeypatch.setattr(M, "_backup_pendiente", False)
    monkeypatch.setattr(M, "_backup_activo", False)
    monkeypatch.setattr(M, "BACKUP_RETARDO", 0.0)
    return g


def test_guardar_db_dispara_respaldo_a_sharepoint(monkeypatch):
    g = _arrancar_backup(monkeypatch, [_rad("RAD-BK-001")])

    async def _flujo():
        M.guardar_db()
        await asyncio.sleep(0.05)

    asyncio.run(_flujo())
    assert len(g.subidas) >= 1
    datos = json.loads(g.subidas[-1].decode("utf-8"))
    assert datos[0]["numeroRadicado"] == "RAD-BK-001"
    assert M.DATA_FILE.exists()


def test_ciclo_coalesce_varios_guardados_en_una_subida(monkeypatch):
    g = _arrancar_backup(monkeypatch, [_rad("RAD-BK-002")])

    async def _flujo():
        for _ in range(5):
            M.guardar_db()
        await asyncio.sleep(0.05)

    asyncio.run(_flujo())
    assert len(g.subidas) == 1


def test_restaurar_desde_respaldo_recupera_todos(monkeypatch):
    respaldo = json.dumps([_rad("RAD-BK-R1"), _rad("RAD-BK-R2")]).encode("utf-8")
    g = _arrancar_backup(monkeypatch, [])
    g.descargas = [respaldo]

    async def _flujo():
        n = await M.restaurar_backup_sharepoint()
        await asyncio.sleep(0.05)
        return n

    n = asyncio.run(_flujo())
    assert n == 2
    assert [r["numeroRadicado"] for r in M.radicaciones_db] == ["RAD-BK-R1", "RAD-BK-R2"]
    assert len(g.subidas) >= 1
    restaurado = json.loads(g.subidas[-1].decode("utf-8"))
    assert len(restaurado) == 2


def test_restaurar_sin_respaldo_deja_base_vacia(monkeypatch):
    g = _arrancar_backup(monkeypatch, [])
    n = asyncio.run(M.restaurar_backup_sharepoint())
    assert n == 0
    assert M.radicaciones_db == []
    assert g.subidas == []


def test_restaurar_respaldo_corrupto_no_tumba_el_arranque(monkeypatch):
    g = _arrancar_backup(monkeypatch, [])
    g.descargas = [b"no-es-json"]

    async def _flujo():
        n = await M.restaurar_backup_sharepoint()
        await asyncio.sleep(0.05)
        return n

    n = asyncio.run(_flujo())
    assert n == 0
    assert M.radicaciones_db == []


def test_guardar_db_sin_graph_service_no_programa_respaldo(monkeypatch):
    monkeypatch.setattr(M, "graph_service", None)
    monkeypatch.setattr(M, "radicaciones_db", [_rad("RAD-BK-LOC")])
    monkeypatch.setattr(M, "_backup_pendiente", False)
    M.guardar_db()
    assert M._backup_pendiente is False
    assert M.DATA_FILE.exists()
