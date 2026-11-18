# Referencia API REST

- **Base URL (desarrollo):** `http://localhost:8000` (el frontend de Vite proxifica `/api/*` a esta URL).
- **Base URL (producción):** `https://entrega-proyectos-intecoal.onrender.com`

Todos los endpoints de negocio viven bajo el prefijo `/api`.

---

## Autenticación

La autenticación es mediante **cuenta de Microsoft 365 (MSAL)**. El frontend obtiene el identificador de la cuenta M365 y lo verifica en el backend para generar un JWT de sesión.

Todas las peticiones autenticadas llevan el header (inyectado por `src/lib/api.js`):

```
Authorization: Bearer <jwt_token>
```

Sin token válido → **401** y el frontend devuelve al ingreso. El visor de archivos (`<img>`/`<iframe>`) usa `?token=` como alternativa. El `email`/`rol` ya no se aceptan como parámetros: salen del JWT.

### POST /api/auth/token

Genera un token JWT a partir de identidad de sesión (flujo no-M365 / verificación de sesión).

```jsonc
// Request
{
  "email": "contratista@empresa.com",
  "company": "SENA",
  "role": "contratista"
}

// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "email": "...", "company": "SENA", "role": "contratista" }
}
```

### POST /api/auth/msal-verify

Verifica la sesión/cuenta de Microsoft 365, valida el rol solicitado y devuelve el usuario autenticado **con su JWT**.

```jsonc
// Request
{
  "account": { "username": "contratista@empresa.com" },
  "role": "contratista"   // "interventor" exige dominio INTECOAL o responde 403
}

// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "isAuthenticated": true, "name": "...", "email": "...", "role": "contratista", "company": "..." }
}
```

> **Roles por dominio (validados en el backend y en `src/lib/msalConfig.js`):**
> - Revisor/Interventor: `@intecoalsas.com`, `@intecoal.com.co`
> - Contratista/Creador: cualquier correo M365

---

## Salud y Catálogo

### GET /api/health

```jsonc
// 200
{ "status": "ok", "timestamp": "2026-01-15T10:30:00Z" }
```

### GET /api/documentos/catalogo

Devuelve el catálogo de los 25 documentos RETILAP.

```jsonc
// 200
{
  "data": [
    {
      "id": 1,
      "code": "A1",
      "name": "Diseño fotométrico aprobado",
      "description": "...",
      "category": "diseno",
      "folderGroup": "A_Tecnicos"   // A_Tecnicos | B_Certificaciones | C_Contractuales | D_Inventario | E_Otros
    }
  ],
  "total": 25
}
```

---

## Radicaciones

### GET /api/radicacion/lista

Lista radicaciones con filtros. El **contratista** solo ve sus propias radicaciones; el **revisor** ve todas.

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `email` | string | Filtrar por correo del creador |
| `rol` | string | Rol del usuario (`interventor` o `contratista`) |
| `search` | string | Búsqueda por radicado, código, nombre, contratista, municipio |
| `municipio` | string | Filtrar por municipio |
| `estado` | string | Filtrar por estado (`Radicado`, `En Revisión`, `Con Observaciones`, `Aprobado`) |
| `tipo` | string | Filtrar por tipo de entrega (`Inicio`, `Subsanación`) |

```jsonc
// 200
{
  "data": [
    {
      "id": "abc-123",
      "numeroRadicado": "RAD-2026-0001",
      "estado": "Radicado",
      "documentosOk": 5,
      "porcentajeCumplimiento": 23,
      "metadata": { "..." },
      "archivos": [ "..." ],
      "historial": [ { "estado": "Radicado", "fecha": "...", "usuario": "..." } ]
    }
  ],
  "total": 3,
  "ultimoGlobal": { "id": "abc-999", "numeroRadicado": "RAD-2026-0021" }
}
```

> `ultimoGlobal` es el último consecutivo de **todas** las cuentas (el contratista solo recibe lo suyo en `data`, pero necesita este dato para mostrar/ocultar "Eliminar").

