# Documentación — Portal de Radicación INTECOAL

Índice central de toda la documentación técnica del proyecto. Organizada por tema para que encuentres rápido lo que necesitas.

> Resumen general del proyecto: [`README.md`](../README.md)

---

## Mapa de documentación (en orden de lectura)

| # | Tema | Documento | Para qué sirve |
|---|------|-----------|----------------|
| 01 | 🧠 **Visión general** | [01_ARQUITECTURA.md](01_ARQUITECTURA.md) | Cómo funciona el sistema por dentro: componentes, stack, persistencia |
| 02 | 🚀 **Puesta en marcha** | [02_INICIO-RAPIDO.md](02_INICIO-RAPIDO.md) | Requisitos e instalación local (backend + frontend) |
| 03 | 🔄 **Cómo se trabaja** | [03_FLUJO.md](03_FLUJO.md) | Roles, estados, flujo de trabajo, funcionalidades y correos |
| 04 | 📘 **Manual contratista** | [04_MANUAL-CONTRATISTA.md](04_MANUAL-CONTRATISTA.md) | Uso paso a paso para el Contratista |
| 05 | 📕 **Manual revisor** | [05_MANUAL-REVISOR.md](05_MANUAL-REVISOR.md) | Uso paso a paso para el Revisor |
| 06 | 🔌 **Backend** | [06_API.md](06_API.md) | Todos los endpoints REST, payloads y efectos secundarios |
| 07 | ☁️ **Producción** | [07_DEPLOYMENT.md](07_DEPLOYMENT.md) | Despliegue en Render (API) y Netlify (frontend) |
| 08 | 🔐 **Protección** | [08_SECURITY.md](08_SECURITY.md) | Autenticación JWT/MSAL, roles y buenas prácticas |
| 09 | 📊 **Datos** | [09_DICCIONARIO-DATOS.md](09_DICCIONARIO-DATOS.md) | Diccionario de datos, campos y estructura en disco/SharePoint |

---

## Guías rápidas

### ¿Quieres correr el proyecto en local?
Ir a [02_INICIO-RAPIDO.md](02_INICIO-RAPIDO.md).

### ¿Buscas a quién le toca qué?
Revisar [03_FLUJO.md](03_FLUJO.md) → sección **Roles y Acceso**.

### ¿Necesitas un endpoint del backend?
Consultar [06_API.md](06_API.md), con los endpoints agrupados por dominio de uso.

### ¿Vas a desplegar a producción?
Seguir [07_DEPLOYMENT.md](07_DEPLOYMENT.md) (incluye URLs de producción y troubleshooting).

### ¿Preocupado por la seguridad?
Leer [08_SECURITY.md](08_SECURITY.md).

---

## Startup rápido (receta de 2 pasos)

```bash
copy .env.example .env                      # Windows
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000    # terminal 1

npm install
npm run dev                                     # terminal 2 → http://localhost:5173
```

Detalle completo: [02_INICIO-RAPIDO.md](02_INICIO-RAPIDO.md).
