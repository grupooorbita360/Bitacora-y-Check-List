# Fase 3 — decisiones, datos reales y lo que queda pendiente

Registro histórico: qué de Fase 3 partió como motor de código inferido (por
no tener el contenido literal del Sheet en esa sesión) y cómo se resolvió
después con los datos reales que Eduardo confirmó y compartió.

## 1. Task_Permissions (TP001–TP087) y Task_Assignment_Config (TA01–TA19) — RESUELTO

Las 87 + 19 filas reales ya están sembradas en `bootstrapTestEnvironment()`
(`apps-script/src/95_SetupTasks.js`, funciones `_seedTaskPermissionsReal` /
`_seedTaskAssignmentConfigReal`), tal como las compartió Eduardo. El motor
de permisos (`apps-script/src/40_TaskPermissionService.js`) las lee en vez
de derivarlas:

- **Por acción**: si la acción tiene al menos una fila en `Task_Permissions`
  (para cualquier rol), se resuelve EXCLUSIVAMENTE con esas filas — un rol
  sin fila para esa acción específica es una negación real de los datos
  (ej. Agent nunca tiene fila para `REASSIGN`, así que un Agent jamás puede
  reasignar, ni su propia Task, sin importar qué diga la lógica derivada).
- Si la acción no tiene ninguna fila en la tabla (`OPEN`, `RESUME`,
  `COMPLETE_SUBTASK` — no están modeladas ahí), se usa la lógica derivada
  de respaldo (`_fallbackCan`), documentada en el propio archivo.
- **Alcance** (`ALL`/`DEPARTMENT`/`CROSS_DEPARTMENT`/`OWN`/`PARTICIPANT`/
  `SHARED`) se evalúa contra la Task: `SHARED` específicamente compara
  `Tasks['Operational Scope'] === 'SHARED'` — así se explica que `Agent`
  tenga `TAKE_OWNERSHIP` en Alcance `SHARED` (TP084): puede tomar ownership
  de una Task ajena marcada como compartida, igual que el caso "Task
  Shared" de la sección 10, sin necesitar ser Participant.
- `Task_Assignment_Config` responde una pregunta distinta y complementaria
  (`apps-script/src/47_TaskAssignmentService.js`): no "¿puedo tocar esta
  Task?" sino "¿puedo convertir a esta persona en el nuevo Owner?", según
  el rol de origen/destino y si comparten `Department ID`
  (`Mismo_Departamento`). Se valida en `reassign`, `bulkReassign` y
  `takeOwnership`, además del chequeo de `Task_Permissions`.
- `Requiere_Aprobacion` es `NO` en las 19 filas reales — se lee y se
  guarda, pero hoy no cambia el flujo (no hay ninguna fila que lo active).
  El flujo de aprobación de Fase 3 sigue siendo `Task_Adjustments`
  (request/approve/reject), el mecanismo aparte para cuando no hay ninguna
  regla directa de asignación (ej. un Agent pidiendo reasignar).
- Un dato real cambió el diseño original en un caso concreto: `BULK_REASSIGN`
  tiene sus propias filas (TP085-87), distintas de `REASSIGN` — un
  Supervisor puede reasignar una Task individual cross-department (TP049)
  pero su `BULK_REASSIGN` solo alcanza su propio departamento (TP087, sin
  fila `CROSS_DEPARTMENT`). `TaskService._applyReassign` distingue ambas
  acciones para que esto se cumpla por Task, no solo a nivel de "permiso
  general de usar bulk".

**Qué falta**: acciones reales no enforced todavía en ningún método de
`TaskService` — `CREATE`, `EDIT`, `ASSIGN`, `VIEW_HISTORY`, `VIEW_SUBTASKS`
están en `Config.TASK_ACTIONS` y sembradas en `Task_Permissions`, pero
ningún método las invoca aún (la creación se sigue gateando solo por
`Task_Config`, que es más específico por Task Type). No es un error — es
trabajo de refinamiento futuro, señalado para no quedar silencioso.

## 2. Los 18 tipos de evento de Task_History — parcialmente resuelto

Se corrigieron los tres puntos que Eduardo señaló contra el Sheet real:

```
CREATED, ASSIGNED, OPENED, OWNERSHIP_TAKEN, COMPLETED, CANCELLED, REOPENED,
SNOOZED, RESUMED, COMMENT_ADDED, REASSIGNED, ADJUSTMENT_REQUESTED,
ADJUSTMENT_APPROVED, ADJUSTMENT_REJECTED, PARTICIPANT_ADDED,
PARTICIPANT_REMOVED, SUBTASK_CREATED, SUBTASK_COMPLETED
```

- Se agregó `ASSIGNED` (faltaba): `TaskService.create()` lo registra cuando
  quien crea la Task no es su Owner (asignación explícita), aparte de
  `CREATED`. No se registra si uno se crea la Task a sí mismo.
- Se quitó `ADJUSTMENT_CANCELLED` (no existe en el Sheet real):
  `TaskService.cancelAdjustment()` ya no escribe a `Task_History` — la
  cancelación queda completamente reflejada en `Task_Adjustments.Status` +
  `Resolved By ID`/`Resolved At`/`Resolution Comment`.
- Se renombró `SUBTASK_ADDED` a `SUBTASK_CREATED` en `Config.HISTORY_EVENTS`
  y en `TaskService.addSubtask()`.

Siguen 18 eventos en total, empezando en `CREATED` y terminando en
`SUBTASK_COMPLETED`, como confirma el prompt maestro.

## 3. Task_Participants — columna "Role in Task" — RESUELTO

`TaskService.addParticipant(taskId, userId, actingUserId, roleInTask)`
ahora recibe el rol como parámetro, validado contra los 4 valores reales
(`Config.TASK_PARTICIPANT_ROLES`): `COLLABORATOR | SUPPORT | REVIEWER |
OBSERVER`. Por defecto es `COLLABORATOR` si no se especifica. Un valor
fuera de esa lista lanza error.

## Qué SÍ era literal desde el principio y no necesitó reconciliarse

- `Task_Status_Config` (TS01–05) y `Task_Status_Transitions` (ST01–10):
  tomados palabra por palabra de las secciones 12-13, con sus reglas de
  comentario/fecha de revisión obligatorios.
- `Task_Config` (TC01–19, sin "Reasignación"): el catálogo ya corregido en
  `01-modelo-datos.md`.
- Estructura de 27 columnas de `Tasks`, `Task_Adjustments` (Types/Status),
  `Task_Subtasks` (PENDING/COMPLETED/CANCELLED, no completa la Task padre).
- `Checklist_Config`/`Checklist_Runs` y la regla de conversión a Task
  (`System Origin = CHECKLIST`, `Source Record ID` = la ejecución, no la
  plantilla).