### GET /api/radicacion/{identificador}

Obtiene una radicación por **ID** o por **número de radicado**.

```jsonc
// 200
{
  "data": {
    "id": "abc-123",
    "numeroRadicado": "RAD-2026-0001",
    "metadata": { "..." },
    "archivos": [ "..." ],
    "elementosEntregados": [ "..." ],
    "historial": [ "..." ]
  }
}
```

### GET /api/radicacion/{identificador}/historial

Devuelve el historial de cambios de estado de una radicación.

```jsonc
// 200
{
  "data": [
    { "estado": "Radicado", "fecha": "...", "usuario": "...", "usuarioNombre": "...", "observaciones": "" },
    { "estado": "Con Observaciones", "fecha": "...", "usuario": "...", "usuarioNombre": "...", "observaciones": "..." }
  ]
}
```

### POST /api/radicacion/nueva

Crea una nueva radicación (**multipart/form-data**, parseo manual de los campos).

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `metadatos` | string (JSON) | Sí | Metadata del proyecto (incluye `creadorEmail`, `creadorName`, `firmaContratista`). |
| `elementos` | string (JSON) | No | Array de elementos entregados. |
| `naDocs` | string (JSON) | No | Array de IDs de docs marcados N/A. |
| `docsAdicionales` | string (JSON) | No | Array de objetos para documentos manuales. |
| `archivo_{CODE}` | File[] | No | Archivos por código (`archivo_A1`, `archivo_custom_{id}` para manuales). |
| `extraSub_{docId}_{i}` + `extraSubMeta_{docId}_{i}` | File + JSON | No | Anexos adicionales. |

La radicación se crea con estado `Radicado`. En background se hace la **copia en caliente a SharePoint**: se crean las carpetas `Documentos_Radicacion/<NUMERO>/` (A–F, CEAP en `E_Otros/Documentos para circuitos exclusivos de AP`) y se suben los archivos que ya trae el expediente, aunque el radicado aún no esté aprobado. También notifica al revisor (`enviar_correo_nuevo_radicado_revisor`) y al contratista (`enviar_correo_nuevo_radicado_contratista`). Responde de inmediato.

> La **fila en la lista** de SharePoint solo se crea al aprobar; la copia en caliente sube carpetas y archivos, no items.

> Validación por **extensión** como respaldo al MIME (los DWG/DXF suelen llegar sin MIME): `.pdf .jpg .jpeg .png .tif .tiff .bmp .gif .dwg .dxf`.

### POST /api/radicacion/{identificador}/archivo

Sube/reemplaza el archivo de un documento, o agrega un anexo (`subFileName`). Parseo manual de los campos.

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `docId` | int | Sí | ID del documento (1–25 estándar, ≥100 manuales). |
| `archivo` | File | Sí | Archivo (PDF, imagen o DWG/DXF). |
| `subFileName` | string | No | Si se envía, se guarda como sub-archivo/anexo del documento. |
| `subId` | string | No | Con `subFileName`: ranura del sub-archivo (ej. `25a`); sin él, anexo extra. |
| `subCode` | string | No | Con `subId`: código del sub-archivo (ej. `CEAP-A`). |

Persiste localmente y hace la **copia en caliente** de ese documento a SharePoint en background (`subir_expediente_a_sharepoint` con `solo_doc_id`), mientras el archivo aún existe en disco. Sube sub-archivos (CEAP y anexos) aunque el documento no tenga archivo propio.

> Los sub-archivos del CEAP se guardan en SharePoint con la extensión del archivo real (ej. `CEAP_CEAP-A_Tarjeta....pdf`).

### POST /api/radicacion/{identificador}/formato

Guarda un formato generado (4.3.7 C o Recibo Técnico) y **lo sube a SharePoint** suelto en la raíz de la carpeta del radicado (único caso de subida fuera de la aprobación).

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `nombre` | string | Sí | Nombre del PDF (ej. `formato 4.3.7 C RAD-2026-001.pdf`). |
| `archivo` | File | Sí | PDF generado. |

