# Fase 4 — Frontend: decisiones y cómo se probó

## Qué no estaba disponible literalmente

Igual que con Task_Permissions en Fase 3, esta sesión nunca tuvo el texto
literal de las secciones 44-57 del prompt maestro (TASK UI / SEARCH /
DETAIL / ACTIONS / MODALS / NEW TASK / TASK FROM BITÁCORA / PARTICIPANTS-
SUBTASKS / USER DEACTIVATION / DESIGN PRINCIPLES / PERFORMANCE) — solo sus
títulos y los tres principios repetidos en el resto del documento:
**desktop-first, progressive disclosure, validación siempre en backend,
performance consciente de que el backend inicial es Sheets**. El frontend
de Fase 4 se diseñó grounded en esos principios más el modelo de datos y
las reglas de negocio ya construidas (Fase 2/3), no en un mockup dado.

Si al revisar la UI real instalada hay diferencias de detalle con lo que
Eduardo tenía en mente para esas secciones, son ajustes de presentación
sobre una base funcional ya correcta — el motor de negocio detrás (Fase 3)
no cambia.

## Qué se construyó

Una SPA (single-page app) servida por Apps Script HTML Service — patrón
estándar del stack, no una elección adicional:

- **Login**: automático en la vía DIRECT (sin pantalla, pasa derecho al
  Dashboard); selector + PIN en la vía SELECT_PIN; pantalla de "Acceso no
  configurado" en DENIED.
- **Layout/Navigation**: sidebar fijo (Dashboard/Tasks) + topbar con
  usuario/roles/Salir — desktop-first, sin intentar ser mobile-first.
- **Dashboard**: contadores de Tasks propias por estado + vencidas.
- **Tasks**: tabla con filtros (estado, prioridad, "solo mías", búsqueda
  por título) + botón Nueva Task + Reasignar en bloque (solo visible si
  `canBulkReassign` — progressive disclosure real, no solo CSS).
- **Task Detail**: overview, botones de acción calculados por el backend
  (`_computeAvailableActions` en `98_Api.js` — cruza `TaskPermissionService`
  con las transiciones válidas de `Task_Status_Transitions`, así el botón
  nunca se muestra si la acción fallaría), comentarios, subtareas,
  participantes, ajustes pendientes (con Aprobar/Rechazar si corresponde),
  e historial completo en un `<details>` colapsable.
- **Modals**: Nueva Task, acción-con-comentario genérico (Completar/
  Cancelar/Reabrir), Posponer (comentario + fecha), Tomar Ownership,
  Reasignar, Pedir Ajuste, Resolver Ajuste, Reasignar en bloque.

Checklist (Fase 3 backend) **no tiene vista propia todavía** — no estaba en
la lista explícita de vistas que pidió Eduardo para esta fase
(Login/Layout/Navigation/Dashboard/Tasks/Task detail/Modals). El API ya
existe (`api_listChecklist`, `api_recordChecklistRun`,
`api_convertChecklistRunToTask`) para cuando se pida esa vista.

## Arquitectura

- `apps-script/src/98_Api.js`: única capa que el cliente invoca. Cada
  función es un wrapper delgado sobre los Services de Fase 2/3 — sin
  lógica de negocio propia, todo vuelve a validarse ahí (nunca solo en el
  cliente).
- `apps-script/src/99_WebApp.js`: `doGet()` + `include()` (patrón estándar
  Apps Script multi-archivo, ya que no hay módulos).
- `apps-script/html/*.html`: `Index.html` (shell) incluye `Styles`,
  `Client_Api`, `Client_State`, `Client_Views`, `Client_Modals`,
  `Client_Main` — todo se concatena en un solo documento en tiempo de
  render (`HtmlService`), como cualquier proyecto Apps Script con más de
  un archivo HTML.
- El cliente nunca llama `google.script.run` directo — todo pasa por
  `callServer()` (`Client_Api.html`), que además sirve como el punto de
  variación para poder probar localmente (ver abajo).

## Cómo se probó de verdad, no solo se revisó el código

`apps-script/devserver/server.js` levanta un servidor Node con el MISMO
backend que corre bajo test (los mocks de `SpreadsheetApp`/`Utilities`/
`Session` de Fase 2, `apps-script/test/loadGas.js`), resuelve los
`<?!= include(...) ?>` de las plantillas igual que `HtmlService`, y expone
cada función `api_*` por HTTP (`POST /rpc/<nombre>`). `callServer()`
detecta si existe `google.script.run`; si no, usa `fetch` contra ese
servidor — el mismo `Index.html` corre sin cambios en ambos entornos.

Con eso se abrió la app en Chromium real (Playwright) y se verificó en
vivo, entre otras cosas:

- Login DIRECT automático y login SELECT_PIN con PIN incorrecto (rechazo
  inline) y correcto.
- Un correo sin usuarios activos cae en la pantalla DENIED.
- Crear una Task asignándola a otra persona registra `CREATED` +
  `ASSIGNED` en el historial; crearla para uno mismo solo registra
  `CREATED`.
- Ciclo de vida: Abrir → Comentar → Posponer (exige comentario y fecha) →
  Reasignar en bloque.
- Un Agent **no ve el botón Reasignar** (Task_Permissions real, sección
  06-fase-3-decisiones.md) y en su lugar usa "Pedir Ajuste"; su Supervisor
  lo aprueba y el Owner cambia — con los 4 eventos correctos en el
  historial (`CREATED`, `ASSIGNED`, `ADJUSTMENT_REQUESTED`,
  `ADJUSTMENT_APPROVED`).
- Subtareas (crear/completar sin afectar la Task padre) y participantes
  (agregar/quitar).

Esto corrió contra el motor de permisos y reglas reales de Fase 3, no
contra una maqueta — cualquier regresión de negocio se habría visto ahí.

## Qué falta antes de instalar en el Sheet real

1. Copiar `apps-script/src/*.js` y `apps-script/html/*.html` al proyecto
   de Apps Script de prueba (mismo procedimiento de Fase 2/3,
   `apps-script/README.md`).
2. Desplegar como Web App (`Implementar > Nueva implementación > Aplicación
   web`), con **Ejecutar como: Usuario que accede** — imprescindible para
   que `Session.getActiveUser()` funcione (ya configurado en
   `appsscript.json`).
3. Repetir a mano el mismo recorrido que se automatizó aquí con
   Playwright, ya en el entorno real, con los usuarios reales de Executive
   Services una vez cargados (recordar: los datos de prueba son
   placeholders, `docs/01-modelo-datos.md`).
