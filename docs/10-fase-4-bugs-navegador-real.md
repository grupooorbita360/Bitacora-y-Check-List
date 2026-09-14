# 4 bugs encontrados probando Fase 4 en el navegador real

Eduardo probó Fase 4 desplegada como Web App (no solo el dev server local)
y reportó 4 problemas. Los cuatro quedaron corregidos a nivel de causa raíz,
no como parches de síntoma, siguiendo el mismo criterio que
`09-deploy-clasp.md`.

## 1. Algunos títulos de Task no eran clicables

**Síntoma:** en la lista de Tasks, algunas filas se veían idénticas a las
demás (mismo `cursor: pointer` vía CSS) pero el click no hacía nada — como
si fueran texto plano.

**Causa raíz:** cada fila se genera concatenando el ID dinámico directo
dentro de un literal JS de comillas simples:

```js
'<tr onclick="navigate(\'task-detail\', {taskId: \'' + t['Task ID'] + '\'})">'
```

Si ese ID alguna vez trae un apóstrofo (no lo genera `nextSequentialId`,
pero sí puede pasar si alguien edita una fila a mano en el Sheet real), el
apóstrofo cierra el literal antes de tiempo y deja un `SyntaxError` dentro
del atributo `onclick` — el navegador no puede ejecutar ese handler, así
que el click no produce ningún efecto. Visualmente la fila es
indistinguible de una que sí funciona, lo que explica el síntoma "solo
algunas". El mismo patrón (interpolar un ID dinámico crudo dentro de un
`onclick="...('...')"`) se repetía en ~25 sitios entre
`Client_Views.html` y `Client_Modals.html` (botones de acción de Task
Detail, subtareas, participantes, ajustes, modales).