### PATCH /api/radicacion/{identificador}/estado

Actualiza el estado y (opcionalmente) metadata/archivos de una radicación.

```jsonc
// Request
{
  "estado": "Aprobado",
  "observaciones": "Todos los documentos verificados",
  "archivos": [ "..." ],
  "metadata": { "firmaInterventoria": { "..." } },
  "usuarioEmail": "revisor@intecoalsas.com",
  "usuarioNombre": "Revisor de Obra"
}
```

**Efectos secundarios (automatizados por el backend):**
- Se persiste primero y se **responde de inmediato**; SharePoint y correos corren en background.
- Se registra la entrada en el **historial** de la radicación.
- Si `estado = "Aprobado"` → subida a SharePoint (fila + carpetas + archivos con nombre ordenado). Resube todo el expediente; antes de servir cada archivo nuevo se eliminan las versiones anteriores del mismo documento (prefijo `NN_CODIGO`), así no quedan duplicados. Marca `m365Synced` solo si la subida quedó **completa** (sin errores y sin archivos registrados sin bytes en disco, reportados en `perdidos`); si falta algo queda `false` con el detalle en los logs.
- Otros estados **no** suben a SharePoint (solo notifican).
- Si `estado` cambia a `Aprobado`/`Con Observaciones` → correo de resultado al **contratista** (`enviar_correo_estado`).
- Si `estado` cambia **a `En Revisión`** (desde otro estado) → correo al **revisor** (`enviar_correo_reesubido_revisor`) y correo de confirmación de subida al **contratista** (`enviar_correo_reenvio_contratista`).

### POST /api/m365/vaciar-radicados

Herramienta de mantenimiento (**solo revisor**): vacía la base del portal y borra en SharePoint las filas de la lista y las carpetas `Documentos_Radicacion/{RAD}` de cada radicado, además de sus archivos locales. Después sube el respaldo vacío a SharePoint, de modo que al reiniciar el servidor no se restaure nada. Por defecto **no borra nada**: devuelve la lista de radicados que se eliminarían. Con `?confirmar=true` ejecuta el vaciado total.

```jsonc
// 200 (reporte)
{ "ok": true, "confirmado": false, "total": 3, "a_eliminar": [ { "numeroRadicado": "RAD-2026-001", "estado": "Aprobado" } ] }

// 200 (aplicado)
{ "ok": true, "confirmado": true, "eliminados": 3, "fallos": [], "respaldo": true }
```

> Es destructivo e irreversible (los archivos de SharePoint van a la papelera del sitio). Tras vaciar, el consecutivo vuelve a empezar en `RAD-2026-001`.

### PATCH /api/radicacion/{identificador}/metadata

Actualiza metadatos, archivos u observaciones de una radicación sin cambiar necesariamente el estado.

```jsonc
// Request
{
  "metadata": { "responsableRevision": "Nuevo Revisor" },
  "archivos": [ "..." ],
  "elementosEntregados": [ "..." ],
  "observacionesGenerales": "...",
  "soloAvance": false   // true → borrador del revisor (sin sync/historial/notificaciones)
}
```

> **`soloAvance: true`**: modo "Guardar Avance" del revisor. Se persisten los cambios **sin** sincronizar a SharePoint, **sin** registrar historial y **sin** enviar notificaciones.
>
> **Fusión de sub-archivos:** la lista `archivos` del cliente se fusiona con la del servidor, no la reemplaza en ciego. Los sub-archivos que solo existen en el servidor se conservan, se restaura su `localPath`, y estado/notes se toman del cliente (`_fusionar_archivos`; igual en `PATCH /estado`). Un guardado con una copia vieja del navegador no pierde sub-archivos ni anexos.

### DELETE /api/radicacion/{identificador}

