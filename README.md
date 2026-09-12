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

## Estado actual: Fase 4 entregada

Fases 1-3 están cerradas e instaladas/validadas por Eduardo en el ambiente
real (Sheet personal + Apps Script). El detalle vive en [`docs/`](docs/):

| Documento | Contenido |
|---|---|
| [`docs/00-arquitectura-general.md`](docs/00-arquitectura-general.md) | Principios de arquitectura, capas, jerarquía organizacional, reglas transversales |
| [`docs/01-modelo-datos.md`](docs/01-modelo-datos.md) | Entidades definitivas (Departments, Users, Auth, Tasks, Checklist, etc.) |
| [`docs/02-reglas-negocio.md`](docs/02-reglas-negocio.md) | Ciclo de vida de Task, Ownership/Visibility/Scope, Checklist↔Task |
| [`docs/03-anexo-a-auditoria.md`](docs/03-anexo-a-auditoria.md) | Auditoría prompt vs. datos reales — decisiones cerradas (registro histórico) |
| [`docs/04-protocolo-despliegue.md`](docs/04-protocolo-despliegue.md) | Entorno de construcción (repo/Sheet personal) vs. entorno de entrega (Workspace empresa) |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Fases 1–7 y estado de cada una |
| [`docs/06-fase-3-decisiones.md`](docs/06-fase-3-decisiones.md) | Cómo se resolvió Task_Permissions/Task_Assignment_Config/Task_History con los datos reales |
| [`docs/07-fase-4-decisiones.md`](docs/07-fase-4-decisiones.md) | Qué se construyó del frontend, qué queda fuera (Checklist UI) y cómo se probó en navegador real |
| [`docs/08-fase-4-hardening.md`](docs/08-fase-4-hardening.md) | IDs atómicos, auto-refresco, specs de Playwright guardadas como tests reales |

Fase 4 (Frontend: Login, Layout, Navigation, Dashboard, Tasks, Task
detail, Modals) ya tiene código: ver [`apps-script/html/`](apps-script/html/)
y `apps-script/src/98_Api.js`/`99_WebApp.js`. Es una SPA servida por Apps
Script HTML Service, desktop-first, con progressive disclosure real (el
backend decide qué botones/acciones mostrar según permisos), con
generación de IDs atómica (`LockService` + Script Properties, sin
colisiones entre usuarios concurrentes) y auto-refresco cada 20s en
Dashboard/Tasks/Task Detail (pausado si la pestaña no está visible). Las
pruebas que antes eran scripts manuales ahora son specs reales de
Playwright en el repo (`apps-script/e2e/`, `npm run test:e2e`) — cubren
login, lifecycle completo, el flujo de Adjustment (Agent bloqueado +
Supervisor aprobando/rechazando) y el auto-refresco en vivo. También se
puede levantar `cd apps-script && npm run dev` y abrir
`http://localhost:8080` para probarlo a mano.

**Aún no se ha instalado en el Sheet/Apps Script real.** El siguiente paso
es copiar `apps-script/src/*.js` + `apps-script/html/*.html` al proyecto
de Apps Script de prueba, desplegar como Web App (`Ejecutar como: Usuario
que accede`) y repetir el mismo recorrido ya con los datos reales.

## Principio rector

No duplicar conceptos, no crear tablas/campos/funcionalidades innecesarias,
no inventar en silencio lo que no está definido — señalarlo y proponer una
opción. Construcción modular, paso a paso, igual que HotelOS.
