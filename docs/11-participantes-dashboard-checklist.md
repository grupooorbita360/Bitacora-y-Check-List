# Selector de Participantes, tarjetas del Dashboard clicables y vista de Checklist

Tres pedidos de Eduardo probando Fase 4 en el navegador real: dos ajustes de
UX puntuales y avanzar con la vista de Checklist (backend de Fase 3, sin
vista propia hasta ahora — ver `docs/07-fase-4-decisiones.md`).

## 1. "Agregar Participante" ahora es un selector de nombres

**Antes:** un `<input>` de texto libre pedía el User ID a mano (`placeholder
"User ID (ej. U006)"`) — el usuario tenía que conocer y escribir
correctamente un ID interno.

**Ahora:** reutiliza `api_listAssignableUsers`, igual que ya hacían
Reasignar/Tomar Ownership/Nueva Task. Concretamente:

- `98_Api.js`: se extrajo `_assignableUsersForDepartment(departmentId)`
  (compartida por `api_listAssignableUsers` y `api_getTaskDetail`) y ahora
  `api_getTaskDetail` devuelve también `assignableUsers` — así el selector
  no necesita un segundo round-trip al abrir Task Detail.
- `Client_Views.html` → `sectionParticipants`: arma un `<select>` con
  `userOptions()` (el mismo helper de los otros modales) en vez del input;
  el `value` de cada `<option>` es el User ID, el texto visible es
  `Nombre Corto` — el ID nunca lo escribe ni lo ve el usuario, viaja "por
  debajo" como ya pedía el enunciado.
- Los participantes ya activos se excluyen del selector (agregar uno que
  ya está no falla — `TaskService.addParticipant` lo trata como no-op —
  pero verlo listado dos veces en el dropdown sería confuso).
- Bonus en la misma línea: la lista de participantes ya agregados también
  muestra `Nombre Corto` en vez del User ID crudo (`userDisplayName()`,
  con fallback al ID si el usuario ya no está en `assignableUsers` — por
  ejemplo, se desactivó después de agregado).

**Test de regresión:** `test/uxFixes.test.js` (assignableUsers en la
respuesta de `api_getTaskDetail`) y `e2e/uxFixes.e2e.test.js` (el input de
texto ya no existe, las opciones muestran nombres, y un participante ya
agregado no reaparece en el selector).

## 2. Las tarjetas del Dashboard filtran Tasks al hacer clic

**Antes:** Pendientes/En Progreso/En Espera/Vencidas eran puramente
informativas — clic no hacía nada.

**Ahora**, sección 44 del prompt maestro (no se tuvo el texto literal en
esta sesión — ver la nota de `docs/07-fase-4-decisiones.md` sobre las
secciones 44-57 — pero el pedido de Eduardo lo especificó explícitamente):
clic en una tarjeta navega a Tasks con ese estado como filtro activo.

- `Client_Views.html`: `statCard()` ahora recibe un literal `onclickCall`
  fijo (nunca un valor dinámico — mismo criterio de seguridad que el resto
  de los `onclick="navigate(...)"` sin argumentos de usuario) que llama a
  `goToTasksWithFilter(status, overdueOnly)`, la cual reemplaza
  `App.taskFilters` por completo y navega a `#/tasks`.
- Pendientes/En Progreso/En Espera pasan `status: 'PENDING'|'IN_PROGRESS'|
  'WAITING'` — el `<select>` de estado en Tasks ya refleja ese filtro como
  seleccionado (visiblemente activo, sin UI nueva).
