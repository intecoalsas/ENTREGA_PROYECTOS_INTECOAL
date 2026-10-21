# Inicio Rápido — Puesta en Marcha Local

## Requisitos

- **Python 3.10+**
- **Node.js 18+** (para el frontend React/Vite)
- Ambiente virtual Python (recomendado): `.venv/` ya incluido en el repo

## 1. Backend

```bash
# En la raíz del proyecto
pip install -r backend/requirements.txt

# Crear variables de entorno desde la plantilla (está en la RAÍZ)
copy .env.example .env          # Windows (Linux/Mac: cp .env.example .env)
# Editar .env con las credenciales reales de Azure/M365

# Iniciar en el puerto 8000 (UNA sola instancia: el JSON local no tiene
# bloqueo; dos servidores a la vez pueden sobrescribirse y resucitar filas)
uvicorn backend.main:app --reload --port 8000
```

> **Importante:** el backend lee el archivo `.env` en la **raíz** del proyecto (no dentro de `backend/`), mediante `load_dotenv(Path(...).parent.parent / ".env")`. Ver [08_SECURITY.md](08_SECURITY.md) para la lista completa de variables.

## 2. Frontend

```bash
# Instalar dependencias de Node (una vez)
npm install

# Crear variables de entorno del frontend
# .env.local (gitignored):
#   VITE_MSAL_CLIENT_ID=<client-id-azure>
#   VITE_MSAL_TENANT_ID=common
#   VITE_MSAL_REDIRECT_URI=http://localhost:5173

# Iniciar servidor de desarrollo
npm run dev        # http://localhost:5173
```

> El servidor de Vite redirige `/api/*` a `http://localhost:8000` (proxy configurado en `vite.config.ts`).

## Scripts útiles (frontend)

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Build de producción → `dist/` |
| `npm run preview` | Previsualizar el build |
| `npm run lint` | Verificación de tipos (`tsc --noEmit`) |
| `npm test` | Tests del frontend (Vitest) |

## Tests (backend)

```bash
python -m pytest backend/tests -q     # unitarios (plazos, vencimientos, permisos)
```

## Verificación rápida

1. Backend arriba en `http://localhost:8000` → `GET /api/health` responde `{"status":"ok"}`.
2. Abre `http://localhost:5173`, inicia sesión con una cuenta M365.
3. Los roles se asignan automáticamente según el dominio del correo (ver [03_FLUJO.md](03_FLUJO.md)).

---

Siguiente: [03_FLUJO.md](03_FLUJO.md) — cómo se trabaja con el sistema.
