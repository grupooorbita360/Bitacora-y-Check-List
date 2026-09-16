# Bug de logout y pestañas de Tasks por rol (sección 44 del prompt maestro)

Dos pedidos de Eduardo: un bug que dejaba la app congelada al cerrar
sesión, y la navegación por pestañas de Tasks que todavía faltaba de
Fase 4 (hoy era una sola lista plana con filtros, sin distinguir por rol).

## 1. Bug de logout: la app quedaba congelada en "Verificando sesión…"

**Causa raíz:** `logout()` (`Client_State.html`) limpiaba el token y el
usuario y llamaba `navigate('login')`, que solo cambia `App.route` y
vuelve a pintar — nunca vuelve a llamar `Api.startLogin()`. La pantalla de
login se decide por `App.loginState`, que **solo se actualiza dentro de
`bootApp()`** (`Client_Main.html`): para un usuario DIRECT (email único,
como Eduardo), `bootApp()` nunca lo toca (pasa directo a `afterLogin()`),
así que se queda para siempre en su valor inicial `{mode:'LOADING'}` — de
ahí que la pantalla mostrada tras logout fuera exactamente "Verificando
sesión…", sin que nada la resolviera hasta refrescar la página a mano.

**Corrección:** `logout()` ahora llama `bootApp()` en vez de
`navigate('login')` — vuelve a correr la detección DIRECT/SELECT_PIN/
DENIED desde cero, igual que al abrir la app por primera vez.

**Test de regresión:** `e2e/auth.e2e.test.js` — dos casos nuevos. El de la
vía DIRECT es el que realmente reproduce el bug reportado (se verificó
manualmente revirtiendo el fix: el test falla por timeout esperando
"Dashboard", confirmando que antes sí se quedaba congelado); el de
SELECT_PIN cubre el mismo camino para el login compartido y que se pueda
volver a entrar con otro usuario después de salir.

## 2. Pestañas de Tasks por rol + desglose por persona + agrupación de Supervisión

### Qué no estaba disponible literalmente

Como el resto de Fase 4, esta sesión nunca tuvo el texto literal de la
sección 44 del prompt maestro — solo la descripción que dio Eduardo en su
pedido. Dos decisiones de diseño que tuvo que resolver esta sesión sin ese
texto, documentadas para que se puedan ajustar si difieren de la intención
original:

- **Qué pestañas ve cada rol es acumulativo**: la lectura literal del
  pedido ("Agent ve X; Supervisor agrega Y; Manager/Director agregan Z")
  se interpretó como que cada nivel hereda las pestañas del anterior
  (Manager/Director también ven "Supervisión", no solo "Departamento" y
  "Management") — confirmado por la propia frase del pedido: "así el
  Gerente/Supervisor las ve agrupadas en un solo lugar", que asume que
  ambos roles tienen acceso a esa pestaña.
- **"Equipo" (Supervisor) y "Departamento" (Manager/Director) son la
  misma consulta con distinta etiqueta**, no dos alcances distintos: las
  87 filas reales de `Task_Permissions` ya le dan a un Supervisor el mismo
  alcance de `canView` que a un Manager (DEPARTMENT/CROSS_DEPARTMENT,
  confirmado en `docs/06-fase-3-decisiones.md`), así que no había una
  regla de negocio real que diferenciara "mi equipo directo" de "todo el
  departamento" para inventar. Se prefirió reusar el motor de permisos ya
  construido y correcto antes que crear una noción nueva de "a quién
  supervite directamente" sin una fuente de verdad para ella.

### Pestañas y su filtro (`filters.tab` en `98_Api.js`)

Cada pestaña es una capa de filtrado **adicional** sobre lo que
`TaskPermissionService.canView` ya permitía ver — nunca amplía el acceso,
solo lo organiza para la UI:

| Tab (backend) | Pestaña (UI) | Quién la ve | Filtro |
|---|---|---|---|
| `MINE` | Mis Tasks | todos | `Owner ID` = yo, sin CANCELLED/COMPLETED |
| `TEAM` | Equipo (Agent/Supervisor) o Departamento (Manager/Director/Admin) | todos | visible para mí, sin CANCELLED/COMPLETED, sin Visibility Supervisión/Management (incluye las propias) |
| `WAITING` | En espera | todos | Status = WAITING, cualquier Owner |
| `DONE` | Completadas | todos | Status ∈ {COMPLETED, CANCELLED}, cualquier Owner |
| `SUPERVISION` | Supervisión | Supervisor y superior | Visibility = SUPERVISION |
| `MANAGEMENT` | Management | Manager/Director/Admin | Visibility = MANAGEMENT |

`TEAM` deliberadamente **no excluye** al propio usuario (a diferencia de
un primer diseño que sí lo hacía): un Manager puede terminar siendo Owner
de una Task de su equipo (por ejemplo, si convierte un Checklist con
problema a su propio nombre) y debe seguir viéndola en el desglose, no
perderla. Lo que sí excluye siempre es Visibility Supervisión/Management,
que es justamente el requisito de "agruparlas en un solo lugar en vez de
mezcladas con todo lo demás".

