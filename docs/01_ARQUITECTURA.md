# Arquitectura y Stack Técnico

## Visión general

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Netlify) — React 19 + Vite + Tailwind CSS 4  │
│  src/  (SPA de una sola página, MSAL auth M365)         │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API (/api/*)
                           │ (en dev: proxy de Vite → localhost:8000)
┌──────────────────────────▼──────────────────────────────┐
│  BACKEND (Render.com) — Python FastAPI                  │
│  backend/main.py │ modelos.py │ grafos.py               │
│  Persistencia local: backend/data/radicaciones.json     │
└──────────────────────────┬──────────────────────────────┘
                           │ Microsoft Graph API
┌──────────────────────────▼──────────────────────────────┐
│  SERVICIOS M365 (SharePoint Online)                     │
│  Lista de radicaciones │ Drive de documentos │ Outlook  │
└─────────────────────────────────────────────────────────┘
```

- **Frontend (SPA):** React 19, Vite, Tailwind CSS 4, MSAL `@azure/msal-browser`, `lucide-react`, `motion`, `jszip`, `html-to-image` + `jspdf` (PDF de formatos), `@cadview/react` (visor DXF).
- **Backend:** FastAPI con httpx (Graph API), python-jose (JWT), python-dotenv.
- **Persistencia:** JSON local (`backend/data/radicaciones.json`, única fuente de escritura) + **sincronización a SharePoint Online solo al aprobar** (fila + carpetas + archivos) y **formatos solo con su botón Subir**.
- **Tareas en background:** `lanzar_background()` (correos + SharePoint sin bloquear la respuesta) y `vigilar_vencimientos()` (alertas de plazo: cada 1 h evalúa los plazos y, de lunes a viernes entre las 8:00 y 8:59 a.m. hora Colombia, envía **un solo correo** al revisor con el resumen de vencidos y por vencer; los avisos de 8/4 días van incluidos en ese mismo correo y se marcan una sola vez).

## Estructura del proyecto

```
portal_intecoal/
├── backend/
│   ├── main.py               # API FastAPI (endpoints, CORS, JWT, MIME, archivado, watcher)
│   ├── modelos.py            # Catálogo de 25 docs RETILAP, estados, días hábiles, helpers
│   ├── grafos.py             # GraphService: SharePoint + correo + Graph API
│   ├── requirements.txt      # Dependencias Python
│   ├── data/radicaciones.json# Persistencia local de radicaciones
│   └── uploads/              # Archivos subidos por radicado
├── src/                      # Frontend React (SPA)
│   ├── App.jsx               # Enrutador de pestañas, estado global, manejo de errores
│   ├── main.jsx / index.css  # Punto de entrada y estilos
│   ├── types.ts              # Tipos TypeScript
│   ├── components/
│   │   ├── LoginForm.jsx     # Login M365 (MSAL)
│   │   ├── Sidebar.jsx / Header.jsx
│   │   ├── RadicacionForm.jsx        # Wizard de radicación / edición
│   │   ├── RadicacionesList.jsx      # Histórico de radicaciones
│   │   ├── EvaluacionRadicacion.jsx  # Evaluación item por item (revisor)
│   │   ├── InformeRecibidoConformidad.jsx  # Informe digital imprimible
│   │   ├── Formato437C.jsx           # Formato 4.3.7 C (revisor, por radicado)
│   │   ├── ReciboTecnico.jsx         # Recibo Técnico (revisor, por radicado)
│   │   ├── MembreteCorporativo.jsx   # Membrete + franja (#4E3629/#D9CF43) compartidos
│   │   ├── CalendarioRevision.jsx    # Calendario de plazos 15 días hábiles (revisor) + listas "Próximos a vencer" y "Vencidos"
│   │   ├── DocumentPreviewModal.jsx  # Visor PDF/imagen/DXF/DWG
│   │   ├── CadViewerLazy.jsx         # Visor CAD (DXF) vía @cadview/react
│   │   ├── FirmaDigitalModal.jsx     # Firma electrónica (dibujar/texto/imagen)
│   │   ├── ErrorBoundary.jsx         # Captura de errores de render
│   │   └── IntecoalLogo.jsx
│   ├── data/documentsCatalog.js      # Catálogo de 25 documentos (frontend)
│   └── lib/
│       ├── api.js            # apiFetch (proxy /api, JWT, expiración de sesión)
│       ├── msalConfig.js     # Cliente MSAL, roles por dominio, helpers
│       ├── imagenesMembrete.js  # Logo, firma del jefe e iconos como data URI (182 KB)
│       └── zipExporter.js    # Exportar ZIP del expediente
├── public/
│   ├── favicon.ico / favicon.png / apple-touch-icon.png   # Generados desde LOGO_MEMBRETE
│   └── recibo-tecnico/    # Logo, iconos, firma y figuras del membrete (fuente de los data URI)
├── vite.config.ts            # Config Vite + proxy /api
├── package.json              # Dependencias y scripts Node
├── .env.local                # Variables de entorno del frontend (gitignored)
├── docs/                     # Documentación (este índice)
└── dist/                     # Build de producción (generado)
```

## Tabla de tecnologías

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Frontend | React 19 + Vite | SPA, desarrollo y build |
| Frontend | Tailwind CSS 4 | Estilos utilitarios |
| Frontend | @azure/msal-browser | Autenticación M365 |
| Frontend | @cadview/react | Visor CAD (DXF) |
| Backend | Python FastAPI | API REST, CORS, JWT |
| Backend | httpx | Cliente HTTP async para Graph API |
| Backend | python-jose | JWT tokens (HS256) |
| Infra | Netlify | Hosting frontend estático |
| Infra | Render.com | Hosting backend Python |
| Servicios | Microsoft Graph API | SharePoint, correo, Azure AD |

---

Siguiente: [02_INICIO-RAPIDO.md](02_INICIO-RAPIDO.md) — puesta en marcha local.
