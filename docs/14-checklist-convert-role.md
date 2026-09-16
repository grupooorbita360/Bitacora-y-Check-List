# "+Convertir en Task" pasa a ser acción de Supervisor, no de Agent

El enforcement de Visibility (`docs/13-visibility-enforcement.md`) destapó
una inconsistencia real: `api_convertChecklistRunToTask` no tenía ninguna
restricción de rol, así que un Agent podía convertir su propio Checklist
con problema y quedar como Owner de una Task `Visibility=SUPERVISION` que
él mismo ya no podía ver (correcto, por el enforcement recién cerrado) —
quedaba huérfana hasta que un Supervisor la encontrara por su cuenta. La
sección 36 del prompt maestro ya decía que convertir es acción de
Supervisor, no de Agent — el Agent solo reporta.

## La corrección

**Backend** (`44_ChecklistService.js`, `convertRunToTask`): rechaza con
`Error('Solo un Supervisor o superior puede convertir una ejecución de
Checklist en Task de seguimiento.')` a quien no sea Supervisor, Manager,
Director o Admin. Se apoya en dos primitivas nuevas en
`23_PermissionService.js` (`isManagerOrAbove`/`isSupervisorOrAbove`,
resueltas por `userId` — Admin siempre pasa), pensadas para reutilizarse
fuera del motor de Tasks, a diferencia de los helpers equivalentes ya
existentes dentro de `TaskPermissionService` (que trabajan sobre un array
de roles ya resuelto, de uso interno a ese archivo).

`recordRun` (el reporte en sí — marcar una actividad como "Problema") NO
cambió: sigue abierto a cualquier rol. La restricción es solo sobre
convertir, no sobre reportar.

**Frontend** (`Client_Modals.html`): si el resultado registrado es un
problema y quien lo registró NO califica (`userIsSupervisorOrAbove()`,
nueva utilidad compartida en `Client_State.html`, también reusada ahora
por `taskTabsForUser()` en `Client_Views.html` en vez de repetir la lista
de roles), no se le ofrece el modal de conversión — un toast le avisa que
un Supervisor deberá convertirlo. Para quien sí califica, el flujo no
cambió (modal "¿Convertir en Task?" → "Crear Task").

## Qué pasa con la Task que un Agent reportó y no puede convertir

Eduardo fue explícito sobre esto: el Checklist con "Problema" ya queda
visible para el Supervisor **una vez creada la Task** (pestaña
Supervisión, `docs/12-tabs-tasks-logout.md`) — eso ya funcionaba y no
cambió. Lo que esta sesión **no construyó a propósito** es un mecanismo
de descubrimiento de ejecuciones de Checklist con problema que **todavía
no se convirtieron** en Task (ej. una lista de "problemas pendientes de
convertir" para el Supervisor, o una notificación). Eso quedó fuera del
pedido explícito ("ya lo está, vía la pestaña Supervisión una vez creada
la Task") — si hace falta, es una vista nueva a definir en una próxima
iteración, en la misma línea de lo que ya se dejó fuera de la vista de
Checklist en `docs/11-participantes-dashboard-checklist.md`.

## Por qué el ownerId sigue pudiendo ser el Agent

`convertRunToTask` sigue aceptando `overrides.ownerId` — quien convierte
(ahora siempre Supervisor+) puede seguir asignando la Task resultante al
Agent que reportó el problema, si así corresponde operativamente. Lo que
cambió es quién puede **crear** esa Task, no quién puede terminar siendo
su Owner. Un Agent asignado así de todas formas no podrá ver esa Task
(por el enforcement de Visibility=SUPERVISION, sin excepción para Owner —
ver `docs/13-visibility-enforcement.md`), que es la razón original por la
que esta restricción de rol se volvió necesaria.

## Tests

- `test/checklistConvertRole.test.js`: `recordRun` sigue abierto a
  cualquier rol; `PermissionService.isSupervisorOrAbove` clasifica
  correctamente Agent (no) vs. Supervisor/Manager/Director/Admin (sí); un
  Agent no puede convertir ni su propio reporte ni el de otro (mensaje de
  error exacto); Supervisor/Manager/Director/Admin sí pueden; y el
  rechazo se enforca también en la capa Api
  (`api_convertChecklistRunToTask`), no solo en `ChecklistService`
  directo.
- `e2e/checklistConvertRole.e2e.test.js`: un Agent que reporta un
  problema no ve el modal de conversión (solo el toast), un Supervisor sí
  lo ve y puede completar el flujo hasta crear la Task.
- `test/visibilityEnforcement.test.js` se ajustó: el caso que probaba el
  flujo Checklist→Supervisión ahora hace que Marta (Supervisor) convierta
  en vez de Ana (Agent) — antes de esta sesión ese test asumía (sin
  probarlo) que un Agent podía convertir su propio reporte, que es
  exactamente la inconsistencia que esta corrección cierra.

`npm test`: 100/100. `npm run test:e2e`: 29/29.
