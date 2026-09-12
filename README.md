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

## Estado actual: Fase 2 entregada

Fase 1 (arquitectura + limpieza de datos) está cerrada: las 5 decisiones
abiertas de la auditoría de consistencia (Anexo A) fueron resueltas por
Eduardo. El detalle vive en [`docs/`](docs/):

| Documento | Contenido |
|---|---|
| [`docs/00-arquitectura-general.md`](docs/00-arquitectura-general.md) | Principios de arquitectura, capas, jerarquía organizacional, reglas transversales |
| [`docs/01-modelo-datos.md`](docs/01-modelo-datos.md) | Entidades definitivas (Departments, Users, Auth, Tasks, Checklist, etc.) |
| [`docs/02-reglas-negocio.md`](docs/02-reglas-negocio.md) | Ciclo de vida de Task, Ownership/Visibility/Scope, Checklist↔Task |
| [`docs/03-anexo-a-auditoria.md`](docs/03-anexo-a-auditoria.md) | Auditoría prompt vs. datos reales — decisiones cerradas (registro histórico) |
| [`docs/04-protocolo-despliegue.md`](docs/04-protocolo-despliegue.md) | Entorno de construcción (repo/Sheet personal) vs. entorno de entrega (Workspace empresa) |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Fases 1–7 y estado de cada una |

Fase 2 (Config/Auth/Users/Departments/Permissions + capa Repository/DAO) ya
tiene código y tests: ver [`apps-script/`](apps-script/). Incluye la
autenticación de dos vías (email único → directo; email compartido →
selector + PIN) documentada en `docs/01-modelo-datos.md`. Corre
`cd apps-script && npm test` para validar la lógica sin depender de un
Sheet real.

**Aún no se ha instalado en un Sheet real.** El siguiente paso es que
Eduardo lo copie a su Sheet personal de prueba
(`apps-script/README.md` trae el paso a paso) y valide el flujo de login
antes de avanzar a Fase 3.

## Principio rector

No duplicar conceptos, no crear tablas/campos/funcionalidades innecesarias,
no inventar en silencio lo que no está definido — señalarlo y proponer una
opción. Construcción modular, paso a paso, igual que HotelOS.