- **Vencidas** no es un `Status` de Task, así que se agregó soporte real
  para eso: `_isOverdueTask(t, today)` en `98_Api.js` (extraída del
  cálculo que ya hacía `api_getDashboard`, ahora compartida) y un nuevo
  filtro `overdueOnly` en `_visibleTasksForUser` — el mismo criterio que
  cuenta la tarjeta es el que filtra la lista, así que el número de la
  tarjeta y lo que aparece en Tasks siempre coinciden. Se agregó también
  un checkbox "Vencidas" en el toolbar de Tasks (mismo patrón que "Solo
  mías") para que el filtro quede visible y se pueda apagar a mano.
- CSS: `.stat-card` ahora tiene `cursor: pointer` y un hover sutil
  (borde), para que la tarjeta se perciba como clicable.

**Test de regresión:** `test/uxFixes.test.js` (`overdueOnly` filtra igual
que cuenta el Dashboard, excluye vencidas ya completadas/canceladas, y se
combina bien con `status`) y `e2e/uxFixes.e2e.test.js` (clic en "En
Progreso" y en "Vencidas" navegan a Tasks con el filtro correcto aplicado
y visible).

## 3. Vista de Checklist

El backend (`44_ChecklistService.js`, sembrado con 3 actividades de
ejemplo en `95_SetupTasks.js`) y los 3 endpoints (`api_listChecklist`,
`api_recordChecklistRun`, `api_convertChecklistRunToTask`) ya existían
desde Fase 3 — faltaba únicamente la vista, tal como decía
`docs/07-fase-4-decisiones.md`.

### Qué no estaba disponible literalmente

Como con el resto de Fase 3/4, esta sesión nunca tuvo el texto literal de
la sección 38.1 (estructura de Checklist_Config/Checklist_Runs) ni de
44-57 (UI) del prompt maestro — mismo caso que se documentó para el resto
del frontend. Dos huecos puntuales que esto dejó, y cómo se resolvieron:

- **`Resultado` no tiene un enum validado en el backend** (ni en
  `44_ChecklistService.js` ni en `00_Config.js`) — es un string libre que
  se guarda tal cual. `OK`/`PROBLEMA` no son una convención inventada para
  esta vista: son los dos valores que ya usaba `test/checklist.test.js`
  desde Fase 3, y los únicos dos que el resto del sistema distingue
  (`convertRunToTask` solo tiene sentido para una ejecución "con
  problema"). La vista los adopta tal cual.
- **`Frecuencia` sigue siendo texto libre** (`docs/01-modelo-datos.md` ya
  lo marca como pendiente de normalizar a un catálogo cerrado). La vista
  solo tiene etiquetas para los dos valores ya sembrados (`DIARIA`,
  `SEMANAL_LUN`); cualquier otro valor se muestra tal cual llega del
  Sheet, sin romper.

Si al revisar la vista instalada hay diferencias de detalle con lo que
Eduardo tenía en mente para esas secciones, son ajustes de presentación
sobre un flujo funcional ya correcto — igual que se dejó dicho para el
resto de Fase 4.

### Qué se construyó

- **Nav**: tercer botón en el sidebar ("Checklist"), ruta `#/checklist`
  agregada al router de `Client_State.html`.
- **Lista**: `renderChecklistHtml()` pide `api_listChecklist(token,
  App.user['Department ID'])` y arma una tabla (Actividad + Ayuda
  colapsable con `<details>`, igual que el Historial de Task Detail — la
  sección 38.1 la pide como "tooltip/expandible"; Tipo, Frecuencia,
  Prioridad, botón Registrar).
- **Registrar ejecución**: modal (`openRecordChecklistModal`) con
  Resultado (OK/Problema), Valor (solo si `Tipo === 'DATA'`) y Comentario
  — obligatorio solo si el resultado es un problema, mismo patrón de
  validación al enviar que ya usa el modal de Posponer (SNOOZE).
- **Conversión a Task**: si el resultado registrado es "Problema", se
  ofrece de inmediato un segundo modal para convertir esa ejecución en una
  Task de seguimiento (`api_convertChecklistRunToTask`, ya devuelve
  `System Origin = CHECKLIST` y `Source Record ID` = el Run ID) — al
  confirmar, navega directo al detalle de la Task recién creada. El Run ID
  se toma de la respuesta directa de `api_recordChecklistRun` (que ya
  devolvía el ID creado desde Fase 3): no hace falta un endpoint nuevo de
  "historial de ejecuciones" para este flujo.
- **Sin polling**: a diferencia de Dashboard/Tasks/Task Detail, esta vista
  no tiene estado compartido que otra sesión pueda cambiar por debajo —
  cada registro lo dispara el propio usuario en el momento, así que no se
  programó auto-refresco cada 20s para ella.

### Qué queda deliberadamente fuera de esta vista

No se construyó un historial de ejecuciones pasadas (qué se registró hoy,
ayer, etc.) ni un estado "ya hecho hoy" por actividad — ninguno de los 3
endpoints existentes lo soporta, y agregar uno nuevo para eso habría sido
ampliar el backend en vez de solo construir la vista que pidió Eduardo.
Si hace falta ese historial (por ejemplo, para que un Supervisor valide
las "SUPs requeridos" de `Checklist_Config`, doble validación heredada de
la Bitácora original), es un endpoint nuevo a definir en una próxima
iteración.

**Test de regresión:** `test/uxFixes.test.js` (`api_listChecklist`,
`api_recordChecklistRun` + `api_convertChecklistRunToTask` end-to-end vía
la capa Api) y `e2e/uxFixes.e2e.test.js` (registrar OK en un ítem CHECK;
registrar un problema en un ítem DATA exige Valor y Comentario, y ofrece
convertir a Task, navegando al detalle de la Task creada).

## Regresión general

`npm test`: 81/81. `npm run test:e2e`: 20/20 (incluye un ajuste a
`taskLifecycle.e2e.test.js`, que todavía usaba el input de texto viejo
para agregar un participante — se actualizó al nuevo `<select>`).
