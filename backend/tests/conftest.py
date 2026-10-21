"""Aislamiento de tests: la DB real y SharePoint no se tocan.

El lifespan de FastAPI (TestClient) carga la DB al arrancar. Sin este aislamiento,
correr los tests reescribia backend/data/radicaciones.json de verdad (por eso el
"vaciado" se habia perdido: pytest importo 18 radicados desde SharePoint al JSON real).
"""
import tempfile
from pathlib import Path

import backend.grafos as G
import backend.main as M

M.DATA_FILE = Path(tempfile.mkdtemp(prefix="radicados-test-")) / "radicaciones.json"


async def _sin_sharepoint(self):
    return []


async def _columnas_ok(self):
    return None


G.GraphService.cargar_radicaciones_desde_sharepoint = _sin_sharepoint
G.GraphService.asegurar_columna_rawjson = _columnas_ok
