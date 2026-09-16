# Visibility como barrera real dentro de TaskPermissionService

Antes de Fase 5 (People), Eduardo pidió cerrar una brecha que
`docs/12-tabs-tasks-logout.md` ya había documentado: `Visibility`
(`OPERATIONAL | SUPERVISION | MANAGEMENT | RESTRICTED`, ver
`docs/02-reglas-negocio.md`) no estaba enforced dentro de
`TaskPermissionService.canView` — solo `Operational Scope` lo estaba, vía
las filas reales de `Task_Permissions`. Los filtros `SUPERVISION`/
`MANAGEMENT` de las pestañas de Tasks eran presentación pura: si el
cliente le hubiera ofrecido esas pestañas a un Agent, las habría visto
igual, porque nada en el backend lo impedía. Esto era crítico de cerrar
antes de Fase 5, que va a crear Tasks sensibles (Warnings, coaching)
apoyándose en `Visibility` como control de acceso real, no de UI.

## La regla implementada (`TaskPermissionService._visibilityAllows`)

`Visibility` es una barrera **adicional** a Alcance, no un reemplazo —
las dos se evalúan con AND. Se resuelve antes que Alcance dentro de
`can()` (y por lo tanto de `canView`, que es `can(userId,
Config.TASK_ACTIONS.VIEW, task)`), así que bloquea **cualquier** acción
sobre la Task, no solo verla — si no se puede ver, tampoco se puede
comentar, completar, reasignar, etc.

| Visibility | Quién pasa la barrera |
|---|---|
| `OPERATIONAL` | nadie queda bloqueado acá — sigue mandando solo el Alcance de siempre |
| `RESTRICTED` | Owner, Participant, o Admin |
| `SUPERVISION` | rol Supervisor, Manager o Director, o Admin |
| `MANAGEMENT` | rol Manager o Director, o Admin |
| cualquier otro valor (dato corrupto) | nadie salvo Admin — **fail-closed**, nunca se asume `OPERATIONAL` por defecto |

`PermissionService.isAdmin(userId)` se resuelve antes que esta barrera
(como ya hacía `can()`), así que Admin nunca la evalúa siquiera.

**Punto deliberado, y el más fácil de asumir mal:** `SUPERVISION` y
`MANAGEMENT` **no tienen excepción para Owner/Participant** — a
diferencia de `RESTRICTED`. Un Manager o Supervisor que sea, además,
dueño de una Task de Supervisión (por ejemplo, si convierte un Checklist
con problema a su propio nombre) la ve por su ROL, no por ser Owner. Y al
revés: un Agent que termina siendo Owner de su propia Task de seguimiento
con problema (el flujo real de "+Convertir en Task" no le impide
convertir su propio reporte) **no puede verla**, aunque sea "suya". Esto
es intencional, no un efecto colateral: es exactamente el caso de uso que
motivó el pedido — en Fase 5, el sujeto de un Warning o una nota de
coaching no debería tener acceso a esa Task solo por aparecer como Owner
en el registro.

## Por qué no rompió el flujo de Checklist → Supervisión

`ChecklistService.convertRunToTask` (desde
`docs/12-tabs-tasks-logout.md`) ya pone `Visibility=SUPERVISION` por
defecto en toda Task nacida de "+Convertir en Task". Con este
enforcement:

- Quien la convirtió, si es Agent, deja de poder verla — correcto, es
  justo el caso de uso de arriba.
- Un Supervisor (su propio Supervisor, o cualquiera con Alcance
  `DEPARTMENT`/`CROSS_DEPARTMENT` para `VIEW`) sigue viéndola sin ningún
  cambio: pasa la barrera de Visibility (rol Supervisor+) y el Alcance de
  siempre (`Task_Permissions` TP041/042). El flujo end-to-end (Checklist
  con problema → Task → Supervisor la ve, comenta, actúa) se verificó
  explícitamente en `test/visibilityEnforcement.test.js` después del
  cambio, no solo se asumió por no romper tests viejos.

## Dónde se enforca, y por qué alcanza con un solo lugar

`can()` es el único punto de entrada de todas las verificaciones de
permisos de Tasks — `TaskService.get()` (usado por `api_getTaskDetail`),
todas las transiciones de lifecycle, comentarios, participantes,
subtareas y ajustes pasan por `TaskPermissionService.can()` o `.canView()`
antes de tocar una Task. Agregar la barrera ahí, en un solo lugar, cierra
la brecha para **todo** — API directa incluida, no solo lo que el cliente
decide mostrar. `_visibleTasksForUser` (que alimenta `api_listTasks` y las
pestañas) ya filtraba por `canView` antes de aplicar cualquier
`filters.tab`, así que una Task que `canView` ahora niega desaparece de
absolutamente cualquier pestaña/filtro sin tocar esa capa — se verificó
que ni pidiendo `filters.tab=MANAGEMENT` explícito un Supervisor puede
traerla de vuelta.

`canBulkReassign(userId)` no recibe una Task concreta (evalúa la
capacidad general del rol antes de elegir con cuáles Tasks operar), así
que no aplica ni necesita esta barrera — el filtro real ocurre Task por
Task cuando `bulkReassign` sí evalúa `can()` sobre cada una.

## Qué NO cambia

- El Alcance (`Operational Scope`: `OWN`/`SHARED`/`DEPARTMENT`/
  `CROSS_DEPARTMENT`/`ALL`) sigue siendo la primera línea de defensa, sin
  ningún cambio en `_evaluateScope`. `Visibility` es una barrera aparte
  que se le suma, nunca la sustituye.
- Una Task `OPERATIONAL` (la inmensa mayoría de las existentes, y el
  default cuando no se especifica) se comporta exactamente igual que
  antes — cero riesgo de regresión ahí, confirmado corriendo toda la
  suite existente sin ningún cambio en sus resultados.

## Tests

`test/visibilityEnforcement.test.js` — 8 casos: cada nivel de Visibility
por separado (incluyendo el caso puntual pedido: un Supervisor con
Alcance `DEPARTMENT` real NO puede ver una Task `MANAGEMENT`), que la
barrera bloquea cualquier acción y no solo `VIEW`, que se enforca también
llamando `api_getTaskDetail`/`api_listTasks` directo (no solo a través de
`TaskPermissionService`), el flujo completo de Checklist→Supervisión
verificado extremo a extremo para quien sí tiene rol suficiente, y que un
valor de `Visibility` desconocido se niega por defecto en vez de tratarse
como `OPERATIONAL`.

Toda la suite existente (`npm test`: 95/95, `npm run test:e2e`: 27/27) se
corrió después del cambio sin modificar ningún test previo — la única
corrección necesaria fue de documentación (`docs/12-tabs-tasks-logout.md`
tenía una afirmación sobre visibilidad propia que este enforcement
vuelve incorrecta; corregida en su lugar, ver la nota ahí).