Elimina una radicación. Query params: `email`, `rol=contratista`.

Reglas (todas deben cumplirse): rol contratista, solicitante = creador, es el **ÚLTIMO radicado creado globalmente** (de todas las cuentas) y no está `Aprobado`. Además borra su carpeta local y sus filas de SharePoint en background.

```jsonc
// 200
{ "ok": true, "mensaje": "Radicado RAD-2026-001 eliminado correctamente." }

// 403 si no es el último global, no es el creador o está aprobado
```

---

## Archivos (visor)

### GET /api/files/view/{radicacion_id}/{doc_id}

Devuelve el archivo de un documento para visualizarlo.

- **PDF e imágenes:** se sirven con `Content-Disposition: inline` para verse en el navegador.
- **DXF:** el frontend lo muestra con el visor CAD (`@cadview/react`).
- **DWG/DWF/DWT:** no visualizables en línea; el frontend ofrece descargar.
- **Recuperación desde SharePoint:** si el archivo (principal o sub-archivo con `?subId=`) no está en el disco del servidor —p. ej. tras un reinicio de Render— se descarga de SharePoint con la misma ruta con que se subió y se vuelve a guardar en disco; si tampoco está en SharePoint responde 404 con "no encontrado en disco ni en SharePoint".
- `404 "Sub-archivo no encontrado"`: el `subId` no existe en el registro.

---

## Microsoft 365 / SharePoint

### GET /api/m365/status

Estado de la conexión con Microsoft 365 (llenado de `AZURE_*` / `SHAREPOINT_*`).

```jsonc
// 200
{
  "azureClientId": "...",
  "azureTenantId": "...",
  "sharepointSiteId": "...",
  "sharepointListId": "...",
  "isConnected": true
}
```

### GET /api/m365/list-columns

Columnas de la lista de SharePoint configurada.

### POST /api/m365/test-connection

Prueba la conexión con Microsoft Graph.

```jsonc
// 200
{ "ok": true, "conexion": "Exitosa", "usuario": "coord.tecnico@intecoalsas.com" }
```

### POST /api/m365/reubicar-archivos

Herramienta de mantenimiento (**solo revisor**): reubica archivos ya subidos en la carpeta que les corresponde según el catálogo (`folderGroup`), usando `PATCH` (mover conserva el contenido). Por defecto **no mueve nada**: devuelve el plan. Con `?aplicar=true` ejecuta los movimientos; un `409` indica que en la carpeta destino ya existe otro archivo con ese nombre y hay que revisarlo a mano.

```jsonc
// 200
{ "ok": true, "aplicar": false, "total": 5, "movimientos": [
  { "numero": "RAD-2026-001", "archivo": "02_A2_cedula.pdf", "de": "B_Certificaciones", "a": "A_Tecnicos" }
] }
```

### POST /api/m365/reconstruir-expedientes

Herramienta de mantenimiento (**solo revisor**): recupera en el registro los archivos/sub-archivos que están en SharePoint pero no aparecen en la app (toma el nombre desde el nombre del archivo en SharePoint, por prefijo `NN_CODIGO` / `CODIGO_SUBCODIGO` / `CODIGO_ANEXO-n`). No toca lo que ya está en el registro y no escribe `localPath` (el visor los sirve desde SharePoint). Por defecto **solo reporta**; con `?aplicar=true` actualiza el registro, recalcula cumplimiento y deja nota en el historial. Parámetro opcional `?numero=RAD-...` para un solo radicado.

```jsonc
// 200
{ "ok": true, "aplicado": false, "radicados": 1, "cambios": 3, "detalle": [
  { "numeroRadicado": "RAD-2026-001", "cambios": [
    { "docId": 25, "docCode": "CEAP", "tipo": "subarchivo", "subId": "25c", "subCode": "CEAP-C",
      "subName": "Memoria de cálculo", "nombreSharePoint": "CEAP_CEAP-C_Memoria.pdf", "fileName": "Memoria.pdf" }
  ] }
] }
```

