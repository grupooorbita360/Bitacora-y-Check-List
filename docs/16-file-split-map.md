# 16 — Mapa de archivos tras partir los 4 más grandes

Refactor puro (sin cambios de comportamiento): los 4 archivos más grandes
del proyecto (`html/Client_Views.html`, `html/Client_Modals.html`,
`src/43_TaskService.js`, `src/98_Api.js`) se partieron en archivos más
chicos y cohesivos, para que editar una sola parte no obligue a abrir un
archivo enorme ni a revisar código sin relación. Se movió código
textualmente — nada se reescribió, ni se renombró ninguna función o
símbolo público (`api_*`, `TaskService`, etc.).

Regla corta: **si vas a cambiar X, editá solo el archivo Y** — las tablas
de abajo son el índice para encontrar Y.

## `html/Client_Views_*.html` (antes `Client_Views.html`)

Una vista por archivo. `Index.html` las incluye en el mismo orden en que
antes aparecían dentro del archivo único.

| Si vas a cambiar...                          | Editá...                              |
| --------------------------------------------- | -------------------------------------- |
| Login, o el dispatcher de rutas (login vs. shell+contenido) | `Client_Views_Login.html`     |
| El Dashboard                                  | `Client_Views_Dashboard.html`         |
| La lista de Tasks (pestañas, filtros, búsqueda) | `Client_Views_Tasks.html`           |
| El Task Detail                                | `Client_Views_TaskDetail.html`        |
| La vista de Checklist                         | `Client_Views_Checklist.html`         |

## `html/Client_Modals_*.html` (antes `Client_Modals.html`)

Agrupadas por tema, no una por modal — el sistema genérico de modal vive
aparte porque lo usan todas.

| Si vas a cambiar...                                    | Editá...                                  |
| -------------------------------------------------------- | ------------------------------------------ |
| El sistema genérico de modal (overlay + caja)             | `Client_Modals_Shared.html`               |
| Lifecycle (OPEN/COMPLETE/CANCEL/REOPEN/SNOOZE), reasignar, tomar ownership | `Client_Modals_Task.html`                 |
| Participantes o Adjustments                               | `Client_Modals_ParticipantsAdjustments.html` |
| Registrar una ejecución de Checklist o convertirla en Task | `Client_Modals_Checklist.html`            |

## `src/43_TaskService*.js` (antes `43_TaskService.js`)

`TaskService` sigue siendo un único objeto en runtime: el archivo core
declara `var TaskService = {...}` con `create`/`get`, y cada extensión
hace `Object.assign(TaskService, {...})`. Por eso el nombre de archivo
importa para el orden de carga: el core (`43_TaskService.js`) tiene que
cargar antes que cualquier extensión, y el punto `.` de `.js` en el core
ordena alfabéticamente antes que cualquier letra o dígito que empiece el
sufijo de una extensión (`43_TaskService` + letra/dígito > `43_TaskService` + `.js`
en orden ASCII) — así que basta con mantener el prefijo `43_TaskService`
en el nombre de cada extensión para que el orden salga bien solo, sin
tocar `test/loadGas.js` ni renumerar nada.

| Si vas a cambiar...                                | Editá...                          |
| ---------------------------------------------------- | ---------------------------------- |
| Crear una Task o leerla (`create`/`get`)             | `43_TaskService.js` (core)         |
| Transiciones de Status (OPEN/COMPLETE/SNOOZE/RESUME/CANCEL/REOPEN) | `43_TaskServiceLifecycle.js`       |
| Tomar ownership o reasignar (individual o en bloque) | `43_TaskServiceOwnership.js`       |
| Comentarios / historial                              | `43_TaskServiceComments.js`        |
| Agregar o quitar Participants                        | `43_TaskServiceParticipants.js`    |
| Subtareas                                            | `43_TaskServiceSubtasks.js`        |
| Pedir/resolver/cancelar un ajuste                    | `43_TaskServiceAdjustments.js`     |

## `src/98_Api*.js` (antes `98_Api.js`)

A diferencia de `TaskService`, cada `api_*` es una función global
independiente (`function api_x() {}`), no un método de un objeto
compartido. No hay `Object.assign` ni dependencia de orden de carga entre
estos archivos: cada `api_*` se resuelve por su cuenta cuando Apps Script
la invoca, mucho después de que todo el proyecto ya cargó. El core trae
solo lo que todos los demás necesitan (`_resolveActingUserId`, `_toPlain`)
más Auth/bootstrap.

| Si vas a cambiar...                                          | Editá...                  |
| --------------------------------------------------------------- | -------------------------- |
| Helpers compartidos, login o `api_bootstrap`                    | `98_Api.js` (core)          |
| El Dashboard (`api_getDashboard`) o el alcance por rol           | `98_ApiDashboard.js`        |
| Lista/filtros/pestañas de Tasks, creación, Task Types, usuarios asignables | `98_ApiTasks.js`  |
| El detalle de una Task o cualquiera de sus acciones (lifecycle, ownership, comments, participants, subtasks, adjustments) | `98_ApiTaskActions.js` |
| Checklist (listar, registrar, convertir a Task)                  | `98_ApiChecklist.js`       |

## Build y despliegue

`scripts/build-gas.js` copia a `dist-gas/` **todo** `.js` de `src/` y todo
`.html` de `html/` por patrón (glob), sin lista fija de archivos — los
archivos nuevos de este split quedan incluidos automáticamente, sin tocar
el script. `test/htmlReferences.test.js` falla si:

- un `.html` de `html/` no está incluido desde algún `<?!= include(...); ?>`
  de `Index.html` (archivo huérfano), o
- un archivo que hace `Object.assign(X, {...})` sobre un objeto compartido
  (como `TaskService`) carga antes que el archivo con `var X = {...}` que
  lo declara.

`npm run build:gas` genera `dist-gas/` completo (42 `.js` + 14 `.html` +
`appsscript.json`) — lo que sube `clasp push` no deja archivos huérfanos.
