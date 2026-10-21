# Seguridad

## Autenticación

El acceso al portal es **exclusivamente con cuenta de Microsoft 365 (MSAL)**. No existe "Ingreso Directo".

### JWT de sesión (obligatorio en la API)

Tras el login M365, el frontend pide `POST /api/auth/msal-verify` (`{account: {username}, role}`) y guarda el JWT (`m365_jwt`). **Todos** los endpoints de negocio exigen `Authorization: Bearer <jwt>` (o `?token=` solo para el visor `<img>/<iframe>`); sin token válido responden **401** y el frontend (`src/lib/api.js` → `apiFetch`) limpia la sesión y vuelve al ingreso. El endpoint abierto `POST /api/auth/token` (emitía roles arbitrarios) fue **eliminado**.

El backend valida además el rol por endpoint: dictamen final (`Aprobado`/`Con Observaciones`), sincronización y revisión de vencimientos exigen `interventor`; eliminar exige `contratista` creador del último consecutivo; el contratista solo accede a sus radicados (obtener/historial/ver-archivo). La identidad del creador y del historial la impone el JWT, nunca el formulario.

### MSAL (Microsoft Authentication Library)

- **Librería:** `@azure/msal-browser` (instalada, no CDN).
- **Flujo:** `loginRedirect` con `select_account` → cuenta M365 → backend verifica (`/api/auth/msal-verify`) → JWT de sesión.
- **Configuración** (en `src/lib/msalConfig.js`, valores desde `import.meta.env.*`):
  - `VITE_MSAL_CLIENT_ID` — Client ID de la app de Azure AD.
  - `VITE_MSAL_TENANT_ID=common` — Tenant (multi-tenant).
  - `VITE_MSAL_REDIRECT_URI` — URL del frontend; debe coincidir con la URI registrada en Azure AD.
- **Cache:** `localStorage` con `storeAuthStateInCookie: true`.
- **Timeouts:** `windowHashTimeout = 180000` (3 min) para popups con MFA lento.

### JWT (JSON Web Token)

- **Algoritmo:** HS256.
- **Expiración:** 24 horas (`TOKEN_EXPIRE_HOURS`).
- **Almacenamiento:** `sessionStorage`.
- **Header:** `Authorization: Bearer <token>`.

#### Variables requeridas (backend)

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave para firmar JWT (mín. 32 caracteres). |
| `ALGORITHM` | `HS256` (constante en `backend/main.py`). |
| `TOKEN_EXPIRE_HOURS` | `24` (constante). |

### Persistencia de sesión en el navegador
- `m365_user_session` + `active_tab` (sessionStorage) restauran la sesión al recargar la pestaña.
- El rol se guarda **solo en `sessionStorage`** (`pending_msal_role`) para que se limpie al cerrar la pestaña y no quede "pegado" entre sesiones.

---

## Autorización — Roles por dominio

Los dominios de correo determinan el rol. La función `isRevisorAllowedEmail`/`validateRoleEmail` en `src/lib/msalConfig.js` valida el lado del cliente; el backend también valida el rol.

| Rol | Dominio permitido | Permisos |
|-----|-------------------|----------|
| **Revisor / Interventor** | `@intecoalsas.com`, `@intecoal.com.co` | Evaluar, dictaminar, firmar informe, sincronizar a SharePoint. |
| **Contratista / Creador** | Cualquier correo M365 | Crear radicaciones, subir/corregir archivos, firmar declaración, ver sus radicaciones. |

Reglas de acceso en el frontend:
- El botón **"Evaluar"** solo aparece para el rol revisor y si el radicado **no** está `Aprobado`.
- El botón **"Recibo Técnico"** solo aparece para el rol revisor y si el radicado está `Aprobado`.
- El botón **"Eliminar"** (contratista) solo aparece en el **último radicado global**, si es el creador y no está aprobado.
- El botón **"Editar"** (contratista) solo aparece si el radicado está `Con Observaciones`.
- Los módulos **Formato 4.3.7 C**, **Recibo Técnico** y **Calendario** son exclusivos del revisor (el contratista es redirigido al Historial).
- La columna **estado** es de solo lectura (no editable desde la lista).
- La **firma de interventoría** es obligatoria para finalizar con `Aprobado` o `Con Observaciones`.
- La **firma del contratista** es obligatoria al crear una radicación.

---

## CORS

El backend configura CORS de forma restringida (no `*` en producción).

