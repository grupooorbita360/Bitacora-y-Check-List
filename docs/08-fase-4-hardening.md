# Fase 4 — hardening previo a Fase 5

Tres correcciones pedidas por Eduardo después de validar Fase 4 en el
ambiente real, antes de arrancar Fase 5 (People).

## 1. Specs de Playwright guardadas como tests reales del repo

Las pruebas que antes eran scripts sueltos (`/tmp/smoke_*.js`, usados solo
para verificar Fase 4 a mano) ahora viven en `apps-script/e2e/*.e2e.test.js`
y corren con `node --test` (igual que los tests de backend) — sin agregar
`@playwright/test` como corredor nuevo, solo el paquete `playwright` como
devDependency:

```
cd apps-script
npm run test:e2e
```

- `e2e/helpers.js`: `launchBrowser()` (con fallback a
  `/opt/pw-browsers/chromium` si el resolver por defecto no encuentra
  Chromium) y `withDevServer(fn)`, que arranca una instancia aislada del
  dev server (`devserver/server.js`, ahora exportado como
  `createDevServer({ port })` además de CLI) con backend propio por test.
- `e2e/auth.e2e.test.js`, `e2e/taskLifecycle.e2e.test.js`,
  `e2e/adjustmentFlow.e2e.test.js`: la conversión directa de los scripts
  manuales de Fase 4 (login DIRECT/SELECT_PIN/DENIED, PIN incorrecto,
  crear+asignar+abrir+comentar, subtareas, participantes, snooze, bulk
  reassign, y el flujo completo de Adjustment con Agent bloqueado →
  Supervisor aprueba/rechaza).
- `e2e/autoRefresh.e2e.test.js`: nuevo, cubre el punto 3 de abajo.

`node_modules/` se agregó a `.gitignore` (no existía antes); `playwright`
se instaló de verdad (`npm install`, no un symlink) porque el registro de
npm es alcanzable desde este entorno — en uno sin red, `npm install`
seguiría sirviendo mientras el registro esté accesible; si no lo está, no
hay forma de correr `test:e2e` hasta poder instalar el paquete (los specs
en sí no dependen de red, solo de tener `playwright` resuelto).

## 2. IDs atómicos (`nextSequentialId`)

**Antes**: `SheetRepository.nextSequentialId(prefix, padLength)` contaba
filas del Sheet (`findAll().length + 1`). Dos usuarios creando una Task al
mismo tiempo podían leer el mismo conteo antes de que la fila del otro se
escribiera, y terminar con el mismo `Task ID`.

**Ahora** (`apps-script/src/10_SheetRepository.js`): el consecutivo vive en
Script Properties, una key por prefijo (`SEQ_T`, `SEQ_ADJ`, `SEQ_SUB`,
`SEQ_H`, `SEQ_RUN`), y el ciclo leer-incrementar-guardar ocurre dentro de
`LockService.getScriptLock().waitLock(30000)` / `releaseLock()` en un
`try/finally` (el lock se libera aunque algo falle a mitad de camino, para
no trabar al siguiente usuario). El formato sigue siendo el mismo
(`T00001`, `ADJ00001`, prefijo + consecutivo con padding) — no se cambió a
UUID.

Script Properties es compartido por **todos** los usuarios del Web App
(no es por-usuario), que es justamente lo que hace falta para un contador
global atómico. `test/mocks/gasGlobals.js` agrega un mock de `LockService`
con la misma forma que la API real, para que este archivo corra sin
cambios contra el mock y contra Apps Script real.

Cobertura: `test/repository.test.js` — consecutivo por prefijo, contadores
independientes entre prefijos, que sobrevive a `softDelete`/nuevas
instancias del repositorio (ya no depende de contar filas), y que
`waitLock`/`releaseLock` se llaman siempre (incluso si el incremento
falla a mitad de camino).

## 3. Auto-refresco (Dashboard, Tasks, Task Detail)

Cada una de las tres vistas se refresca sola cada 20 segundos mientras
está montada, pausado si `document.visibilityState !== 'visible'`
(`apps-script/html/Client_State.html`):

```js
function startPolling(intervalMs, checkFn) {
  function tick() {
    if (document.visibilityState === 'visible') checkFn();
  }
  var timer = setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', tick); // sin esperar al próximo tick al volver a la pestaña
  return function stop() { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
}
```

`render()` llama `stopPolling()` primero siempre, y programa el poll que
corresponda a la ruta recién renderizada — así nunca hay dos vistas
sondeando a la vez ni un poll de una vista vieja sobreviviendo a una
navegación.

**"Endpoint liviano que no relee todo el detalle si no hay cambios"**:

- **Task Detail** (el caso pesado: trae history + subtasks + participants
  + pendingAdjustments + recalcula availableActions): `api_getTaskVersion`
  devuelve solo `{ updatedAt, historyCount, subtasksCount,
  participantsCount, pendingAdjustmentsCount }` — cinco números. El
  cliente guarda esa misma forma calculada localmente al cargar el detalle
  completo (`computeTaskVersionFromDetail`, sin pedirla aparte) y en cada
  tick compara; solo si cambió pide `api_getTaskDetail` de nuevo.
- **Tasks** (lista): mismo patrón con `api_getTasksVersion` →
  `{ count, latestUpdatedAt }` sobre las Tasks visibles con los filtros
  actuales (`_visibleTasksForUser`, compartida con `api_listTasks` para
  que ambas coincidan en qué Tasks cuentan).
- **Dashboard**: `api_getDashboard` ya es liviano en sí mismo (cuenta
  Tasks por estado, no trae detalle de cada una), así que el polling lo
  llama directo cada 20s sin un paso de "versión" aparte — agregar uno
  ahí no habría evitado ningún trabajo real.

Cobertura:
- `test/apiPolling.test.js` (backend, sin navegador): la versión cambia
  con una Task nueva que sí matchea los filtros y no cambia si no
  matchea; cambia con `Updated At` (transitions/reassign/ownership cuya
  Task ya estaba contada); para Task Detail, cambia con un comentario, con
  subtareas (crear y completar), y con aprobar un ajuste
  (`pendingAdjustmentsCount` vuelve a 0). También que devuelve `null` si
  la Task no existe o el usuario no puede verla.
- `e2e/autoRefresh.e2e.test.js` (navegador real, con `page.clock` para
  adelantar el reloj virtual sin esperar 20s reales): un cambio hecho
  "por otra sesión" directo contra el backend del dev server aparece en
  Task Detail y en la lista de Tasks después de adelantar el reloj, y NO
  antes; y que con la pestaña oculta (se simula redefiniendo el getter de
  `document.visibilityState`, ya que no se puede setear nativamente en un
  test) no se dispara ningún refresco hasta volver a estar visible.

### Limitación conocida (no resuelta, a propósito)

Si llega un cambio del backend justo cuando el usuario está escribiendo
en un campo (buscador de Tasks, un comentario a medio escribir) y el poll
dispara un re-render, ese `innerHTML` completo del panel de contenido
puede perder lo que llevaba tecleado sin enviar — el poll no intenta
preservar el foco/valor de inputs no confirmados. Para un equipo chico
usando esta plataforma es un caso borde poco frecuente; resolverlo bien
(diffing en vez de reemplazar el HTML) es más complejidad de la que esta
tarea pedía — queda señalado, no resuelto en silencio, por si se vuelve
un problema real de uso.