**Nota de seguridad (actualizada — ver `docs/13-visibility-enforcement.md`):**
al escribir esta sección, `Visibility` (`OPERATIONAL | SUPERVISION |
MANAGEMENT | RESTRICTED`) todavía no estaba enforced dentro de
`TaskPermissionService.canView` — los filtros `SUPERVISION`/`MANAGEMENT`
de esta pestaña eran un criterio de **presentación**, no de control de
acceso real. Esa brecha se cerró antes de Fase 5: `canView` (y por lo
tanto `can()` para cualquier acción) ahora enforca `Visibility` como una
barrera real, independiente del Alcance. Ver `docs/13-visibility-enforcement.md`
para la regla exacta y por qué también corrigió la afirmación de la
sección "Paridad con las tarjetas del Dashboard" de más abajo (un Agent
Owner de su propia Task de Supervisión **ya no** la ve, a propósito).

### Paridad con las tarjetas del Dashboard

Las tarjetas del Dashboard (`docs/11-participantes-dashboard-checklist.md`)
ya navegaban a Tasks con un filtro de estado al hacer clic. Con pestañas,
esa navegación tenía que caer en la pestaña correcta o el número clicado y
lo que aparece en Tasks dejarían de coincidir:

- Card click ahora también resuelve el `tab` (`MINE` para scope `OWN`,
  `TEAM` para scope `DEPARTMENT`) antes de navegar
  (`goToTasksWithFilter(tab, status, overdueOnly)`).
- Para que la paridad sea exacta, `_dashboardScopeTasksForUser` (scope
  `DEPARTMENT`) ahora también excluye Visibility Supervisión/Management de
  sus conteos — el mismo criterio que ya aplica la pestaña `TEAM`. Antes
  de este cambio, una Task de Checklist-con-problema (Visibility=
  SUPERVISION) sí se contaba en "Pendientes" del Dashboard pero
  desaparecía al hacer clic (porque el borrador inicial de `TEAM` ya la
  excluía) — se corrigió por el lado del Dashboard, no relajando el filtro
  de `TEAM`, precisamente para no volver a mezclar esas Tasks.
- El scope `OWN` (Agent) no cambió: sigue siendo simplemente `Owner ID` =
  yo, sin exclusión de Visibility en el filtro de `_dashboardScopeTasksForUser`
  ni en el tab `MINE`. **Corrección sobre lo que decía esta sección
  originalmente:** eso NO significa que un Agent siga viendo su propia
  Task si es Visibility=SUPERVISION/MANAGEMENT — desde
  `docs/13-visibility-enforcement.md`, `canView` la bloquea para él antes
  de que el filtro por Owner de este scope siquiera se evalúe (por diseño:
  ver la nota de seguridad de más arriba). El comentario "ocultársela
  sería activamente dañino" describía la intención de este código en
  particular (no discriminar por Owner en el propio filtro de scope), no
  una garantía de que el Agent SIEMPRE vería esa Task — esa garantía la
  da (o no) `canView`, una capa antes.

### Desglose por persona (pestaña Equipo/Departamento)

Puramente client-side (`Client_Views.html`): `computeOwnerBreakdown()`
agrupa por `Owner ID` el array COMPLETO que devolvió el servidor para el
tab `TEAM` (antes de aplicar cualquier filtro por persona) y arma un chip
"Nombre: N" por cada Owner encontrado, más un chip "Todos (N)". Clic en un
chip filtra la tabla a esa persona (`App.teamOwnerFilter`, aplicado en el
navegador sobre el array ya traído — no dispara un round-trip nuevo). El
nombre viene del propio campo `Owner` que cada Task ya trae (el mismo que
pinta la columna "Owner" de la tabla), no hace falta resolverlo aparte.

El polling de Tasks calcula su "versión" (para decidir si hace falta
volver a pedir la lista) sobre el array COMPLETO del tab, no sobre el
recorte por persona — si no, elegir a alguien haría que el polling
pensara todo el tiempo que algo cambió (el conteo ya no coincidiría con lo
que ve el servidor).

### `+Convertir en Task` ahora cae en Supervisión por defecto

`ChecklistService.convertRunToTask` cambió su `Visibility` por defecto de
`OPERATIONAL` a `SUPERVISION` — una Task nacida de "+Convertir en Task" es
por definición el seguimiento de un problema de Checklist (o, a futuro,
Bitácora — `System Origin=BITACORA` ya existe en el enum pero todavía no
lo genera ningún flujo real), y ahora cae automáticamente en la pestaña
Supervisión sin mezclarse con el resto de Tasks del departamento — el
flujo que pedía Eduardo. Un caller puede seguir pasando otra `Visibility`
explícita si hiciera falta; solo cambió el valor por defecto.

**Tests de regresión:** `test/taskTabs.test.js` (semántica de cada
`filters.tab`, paridad Dashboard↔TEAM, y que `convertRunToTask` cae en
Supervisión) y `e2e/taskTabs.e2e.test.js` (pestañas visibles por rol,
desglose por persona con drill-down y "Todos", y que una Task de Checklist
con problema aparece en Supervisión y no en Departamento).

## Regresión general

`npm test`: 87/87. `npm run test:e2e`: 27/27.
