# Flujo de Trabajo — Roles, Estados y Funcionalidades

## Roles y acceso

El login es **exclusivamente con cuenta de Microsoft 365** (no hay "Ingreso Directo").

| Rol | Dominio permitido | Permisos |
|-----|-------------------|----------|
| **Revisor / Interventor** | `@intecoalsas.com`, `@intecoal.com.co` | Evaluar documentos, dictaminar (Aprobado / Con Observaciones), firmar el informe, Formato 4.3.7 C, Recibo Técnico y Calendario. Su correo recibe la notificación de radicado por revisar y las alertas de vencimiento. |
| **Contratista / Creador** | Cualquier correo M365 | Crear radicaciones, subir/corregir archivos, firmar declaración, ver sus radicaciones. Recibe confirmación de subida y resultado de evaluación. |

> Los correos de notificación al **revisor** van a `M365_NOTIFICATION_RECIPIENT` (hoy: `coord.tecnico@intecoalsas.com`); los del **contratista** van a su correo registrado en la metadata del radicado (`creadorEmail`/`correoResponsable`). Si esa variable queda vacía, los avisos del revisor simplemente no se envían.

## Flujo de trabajo

```
Contratista            Revisor (Interventoría)
   │                        │
   ├─ Crea radicación ─────▶│  Notificación: "Nuevo Radicado por Revisar"
   │  (firma obligatoria)   │
   │                        ├─ Evalúa (Guardar Avance o Finalizar)
   │                        │  → Aprobado / Con Observaciones
   │  ◀─ Resultado ─────────┤  (correo al contratista)
   │                        │
   ├─ (Si obs.) Edita y     │
   │  reenvía ─────────────▶│  Notificación al revisor + confirmación al contratista
   │                        ├─ Re-evalúa…
   │                        │  Aprobado → sincroniza a SharePoint
   │                        └─ Genera Informe (firma del revisor obligatoria)
```

## Estados de una radicación

| Estado | Descripción |
|--------|-------------|
| **Radicado** | Creado por el contratista. |
| **En Revisión** | Reenviado/almacenado para evaluación. |
| **Con Observaciones** | El revisor devolvió con correcciones. |
| **Aprobado** | Dictaminado conforme y sincronizado a SharePoint. |

## Funcionalidades por rol

### Contratista
- Crear nueva radicación con los 25 requisitos RETILAP + documentos adicionales manuales.
- Subir archivos (PDF, imágenes y planos DXF/DWG).
- **Firma electrónica obligatoria al radicar** (no se permite crear sin firmar).
- Marcar documentos como N/A.
- Ver solo sus propias radicaciones.
- **Editar/re-subir** un radicado con observaciones.
- **Eliminar solo el ÚLTIMO radicado creado globalmente** (de todas las cuentas), si es el creador y no está aprobado. Si otra cuenta radica uno nuevo, la opción desaparece de los anteriores.
- Descargar ZIP del expediente.

### Revisor (Interventoría)
- Evaluar cada documento: Cumple / No Cumple / Pendiente / N/A.
- Asignar dictamen general y observaciones.
- Guardar avance (borrador) o finalizar la evaluación.
- **Firma de interventoría obligatoria** para finalizar con Aprobado o Con Observaciones.
- Generar informe de conformidad (imprimible) sin numeración en títulos.
- **Aprobado → subida a SharePoint** (fila + carpetas + archivos, en background) con insignia de estado y botón **Reintentar subida** si queda pendiente.
- **Formato 4.3.7 C** (por radicado): número, municipio/ciudad y fecha se autodiligencian; la fecha se actualiza a diario hasta subirlo y luego se congela. Botones Editar/Guardar/Subir/Imprimir.
- **Recibo Técnico** (por radicado, botón en el Historial solo en aprobados): solo asunto y cuerpo editables; firma del jefe permanente; correo del membrete según municipio (Tuluá/Andalucía/San Pedro/Calima); fecha viva hasta subir y congelada después. Botones Editar/Guardar/Subir/Imprimir + selector de radicado.
- **Calendario** de plazos: límite = 15 días hábiles por radicado (lun–vie); el conteo restante es en días calendario exactos. Bolitas 🔵 radicación, 🟡 faltan ≤8, 🔴 faltan ≤4, 🟣 vencido, 🟢 aprobado. Clic en fecha → detalle del radicado con acceso a Evaluar/Informe. En la tarjeta lateral conviven **dos listas del mismo tamaño**, cada una con su barra de desplazamiento vertical: **Próximos a vencer** (los que aún tienen plazo, incluye "vence hoy") arriba y **Vencidos** (los que ya pasaron su fecha límite, con "Vencido hace N días") abajo; ambas muestran su conteo en el encabezado.

