# Dos huecos de Visibility en asignación: reassign/bulkReassign y addParticipant

El enforcement de Visibility (`docs/13-visibility-enforcement.md`) cierra
el hueco de VER una Task, pero destapó dos lugares donde alguien podía
quedar como Owner o Participant de una Task que su propio rol ya no le
deja ver: `TaskService._applyReassign` (usado por `reassign` y
`bulkReassign`) valida que quien reasigna tenga permiso y que
`Task_Assignment_Config` lo permita, pero nunca que el rol del **nuevo**
Owner alcance la Visibility de la Task; `TaskService.addParticipant` tenía
el mismo hueco para el rol de la persona agregada.

## La corrección

**`TaskPermissionService.canReceiveAssignment(candidateUserId, task)`**
(nuevo, público) — el criterio compartido que pedía Eduardo, sin duplicar
lógica:

```
OPERATIONAL / RESTRICTED -> true (sin chequeo nuevo — ver más abajo)
SUPERVISION -> PermissionService.isSupervisorOrAbove(candidateUserId)
MANAGEMENT  -> PermissionService.isManagerOrAbove(candidateUserId)
```

Reusa las mismas primitivas `PermissionService.isSupervisorOrAbove`/
`isManagerOrAbove` que ya introdujo `docs/14-checklist-convert-role.md`
(Admin siempre pasa, resuelto dentro de ellas) — nada de repetir la lista
de roles una tercera vez.

**Por qué RESTRICTED y OPERATIONAL no necesitan un chequeo nuevo acá:**
`_visibilityAllows` (el enforcement de VER, `docs/13`) exige para
RESTRICTED ser Owner, Participant o Admin. El candidato a reasignar/
agregar está, por el propio acto, a punto de convertirse en exactamente
eso — el requisito se satisface solo. Agregar aquí una verificación
usando el estado ANTES de la operación (cuando el candidato todavía NO es
Owner/Participant) habría introducido una regresión real: nunca se
podría agregar a un primer Participant a una Task RESTRICTED, ni
reasignarla a nadie que no fuera ya su Owner. Por eso el pedido fue
explícito en que "RESTRICTED sin cambios" es el resultado correcto, no
una laguna — y así lo confirma el test dedicado.

**Dónde se llama:**

- `TaskService._applyReassign` (usada por `reassign` y, Task por Task,
  por `bulkReassign`): después de la validación de
  `Task_Assignment_Config`, antes de aplicar el cambio. Mensaje: `El rol
  de "<Nombre>" no alcanza la Visibility de esta Task (<VISIBILITY>).`
  — `bulkReassign` ya reporta el resultado Task por Task (`{taskId, ok,
  error}`) en vez de abortar todo el lote por una sola Task que choque
  con `Task_Assignment_Config`; esta Visibility se suma al mismo
  mecanismo sin tocarlo, porque a diferencia de `Task_Assignment_Config`
  (una sola validación para todo el lote, mismo `newOwnerId` en todas) la
  Visibility puede ser distinta en cada Task del lote.
- `TaskService.addParticipant`: después de validar `roleInTask`, antes de
  crear/reactivar el Participant. Mensaje: `No se puede agregar a esta
  persona como Participant: su rol no alcanza la Visibility de esta Task
  (<VISIBILITY>).`
- **`TaskService.takeOwnership` — no estaba en el pedido explícito, se
  agregó igual.** El modal de "Tomar Ownership" deja elegir cualquier
  usuario del departamento como nuevo Owner (no solo a uno mismo), así
  que tiene exactamente la misma forma de hueco que `_applyReassign`. Se
  cerró con la misma llamada a `canReceiveAssignment`, reusando el mismo
  helper — avisado acá por transparencia, no es parte de lo pedido
  literalmente.

## Selectores en la UI

`api_listAssignableUsers(token, departmentId, taskId)` ahora acepta un
`taskId` opcional: si se da (y el usuario puede ver esa Task), filtra con
`canReceiveAssignment`; sin `taskId` devuelve el departamento completo sin
filtrar — el comportamiento de siempre.

- **Reasignar / Tomar Ownership** (`Client_Modals.html`): ahora pasan el
  `taskId` a `Api.listAssignableUsers` — el selector de "Nuevo Owner" no
  ofrece a quien el backend rechazaría de todos modos.
- **Agregar Participante**: `api_getTaskDetail` ahora devuelve
  `eligibleAssignees` (filtrado por `canReceiveAssignment`) ADEMÁS de
  `assignableUsers` (sin filtrar, departamento completo). El selector de
  "Agregar" usa `eligibleAssignees`; `assignableUsers` se sigue usando
  tal cual para resolver el **nombre** de participantes YA agregados —
  filtrarlo ahí habría sido un efecto colateral real: un participante
  agregado antes de este chequeo (o cuya Task cambió de Visibility
  después) habría pasado de mostrar su nombre a mostrar su User ID crudo,
  sin que nada se lo pidiera. Dos campos, dos propósitos distintos.
- **Nueva Task / Reasignar en bloque**: sin cambios — no hay una sola
  Task contra la que filtrar (Nueva Task todavía no tiene una; Reasignar
  en bloque opera sobre varias, de Visibility potencialmente distinta).
  El rechazo, si corresponde, lo reporta el backend Task por Task como ya
  se describió arriba — no tiene sentido pre-filtrar un selector único
  contra N Tasks heterogéneas.
- Si de todas formas se fuerza un caso que el selector ya filtró (datos
  desincronizados, llamada directa a la API), el mensaje de error del
  backend queda igual de claro — no depende de que el cliente lo haya
  prevenido.

## Extra: `Checklist_Runs.Resultado` ahora se valida

`ChecklistService.recordRun` aceptaba cualquier string en `resultado`.
Se formalizó `Config.CHECKLIST_RESULT` (`OK`/`PROBLEMA` — el mismo
conjunto que ya ofrecía el `<select>` del frontend) y `recordRun` ahora
rechaza cualquier otro valor, incluyendo variaciones de mayúsculas/
minúsculas.

## Tests

- `test/visibilityAssignmentGaps.test.js`: `reassign`/`bulkReassign`/
  `takeOwnership`/`addParticipant` para cada combinación relevante — Agent
  rechazado en SUPERVISION, Supervisor permitido en SUPERVISION pero
  rechazado en MANAGEMENT, Manager/Director permitido en MANAGEMENT,
  Admin siempre permitido, RESTRICTED y OPERATIONAL sin cambios; el caso
  de `bulkReassign` reportando una Task por su cuenta sin abortar el
  lote; `eligibleAssignees` vs. `assignableUsers` en `api_getTaskDetail`
  y en `api_listAssignableUsers` con/sin `taskId`.
- `e2e/visibilityAssignmentGaps.e2e.test.js`: los selectores reales de
  Reasignar/Tomar Ownership/Agregar Participante no ofrecen a quien no
  alcanza, verificado en el navegador — no solo a nivel de API.
- `test/checklist.test.js`: validación de `Resultado` en `recordRun`.

`npm test`: 115/115 (100 + 15 nuevos). `npm run test:e2e`: 32/32 (29 + 3
nuevos).
