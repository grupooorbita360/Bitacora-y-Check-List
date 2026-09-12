# Bitácora y Check List → Plataforma Operativa

Evolución de la antigua "Bitácora Executive Services" (prototipo en Google
Sheets, `NEW_Bitacora.xlsx`) hacia una plataforma operativa web modular:
Usuarios, Roles, Departamentos, Permisos, Tasks, Recurrencias, Agenda,
Follow-ups, Boards, Reportes, Notificaciones, Auditoría, People y Checklist
operativo.

El Sheet actual es la **fuente de verdad provisional** del modelo de datos y
de las reglas de negocio — no el backend final. La arquitectura se diseña
desde el día uno para poder migrar a una base de datos real (Postgres/
Supabase, mismo patrón que HotelOS) sin reconstruir frontend ni lógica de
negocio.

## Estado actual: Fase 1 completada

Fase 1 (arquitectura + limpieza de datos) está cerrada: las 5 decisiones
abiertas de la auditoría de consistencia (Anexo A) fueron resueltas por
Eduardo. El detalle vive en [`docs/`](docs/):

| Documento | Contenido |
|---|---|
| [`docs/00-arquitectura-general.md`](docs/00-arquitectura-general.md) | Principios de arquitectura, capas, jerarquía organizacional, reglas transversales |
| [`docs/01-modelo-datos.md`](docs/01-modelo-datos.md) | Entidades definitivas (Departments, Users, Tasks, Checklist, etc.) |
| [`docs/02-reglas-negocio.md`](docs/02-reglas-negocio.md) | Ciclo de vida de Task, Ownership/Visibility/Scope, Checklist↔Task |
| [`docs/03-anexo-a-auditoria.md`](docs/03-anexo-a-auditoria.md) | Auditoría prompt vs. datos reales — decisiones cerradas (registro histórico) |
| [`docs/04-protocolo-despliegue.md`](docs/04-protocolo-despliegue.md) | Entorno de construcción (repo/Sheet personal) vs. entorno de entrega (Workspace empresa) |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Fases 1–7 y estado de cada una |

**No se ha escrito código de negocio todavía.** Según la metodología de
trabajo (sección 64 del prompt maestro), no se avanza a Fase 2 (Backend
foundation: Config/Auth/Users/Permissions/Repository layer) hasta que se
revise esta documentación y se dé la indicación explícita de continuar.

## Principio rector

No duplicar conceptos, no crear tablas/campos/funcionalidades innecesarias,
no inventar en silencio lo que no está definido — señalarlo y proponer una
opción. Construcción modular, paso a paso, igual que HotelOS.
