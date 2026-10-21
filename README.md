# Portal de Radicación INTECOAL S.A.S.

Sistema de gestión de radicación de expedientes técnicos para la **verificación RETILAP** (Alumbrado Público) bajo la Resolución 40150 de 2024 y RETIE.

El portal permite al **contratista** radicar los 25 requisitos RETILAP, y al **revisor (interventoría)** evaluarlos, emitir dictamen y generar el **Informe de Recibido a Conformidad**, con firma electrónica, notificaciones por correo y persistencia en **SharePoint** de Microsoft 365.

Módulos del revisor: **Evaluación**, **Formato 4.3.7 C**, **Recibo Técnico** y **Calendario** de plazos de revisión (15 días hábiles con alertas), con las listas **Próximos a vencer** y **Vencidos** y correos automáticos diarios cuando un radicado pasa de plazo.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4 + MSAL + `@cadview/react` (visor CAD).
- **Backend:** Python FastAPI + httpx + python-jose + python-dotenv.
- **Servicios:** Microsoft Graph API (SharePoint Online + correo Outlook).

## 📚 Documentación

Todo el detalle está organizado y numerado en orden de lectura en la carpeta [`docs/`](docs/README.md):

| # | Documento | Contenido |
|---|-----------|-----------|
| 01 | [01_ARQUITECTURA.md](docs/01_ARQUITECTURA.md) | Arquitectura, estructura y stack técnico |
| 02 | [02_INICIO-RAPIDO.md](docs/02_INICIO-RAPIDO.md) | Requisitos y puesta en marcha local |
| 03 | [03_FLUJO.md](docs/03_FLUJO.md) | Roles, flujo de trabajo, estados y notificaciones |
| 04 | [04_MANUAL-CONTRATISTA.md](docs/04_MANUAL-CONTRATISTA.md) | Manual del Contratista |
| 05 | [05_MANUAL-REVISOR.md](docs/05_MANUAL-REVISOR.md) | Manual del Revisor |
| 06 | [06_API.md](docs/06_API.md) | Referencia de endpoints REST |
| 07 | [07_DEPLOYMENT.md](docs/07_DEPLOYMENT.md) | Despliegue en Netlify y Render.com |
| 08 | [08_SECURITY.md](docs/08_SECURITY.md) | Seguridad y autenticación |
| 09 | [09_DICCIONARIO-DATOS.md](docs/09_DICCIONARIO-DATOS.md) | Diccionario de datos y campos |

## Instalación rápida

```bash
# 1. Backend (lee el .env desde la raíz del proyecto)
copy .env.example .env          # Windows (Linux/Mac: cp .env.example .env)
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# 2. Frontend
npm install
npm run dev                     # http://localhost:5173
```

Para el detalle completo, ver [docs/02_INICIO-RAPIDO.md](docs/02_INICIO-RAPIDO.md).

---
Proyecto privado — INTECOAL S.A.S. / SENA