### Visor de documentos
- **PDF e imágenes:** se muestran en línea (Content-Disposition: inline).
- **DXF:** vista previa en el navegador vía `@cadview/react`.
- **DWG/DWF/DWT:** panel de descarga (no visualizable en navegador; se abre en AutoCAD).

## Notificaciones por correo

Plantilla plana (sin marco): título, contenido y al final el **logo del municipio** como imagen inline (`backend/assets/correos/logo-{tulua,andalucia,sanpedro,calima,villavicencio,general}`), elegido por el municipio del radicado.

**Remitente y copias por municipio:** las notificaciones al contratista (registrado, resultado, actualizado) salen **desde** el correo municipal; todas las notificaciones de estados agregan en copia al correo municipal con el número de radicado; los avisos del calendario van **solo al revisor** (un resumen diario, sin copia municipal, para no mezclar radicados de municipios distintos en un mismo correo). Respaldo automático al correo general si el municipio no está en la tabla.

| Evento | Destinatario | Función backend |
|--------|--------------|-----------------|
| Nuevo radicado | Revisor | `enviar_correo_nuevo_radicado_revisor` |
| Radicado creado | Contratista | `enviar_correo_nuevo_radicado_contratista` |
| Resultado de evaluación (Aprobado/Con Observaciones) | Contratista | `enviar_correo_estado` |
| Radicado reenviado/editado | Revisor | `enviar_correo_reesubido_revisor` |
| Confirmación de reenvío | Contratista | `enviar_correo_reenvio_contratista` |
| Aviso de plazo (8 / 4 días, una sola vez c/u) | Revisor (general, sin copia municipal) | Incluido en el correo resumen diario (`enviar_correo_vencimiento_resumen`, vigilancia cada 1 h) |
| Vencido sin aprobar (una vez al día, lun–vie 8:00–8:59 a.m. Colombia) | Revisor (general, sin copia municipal) | Mismo correo resumen (bandera `diaria`) |

**El correo resumen de plazo** — máximo **un envío por día**, solo de lunes a viernes entre las **8:00 y 8:59 a.m. hora Colombia**. Si un día no se envía (fin de semana o sin conexión) **no se acumula**: se incluye en la siguiente ventana. Si no hay nada pendiente, no se envía nada.

| Situación | Asunto |
|------|--------|
| Solo vencidos | `URGENTE: N radicado(s) vencido(s) de revisión` |
| Solo por vencer | `Radicados por vencer (N) — resumen de revisión` |
| Mezclado | `URGENTE: N radicado(s) vencido(s) y M por vencer — resumen de revisión` |

El cuerpo agrupa los radicados en tablas: **Vencidos**, **Vencen hoy**, **Faltan 4 días o menos** y **Faltan 8 días o menos** (radicado, proyecto, municipio, contratista, estado, límite y situación). Singular/plural correcto (`1 día` / `7 días`) y, si venció, la columna Situación dice "Vencido hace N días". El disparo manual (`POST /api/m365/revisar-vencimientos`) ignora la ventana y envía el resumen de inmediato.

> Los avisos del calendario son **solo para el revisor** (un correo resumen por día como máximo, sin copia al municipio); el contratista no recibe nada de esto. Al aprobarse el radicado se desactivan automáticamente (los aprobados se omiten).

## Estructura en SharePoint

```
Documentos_Radicacion/{RAD-XXXX-XXX}/
├── formato 4.3.7 C {RAD}.pdf   ← suelto en la raíz (botón Subir)
├── Recibo Tecnico {RAD}.pdf    ← suelto en la raíz (botón Subir)
├── A_Tecnicos/                 (diseño y técnicos)
├── B_Certificaciones/          (garantías y certificados)
├── C_Contractuales/            (contractual y legal)
├── D_Inventario/               (dictámenes D19–D21)
├── E_Otros/                    (CAUE, CANT, CVP)
│   └── Documentos para circuitos exclusivos de AP/  (archivos del #25 CEAP)
└── F_Documentos_Adicionales/   (manuales del contratista)
```

- Archivos con nombre ordenado: `{orden:02d}_{código}_{original}` (ej. `01_A1_plano.pdf`).
- **Política de subida:** a SharePoint solo sube lo **aprobado** (fila + carpetas + archivos); los formatos solo con su botón **Subir**. Todo corre en background para no bloquear la interfaz (`m365Synced` indica el estado real).

---

Documentación relacionada: [06_API.md](06_API.md) · [08_SECURITY.md](08_SECURITY.md)