**Corrección:** se agregó `escapeJsString()` en `Client_State.html`
(escapa `\` y `'`) y se aplicó en los ~25 sitios donde un valor dinámico
se interpola dentro de un literal JS de comillas simples. Dos sitios que
en realidad interpolaban dentro de un atributo HTML (`value="..."`, no
JS) se corrigieron con `escapeHtml` en vez de `escapeJsString`
(`userOptions`, `deptOptions`, el checkbox de reasignación en bloque).

**Test de regresión:** `e2e/layoutAndDashboard.e2e.test.js` — crea una
Task, le fuerza un `Task ID` con apóstrofo directo en el repositorio
(simulando una edición manual del Sheet) y verifica que la fila sigue
navegando a Task Detail correctamente.

## 2. El topbar desaparecía al hacer scroll

**Causa raíz:** `.app-shell` dependía de `min-height: 100vh` y `.content`
tenía `overflow-y: auto`, asumiendo que el scroll quedaría contenido
dentro de `.content` y que `.topbar`/`.sidebar` quedarían fuera de ese
scroll por estar en otro contenedor flex. Ese supuesto es frágil incluso
en un navegador normal, y **falla en el Web App real** porque Apps Script
sirve la app dentro de un iframe con su propio sandboxing de scroll/altura
— un detalle que solo se manifiesta en el despliegue real, no en el dev
server local (por eso no se detectó antes).

**Corrección:** `position: sticky; top: 0` en `.topbar` y en `.sidebar`
(con `height: 100vh; align-self: flex-start` en el sidebar para que no se
recorte), y se quitó el `overflow-y: auto` de `.content` — ahora la página
completa scrollea de forma natural y topbar/sidebar quedan fijos por CSS
`sticky`, sin depender de que el contenedor padre calcule bien su altura.

**Test de regresión:** `e2e/layoutAndDashboard.e2e.test.js` — genera 30
Tasks para forzar una lista más alta que el viewport, hace scroll y
verifica que `.topbar` no cambia de posición vertical.

## 3. El Dashboard solo contaba las Tasks propias, sin importar el rol

**Síntoma:** Eduardo (Manager + Admin) veía "Resumen de tus Tasks" con
conteos en cero o casi cero, porque `api_getDashboard` filtraba siempre
por `Owner ID === userId` — el mismo criterio para todos los roles.

**Causa raíz:** un descuido del build original de Fase 4: el Dashboard
nunca se condicionó por rol, a diferencia de la lista de Tasks
(`api_listTasks`/`_visibleTasksForUser`), que sí usa
`TaskPermissionService.canView` para decidir qué Tasks son visibles según
el alcance de cada rol (Agent: propias; Supervisor/Manager/Director:
departamento o más, ver sección 44 del prompt maestro).

**Corrección:** `api_getDashboard` ahora usa el mismo criterio de alcance
que la lista de Tasks:

- `_hasBroadDashboardScope(userId)`: true para Admin, Supervisor, Manager
  o Director.
- `_dashboardScopeTasksForUser(userId)`: parte de las Tasks visibles vía
  `TaskPermissionService.canView` (igual que `_visibleTasksForUser`); si
  el rol tiene alcance amplio devuelve `scope: 'DEPARTMENT'` con todas las
  visibles, si no `scope: 'OWN'` filtrando además por `Owner ID`.

La respuesta ahora incluye `scope` (`'OWN'` | `'DEPARTMENT'`), que el
cliente usa solo para variar el subtítulo ("Resumen de tus Tasks" vs.
"Resumen de las Tasks visibles para tu rol") — los conteos por estado ya
vienen correctamente filtrados desde el backend en ambos casos.

**Tests de regresión:** `test/dashboard.test.js` (Agent ve `OWN` y cuenta
1 de 2 Tasks; Manager+Admin y Supervisor ven `DEPARTMENT` y cuentan ambas;
"Vencidas" también respeta el scope) y
`e2e/layoutAndDashboard.e2e.test.js` (mismo comportamiento a través de la
UI real: Eduardo ve 2 Pendientes, Ana solo 1).

## 4. Llamadas de red innecesarias (carga lenta)

Se encontraron dos causas independientes, ambas corregidas:

**a) `SheetRepository.findAll()` sin cache.** Una sola llamada a
`api_getTaskDetail` dispara `_computeAvailableActions`, que llama
`TaskPermissionService.can()` ~12 veces — cada una releyendo por completo
`Task_Permissions` (87 filas) y `User_Roles` desde cero. Sin cache, eso
son 30-50+ operaciones `SpreadsheetApp` reales por un solo request, cada
una con latencia real en Apps Script (a diferencia del mock en memoria de
los tests, donde es instantáneo — por eso no se sentía "lento" hasta
probar en el ambiente real). Se agregó un cache estático por nombre de
hoja en `findAll()` (`SheetRepository._cache`), invalidado en
`create()`/`update()`. Como Apps Script arranca una ejecución nueva por
request, el cache nunca sirve datos obsoletos entre usuarios ni entre
llamadas al Web App separadas — como mucho dentro de la misma ejecución,
donde se invalida correctamente en cuanto hay una escritura.

**b) `update()` con un `getRange().getValues()` por fila.** Antes de
encontrar la fila a actualizar, `update()` hacía una lectura individual
por cada fila existente hasta encontrar el `id` buscado — O(N) llamadas a
Sheets, un riesgo de escalamiento a medida que las hojas crecen con uso
real. Se reemplazó por una sola lectura del rango completo
(`getRange(2, 1, lastRow - 1, headers.length)`) seguida de una única
escritura dirigida a la fila encontrada.

**c) `canBulkReassign` se repetía en cada render de Tasks.** En el
cliente, cada cambio de filtro en la vista de Tasks volvía a llamar
`Api.canBulkReassign(App.token)`, aunque el resultado depende solo del rol
(que no cambia dentro de la sesión). Se cacheó en `App._tasksCanBulk`,
pedido una sola vez por sesión y limpiado en `logout()`.

**Tests de regresión:** `test/repository.test.js` — nuevas pruebas que
cuentan llamadas a `sheet.getRange()` para verificar que `findAll()`
cachea entre llamadas y entre instancias nuevas del mismo repositorio, que
`create()`/`update()` invalidan el cache correctamente, y que los objetos
devueltos son copias (mutar un resultado no corrompe el cache
compartido). No se agregó un test dedicado para (c) por ser un detalle de
UI de bajo riesgo; queda cubierto indirectamente por los e2e existentes de
"Reasignar en bloque" (`taskLifecycle.e2e.test.js`), que siguen pasando
con el valor cacheado.
