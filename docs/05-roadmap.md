# Roadmap por fases

Metodología: paso a paso, sin generar toda la plataforma de una vez (mismo
enfoque que HotelOS).

| Fase | Alcance | Estado |
|---|---|---|
| **1** | Arquitectura y limpieza de datos: tablas, relaciones, reglas, permisos, flujos, módulos; cerrar las decisiones del Anexo A | ✅ Completada — ver `03-anexo-a-auditoria.md` |
| **2** | Backend foundation: Config, Auth, Users, Departments, Permissions, capa Repository/DAO | ✅ Código y tests entregados en `apps-script/` — pendiente de instalar en el Sheet personal de prueba y validar el flujo real |
| **3** | Tasks (CRUD, permisos, assignment, lifecycle, history, comments, participants, subtasks, adjustments, bulk reassignment) **+ Checklist** (`Checklist_Config`, `Checklist_Runs`, conversión a Task) | ⏳ Pendiente |
| **4** | Frontend: Login, Layout, Navigation, Dashboard, Tasks, Task detail, Modals (Apps Script Web App, HTML Service, desktop-first) | ⏳ Pendiente |
| **5** | People | ⏳ Pendiente |
| **6** | Integrations: Bitácora, y otras fuentes internas (`Leads` queda explícitamente fuera de alcance — ver `01-modelo-datos.md`) | ⏳ Pendiente |
| **7** | Reports / Notifications / Agenda | ⏳ Pendiente |

## Regla de avance

No se escribe código de negocio de una fase sin haber cerrado las
decisiones de arquitectura que le corresponden y sin indicación explícita
de avanzar. Fase 1 se cierra con este set de documentos; el siguiente paso
es que Eduardo revise `00`–`04` y confirme el inicio de Fase 2.
