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

## Estado actual: Fase 3 entregada

Fase 1 (arquitectura + limpieza de datos) y Fase 2 (Config/Auth/Users/
Departments/Permissions) están cerradas — Fase 2 ya fue instalada y
validada por Eduardo en su Sheet personal real (login directo y con PIN
confirmados). El detalle vive en [`docs/`](docs/):

| Documento | Contenido |
|---|---|
| [`docs/00-arquitectura-general.md`](docs/00-arquitectura-general.md) | Principios de arquitectura, capas, jerarquía organizacional, reglas transversales |
| [`docs/01-modelo-datos.md`](docs/01-modelo-datos.md) | Entidades definitivas (Departments, Users, Auth, Tasks, Checklist, etc.) |
| [`docs/02-reglas-negocio.md`](docs/02-reglas-negocio.md) | Ciclo de vida de Task, Ownership/Visibility/Scope, Checklist↔Task |
| [`docs/03-anexo-a-auditoria.md`](docs/03-anexo-a-auditoria.md) | Auditoría prompt vs. datos reales — decisiones cerradas (registro histórico) |
| [`docs/04-protocolo-despliegue.md`](docs/04-protocolo-despliegue.md) | Entorno de construcción (repo/Sheet personal) vs. entorno de entrega (Workspace empresa) |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Fases 1–7 y estado de cada una |
| [`docs/06-fase-3-decisiones.md`](docs/06-fase-3-decisiones.md) | Qué de Fase 3 es literal del prompt maestro y qué es un motor de código inferido pendiente de reconciliar |

Fase 3 (Tasks + Checklist: CRUD, lifecycle, history, comments,
participants, subtasks, adjustments, bulk reassignment, Checklist_Config/
Checklist_Runs y conversión a Task) ya tiene código y tests: ver
[`apps-script/`](apps-script/). Corre `cd apps-script && npm test` para
validar toda la lógica sin depender de un Sheet real (45 tests, entre
Fase 2 y Fase 3).

**Aún no se ha instalado en el Sheet real.** Antes de darla por cerrada,
hay que instalarla (mismo Sheet de Fase 2, `bootstrapTestEnvironment()` ya
crea las hojas de Tasks/Checklist) y reconciliar contra las hojas reales
`Task_Permissions`/`Task_Assignment_Config`/`Task_History` los puntos
señalados en `docs/06-fase-3-decisiones.md` — no se tuvo acceso a su
contenido literal en esta sesión, así que Fase 3 implementa esas partes
como un motor de código derivado de reglas confirmadas, no como
transcripción.

## Principio rector

No duplicar conceptos, no crear tablas/campos/funcionalidades innecesarias,
no inventar en silencio lo que no está definido — señalarlo y proponer una
opción. Construcción modular, paso a paso, igual que HotelOS.