### POST /api/m365/corregir-nombres-ceap

Herramienta de mantenimiento (**solo revisor**): renombra en SharePoint los sub-archivos del CEAP que quedaron **sin extensión** (nombre nuevo = nombre actual + extensión del registro; solo si el registro la tiene y el archivo en SharePoint no). Por defecto **solo reporta**; con `?aplicar=true` ejecuta el renombrado (`PATCH` del nombre). Parámetro opcional `?numero=RAD-...`.

```jsonc
// 200
{ "ok": true, "aplicado": false, "radicados": 1, "cambios": 2, "detalle": [
  { "numeroRadicado": "RAD-2026-001", "cambios": [
    { "nombreActual": "CEAP_CEAP-A_Tarjeta_profesional_del_diseñador_y_constructor",
      "nombreNuevo": "CEAP_CEAP-A_Tarjeta_profesional_del_diseñador_y_constructor.pdf", "status": null }
  ] }
] }
```

> Las tres herramientas siguen el mismo esquema: reporte por defecto y `aplicar=true` para escribir. Las subidas nuevas no requieren estos endpoints: la clasificación por catálogo y la extensión ya vienen corregidas.

### POST /api/m365/revisar-vencimientos

Disparo manual de la revisión de plazos con **forzar**: ignora la ventana horaria y envía de inmediato **un solo correo resumen** con los avisos pendientes de **8 días**, **4 días** y **vencidos**, y devuelve lo notificado radicado a radicado. La revisión automática corre **cada 1 h** pero solo envía de **lunes a viernes entre las 8:00 y 8:59 a.m. hora Colombia**, como máximo **un correo por día** (vencidos y por vencer van en el mismo mensaje); si un día no se envía no se acumula, se retoma en la siguiente ventana.

```jsonc
// 200
{ "ok": true, "notificados": [{ "numeroRadicado": "RAD-2026-001", "diasRestantes": 7, "aviso": "8 dias" }], "total": 1 }
```

### GET /api/m365/webhook-config

Obtiene la configuración del webhook (Power Automate).

### POST /api/m365/webhook-config

Actualiza la URL del webhook.

```jsonc
// Request
{ "webhookUrl": "https://prod-XX.logic.azure.com/..." }
```

### GET /api/sharepoint/schema

Devuelve el esquema/catálogo documental usado para SharePoint.

---

## Estados y Códigos de Respuesta

### Estados de radicación
| Estado | Significado |
|--------|-------------|
| `Radicado` | Creado por el contratista. |
| `En Revisión` | Reenviado / en evaluación. |
| `Con Observaciones` | Devuelto con correcciones. |
| `Aprobado` | Conforme y sincronizado a SharePoint. |

### Códigos HTTP
| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 400 | Solicitud inválida (datos faltantes, MIME/extensión no permitida) |
| 403 | Prohibido (eliminar sin ser último global/creador/aprobado; rol insuficiente) |
| 404 | Recurso no encontrado |
| 500 | Error interno del servidor (incluye motivo de fallo de SharePoint; el detalle identifica la causa) |
| 503 | Servicio no disponible (GraphService offline / M365 sin configurar) |

---

## Validación de Archivos (Backend)

- **Parseo multipart completo** en los 3 endpoints multipart.
- **MIME permitidos + respaldo por extensión** (`.pdf .jpg .jpeg .png .tif .tiff .bmp .gif .dwg .dxf`): si el navegador no reporta MIME (típico en DWG/DXF), se valida por extensión y se infiere el tipo.
- **Escritura por bloques:** los archivos se escriben en disco sin cargarlos completos en memoria; los errores de disco se devuelven como `500` con el motivo.
- **Producción:** el frontend envía directo a Render (`VITE_API_DIRECT_URL`) las subidas más pesadas para saltarse el proxy de Netlify; el resto va por `/api/*` relativo.
