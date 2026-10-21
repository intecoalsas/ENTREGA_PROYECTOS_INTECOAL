# Diccionario de Datos y DER

> Software: Portal de Radicación INTECOAL v1.0 · Documento v1.0 — Octubre 2026.
> Persistencia real: JSON local (`backend/data/radicaciones.json`) + archivos en `backend/uploads/{id}/` + espejo en SharePoint Online. No hay SQL.

## Diagrama entidad-relación (DER)

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  RADICACION  │1──────*│   ARCHIVO    │1──────*│   SUBFILE    │
│  (1 fila por │        │ (25 fijos +  │        │ (ranuras     │
│  expediente) │        │  adicionales)│        │  CEAP/anexos)│
└──────┬───────┘        └──────────────┘        └──────────────┘
       │1                ┌──────────────┐
       ├───────*─────────│  HISTORIAL   │ (estado, fecha, usuario, obs.)
       │                └──────────────┘
       │1               ┌──────────────┐
       └───────*────────│   FORMATO    │ (4.3.7 C, Recibo Técnico: PDF local)
                        └──────────────┘
       │1               ┌──────────────┐
       └───────*────────│  ELEMENTO    │ (inventario físico entregado)
                        └──────────────┘
```

## RADICACION (objeto raíz)

| Campo | Tipo | Obligatorio | Descripción / restricción |
|---|---|---|---|
| `id` | string(8) | Sí | PK local. `generar_id()` (uuid recortado). Índice lógico. |
| `numeroRadicado` | string | Sí | Único. `RAD-{año}-{###}` consecutivo, nunca se reutiliza. |
| `metadata` | objeto | Sí | Ver tabla METADATA. |
| `estado` | string | Sí | `Radicado` \| `En Revisión` \| `Con Observaciones` \| `Aprobado`. |
| `documentosOk` / `totalDocumentos` | int | Sí | Contadores (válidos = CUMPLE + N/A). |
| `porcentajeCumplimiento` | int 0–100 | Sí | Calculado. |
| `fechaRadicacion` / `fechaActualizacion` | ISO-8601 UTC | Sí | Creación y última mutación. |
| `archivos` | array | Sí | Ver ARCHIVO. |
| `elementosEntregados` | array | No | Ver ELEMENTO. |
| `observacionesGenerales` | string | No | Dictamen del revisor (se borra al reenviar). |
| `historial` | array | Sí | Ver HISTORIAL. |
| `formatos` | array | No | Ver FORMATO. |
| `creadorEmail` / `creadorName` | string | Sí | Identidad del JWT (no del formulario). Índice lógico de propiedad. |
| `m365Synced` | bool | No | `true` solo si SharePoint confirmó. |
| `notifVencimiento` | objeto | No | `{"8": ISO, "4": ISO, "diaria": ISO}` avisos enviados. |

## METADATA (dentro de RADICACION)

| Campo | Tipo | Descripción |
|---|---|---|
| `nombreProyecto`, `municipio`, `contratista`, `nitContratista`, `responsable`, `correoResponsable`, `tipoEntrega`, `fechaEntrega`, `categoria` | string | Datos del contrato (requeridos al crear, salvo opcionales). |
| `responsableRevision` | string | Revisor asignado. |
| `firmaContratista` / `firmaInterventoria` | objeto | `{dataUrl, hashVerificacion, nombreSignatario, cargo, tarjetaProfesional?, fechaFirma}`. |
| `formato437c` | objeto | Campos del Formato C por clave (ver componente). |
| `reciboTecnico` | objeto | `{asunto, cuerpo, titulo?, senor?, fechaCongelada?, fechaActualizacion}`. |

## ARCHIVO (dentro de RADICACION.archivos)

| Campo | Tipo | Descripción |
|---|---|---|
| `docId` | int | PK en catálogo (1–25; ≥100 manuales). |
| `docCode` / `docName` | string | Código (A1…CEAP) y nombre. |
| `fileName` / `fileSize` / `fileType` / `uploadDate` | string/int | Archivo aportado (vacío si pendiente). |
| `status` | string | `PENDIENTE` \| `CUMPLE` \| `NO CUMPLE` \| `N/A`. |
| `notes` | string | Observación del revisor. |
| `folderPath` | string | Destino SharePoint (`/Documentos_Radicacion/{RAD}/{grupo}/`). |
| `esManual` | bool | Documento agregado por el contratista. |
| `localPath` | string | **Solo servidor** (ruta disco; el cliente no la impone). |
| `subFiles` | array | Ver SUBFILE. |

## SUBFILE / HISTORIAL / FORMATO / ELEMENTO

| Entidad | Campos clave |
|---|---|
| SUBFILE | `subId` (ej. `25a` o `extra_1`), `subCode`, `subName`, `fileName`, `fileSize`, `fileType`, `uploadDate`, `localPath` (servidor), `status`, `notes`. |
| HISTORIAL | `estado`, `fecha` (ISO), `usuario` (email JWT), `usuarioNombre`, `observaciones`. Se agrega en cada cambio de estado. |
| FORMATO | `nombre` (ej. `formato 4.3.7 C RAD-…​.pdf`), `fileName`, `fileSize`, `fileType`, `uploadDate`, `localPath`. |
| ELEMENTO | `id`, `elemento`, `cantidad`, `especificacion` (inventario). |

## Archivos en disco y SharePoint

- Local: `backend/uploads/{radicacion.id}/[{docCode}/]{archivo}`.
- SharePoint: `Documentos_Radicacion/{RAD}/{A_Tecnicos,B_Certificaciones,C_Contractuales,D_Inventario,E_Otros[/Documentos para circuitos exclusivos de AP],F_Documentos_Adicionales}/{orden:02d}_{código}_{original}`; formatos sueltos en la raíz del radicado.
- JWT payload: `{sub, email, role, company, name, exp(24h), iat}` HS256.