```python
FRONTEND_URL = os.getenv("FRONTEND_URL")  # https://<tu-sitio>.netlify.app
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
# métodos: GET, POST, PATCH, DELETE, OPTIONS
```

**Nunca usar `allow_origins=["*"]` en producción.**

---

## Validación de Archivos

### MIME Types permitidos (server-side, `backend/main.py`)

```
application/pdf
image/jpeg, image/png, image/tiff, image/bmp, image/gif
application/dwg, application/dxf, application/x-dwg, application/x-dxf
application/acad, application/octet-stream
```

### Límites

| Parámetro | Valor |
|-----------|-------|
| Validación | Server-side en `POST /api/radicacion/nueva` y `POST /api/radicacion/{id}/archivo` |

> En el visor, DWG/DXF/DWF no se renderizan en el navegador; DXF se previsualiza (`@cadview/react`) y otros CAD se ofrecen para descargar.

---

## Firma Digital

- **Formatos:** dibujada (canvas), tipográfica (texto) o imagen (PNG).
- **Formato guardado:** `data:image/png;base64,...`.
- **Hash de verificación:** derivado del contenido + fecha + firmante (`hashVerificacion`).
- **Almacenamiento:** en la metadata de la radicación (`firmaContratista`, `firmaInterventoria`).

```jsonc
{
  "dataUrl": "data:image/png;base64,...",
  "hashVerificacion": "a1b2c3d4e5f6...",
  "nombreSignatario": "Anyeli Cabezas",
  "fechaFirma": "2026-01-15T10:30:00Z",
  "tipoFirma": "dibujada | texto | imagen",
  "tarjetaProfesional": "..." // opcional (revisor)
}
```

---

## SharePoint

- **SharePoint Online** actúa como respaldo persistente de radicaciones y documentos.
- **Política de subida:** solo lo **aprobado** (fila + carpetas + archivos) y los formatos solo con su botón **Subir**. Todo corre en background; `m365Synced` refleja el estado real y existe reintento manual (`POST /api/radicacion/{id}/sincronizar`).
- Los correos y la subida de archivos usan la **Microsoft Graph API** (`backend/grafos.py` → `GraphService`).

### Permisos de la app de Azure AD (Application)

| Permiso | Descripción |
|---------|-------------|
| `Sites.ReadWrite.All` | Leer/escribir sitios de SharePoint |
| `Files.ReadWrite.All` | Subir archivos a librerías/documentos |
| `Mail.Send` | Enviar correos vía Outlook/Graph |

---

## Variables de Entorno

### Backend (`.env` en la raíz del proyecto)

```bash
SECRET_KEY=<aleatoria-32+>
FRONTEND_URL=https://<tu-sitio>.netlify.app
ALLOWED_ORIGINS=<origenes separados por coma>

AZURE_CLIENT_ID=<client-id>
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_SECRET=<client-secret>

SHAREPOINT_SITE_ID=<site-id>
SHAREPOINT_LIST_ID=<list-id>
SHAREPOINT_LIBRARY_ID=Documentos_Radicacion

M365_SENDER_EMAIL=coord.tecnico@intecoalsas.com
M365_NOTIFICATION_RECIPIENT=coord.tecnico@intecoalsas.com  # revisor: avisos de nuevo radicado y vencimientos

POWER_AUTOMATE_WEBHOOK_URL=<webhook-url>   # opcional
```

### Frontend (`.env.local`, gitignored)

```bash
VITE_MSAL_CLIENT_ID=<client-id>
VITE_MSAL_TENANT_ID=common
VITE_MSAL_REDIRECT_URI=https://<tu-sitio>.netlify.app
VITE_API_DIRECT_URL=https://radicados-intecoal-sas.onrender.com   # opcional: subidas pesadas directas al backend
```

---

## Buenas prácticas

1. **Generar `SECRET_KEY` aleatoria:**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. **No commitear `.env` ni `.env.local`:** agregar a `.gitignore`.
3. **HTTPS obligatorio** en todos los entornos (Netlify y Render lo proveen por defecto).
4. **Rotar secretos:** renovar `AZURE_CLIENT_SECRET` cada 6–12 meses.
5. **Entorno/dominios:** el rol de revisor exige dominio INTECOAL; no habilitar dominios externos para revisoría.
6. **Auditoría:** revisar periódicamente logs de acceso y el historial de cambios de estado de las radicaciones.
