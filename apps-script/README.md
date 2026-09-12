# Fase 2 + Fase 3 + Fase 4 — Plataforma Operativa

Código fuente de la capa foundation (Config, Repository/DAO, Auth, Users,
Departments, Permissions — Fase 2), el núcleo de Tasks + Checklist (Fase 3:
lifecycle, history, comments, participants, subtasks, adjustments, bulk
reassignment, Checklist_Config/Checklist_Runs y conversión a Task) y el
frontend (Fase 4: Login, Layout, Navigation, Dashboard, Tasks, Task detail,
Modals — SPA sobre Apps Script HTML Service). Ver
`docs/00-arquitectura-general.md`, `docs/01-modelo-datos.md`,
`docs/06-fase-3-decisiones.md` y `docs/07-fase-4-decisiones.md` en la raíz
del repo para las decisiones de arquitectura detrás de este código.

Este es el **entorno de construcción** ("afuera") del protocolo de
despliegue (`docs/04-protocolo-despliegue.md`) — vive en el repo personal,
se prueba contra un Sheet personal, y se copia manualmente al proyecto de
Apps Script de la empresa cuando está listo. No hay `clasp push` automático
ni conexión directa entre este repo y el Workspace de la empresa.

## Estructura

```
src/
  00_Config.js               Namespace Config: nombres de hojas, roles, Script Properties.
  10_SheetRepository.js      Repository/DAO genérico (CRUD por nombre de columna).
  11_DepartmentsRepository.js
  12_UsersRepository.js
  13_UserRolesRepository.js
  14_AuthCredentialsRepository.js
  20_AuthService.js          Login de dos vías (email único vs. compartido + PIN).
  21_UserService.js
  22_DepartmentService.js
  23_PermissionService.js    Primitivas de RBAC (hasRole/isAdmin/canAccessDepartment).
  30_TasksRepository.js .. 39_ChecklistRunsRepository.js   Repositorios de Tasks/Checklist.
  40_TaskPermissionService.js  Motor de permisos de Tasks (ver docs/06-fase-3-decisiones.md).
  41_TaskHistoryService.js
  42_TaskConfigService.js     Task Types permitidos por rol/departamento (Task_Config).
  43_TaskService.js           CRUD, lifecycle, comments, participants, subtasks, adjustments, bulk reassign.
  44_ChecklistService.js      Checklist_Config/Checklist_Runs + conversión a Task.
  90_Setup.js                bootstrapTestEnvironment(): crea hojas + siembra data de prueba (Fase 2).
  95_SetupTasks.js           Crea/siembra las hojas de Tasks y Checklist (Fase 3).
  98_Api.js                  Única capa que el cliente invoca (wrappers delgados sobre los Services).
  99_WebApp.js               doGet() + include() — entry point del Web App (Fase 4).
html/
  Index.html                 Shell: incluye Styles + los Client_*.
  Styles.html                 CSS (desktop-first).
  Client_Api.html             callServer() — google.script.run en prod, fetch en el dev server.
  Client_State.html           Estado de la app, router por hash, toasts, formatos.
  Client_Views.html           Render de Login/Dashboard/Tasks/Task Detail.
  Client_Modals.html          Modales de acción (Nueva Task, Reasignar, Ajustes, etc.).
  Client_Main.html            Bootstrap de la app (login + primera render).
test/
  loadGas.js                 Carga src/*.js en un vm.Context de Node con los mocks.
  mocks/gasGlobals.js        Mocks de SpreadsheetApp/PropertiesService/Utilities/Session.
  *.test.js                  Tests (node:test): repository, auth, permission, taskLifecycle, checklist.
devserver/
  server.js                  createDevServer({port}) + CLI — backend real detrás de html/ en un navegador.
e2e/
  helpers.js                 launchBrowser() + withDevServer() (backend aislado por spec).
  *.e2e.test.js              Specs de Playwright (node:test): auth, lifecycle, adjustments, auto-refresh.
```

Los archivos de `src/` llevan prefijo numérico porque Apps Script no tiene
módulos: todo vive en un mismo scope global, y el orden de cómo se leen/
concatenan importa (una clase que extiende otra debe cargarse después).
Los tests cargan los archivos en ese mismo orden para probar exactamente lo
que se copiaría al proyecto real.

## Correr los tests localmente

```
cd apps-script
npm test
```

No requiere ningún Sheet real ni credenciales: `test/mocks/gasGlobals.js`
simula `SpreadsheetApp`, `PropertiesService`, `Utilities`, `Session` y
`LockService` en memoria con Node puro (usa `node:crypto` para el hash
SHA-256 y HMAC, sin dependencias externas).

## Correr los specs de Playwright (e2e, navegador real)

```
cd apps-script
npm install       # primera vez, trae `playwright` (Chromium ya viene preinstalado en este entorno)
npm run test:e2e
```

Cada spec levanta su propio dev server aislado (`e2e/helpers.js` →
`createDevServer({ port: 0 })`) con Chromium real, sin depender de un
despliegue a Apps Script. Cubren login (DIRECT/SELECT_PIN/DENIED, PIN
incorrecto), el ciclo de vida de Tasks (crear+asignar+abrir+comentar,
subtareas, participantes, snooze, bulk reassign), el flujo completo de
Adjustment (Agent bloqueado → Supervisor aprueba/rechaza) y el
auto-refresco de Dashboard/Tasks/Task Detail (usando `page.clock` para
adelantar el reloj virtual en vez de esperar 20s reales por test). Ver
`docs/08-fase-4-hardening.md`.

## Probar el frontend en un navegador real (sin Apps Script)

```
cd apps-script
npm run dev
```

Levanta `http://localhost:8080` con el mismo backend que corre bajo test
(mocks incluidos) y sirve `html/Index.html` resolviendo sus `include(...)`
igual que `HtmlService`. `Client_Api.html` detecta que no existe
`google.script.run` y usa `fetch` contra este servidor — el mismo
`Index.html` corre sin cambios cuando se copie a Apps Script real.

Por defecto entra automáticamente como Eduardo (vía DIRECT, sin PIN). Para
probar el selector + PIN (email compartido), abrir
`http://localhost:8080/?email=executiveservices.team%40example.test` y
usar cualquiera de los Login ID de prueba (`m.moreno`, `a.hernandez`,
`a.torres`, `b.castillo`, `c.jimenez`, `d.fuentes`, `e.ramos`) con PIN
`1234`. El estado (Tasks creadas, etc.) vive solo en memoria del proceso —
se reinicia al reiniciar `npm run dev`.

## Instalar en el Sheet personal de prueba

1. En Google Drive (cuenta personal), crear un Google Sheet nuevo y abrir
   **Extensiones → Apps Script**.
2. Copiar el contenido de `appsscript.json` al manifiesto del proyecto
   (`Ver → Mostrar manifiesto de proyecto` si no aparece).
3. Crear un archivo de script por cada archivo de `src/`, respetando el
   nombre (sin la extensión `.js`, Apps Script la agrega sola). Crear un
   archivo **HTML** (no script) por cada archivo de `html/`, también con el
   mismo nombre.
4. En **Configuración del proyecto → Propiedades del script**, agregar
   `SESSION_SECRET` con un valor aleatorio (ej. generado con
   `Utilities.getUuid()` desde el editor). No hace falta `SHEET_ID` si el
   proyecto queda ligado (bound) al Sheet.
5. Ejecutar `bootstrapTestEnvironment` una vez desde el editor (seleccionar
   la función en el desplegable de "Ejecutar" y correrla). Esto crea las
   pestañas de Fase 2 (`Departments`, `Users`, `User_Roles`,
   `Auth_Credentials`) y las de Fase 3 (`Tasks`, `Task_History`,
   `Task_Subtasks`, `Task_Adjustments`, `Task_Participants`,
   `Task_Status_Config`, `Task_Status_Transitions`, `Task_Config`,
   `Checklist_Config`, `Checklist_Runs`), sembrando la data de ejemplo
   documentada en `docs/01-modelo-datos.md` y `docs/06-fase-3-decisiones.md`.
   Si ya la corriste para Fase 2, correrla de nuevo es seguro (idempotente):
   solo agrega lo que falte, sin duplicar nada.
6. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como:
   "Usuario que accede" (`USER_ACCESSING`, ya viene en `appsscript.json`);
   acceso: cualquiera dentro del dominio (o "Cualquier usuario" si se
   prueba desde una cuenta personal fuera de Workspace — ver limitación
   abajo). Abrir la URL que entrega el despliegue.

## Limitación conocida al probar la vía DIRECT (email único)

`Session.getActiveUser().getEmail()` solo devuelve el correo de forma
confiable cuando el Web App se despliega dentro de un dominio Google
Workspace con `executeAs: USER_ACCESSING` (como quedará en producción,
`appsscript.json` ya lo configura así). En una cuenta de Gmail personal
(el entorno de prueba "afuera") puede devolver una cadena vacía por
restricciones de privacidad de Google, incluso con el usuario logueado.

Para probar la vía DIRECT sin depender de eso, se puede invocar
`AuthService.identify(email)` pasando el correo directamente desde el
editor de Apps Script (`Ejecutar` con parámetros, o una función de prueba
temporal), en vez de depender de un Web App desplegado. La vía SELECT_PIN
(selector + PIN) no tiene esta limitación porque no depende de
`Session.getActiveUser()`.

## Qué ya se resolvió con datos reales

- `Task_Permissions` (87 filas, TP001–TP087) y `Task_Assignment_Config` (19
  filas, TA01–TA19) ya están sembradas tal cual las confirmó Eduardo
  (`95_SetupTasks.js`), y `40_TaskPermissionService.js` /
  `47_TaskAssignmentService.js` las leen en vez de derivarlas por lógica.
  Detalle en `docs/06-fase-3-decisiones.md`.
- Los 18 eventos de `Task_History`, corregidos: se agregó `ASSIGNED`, se
  quitó `ADJUSTMENT_CANCELLED` y se renombró `SUBTASK_ADDED` a
  `SUBTASK_CREATED`.
- `Task_Participants['Role in Task']` usa los 4 valores reales
  (`COLLABORATOR`/`SUPPORT`/`REVIEWER`/`OBSERVER`), con `COLLABORATOR` por
  defecto.

## Qué falta

- Delegación de acceso cross-departamento para Manager (sección 5 del
  prompt maestro) — no hay tabla `Delegations` todavía.
- Acciones reales sembradas en `Task_Permissions` que ningún método de
  `TaskService` invoca todavía: `CREATE`, `EDIT`, `ASSIGN`, `VIEW_HISTORY`,
  `VIEW_SUBTASKS` (la creación se sigue gateando solo por `Task_Config`,
  más específico por Task Type). Ver `docs/06-fase-3-decisiones.md`.
- Vista de Checklist en el frontend (el backend de Fase 3 ya existe:
  `api_listChecklist`/`api_recordChecklistRun`/
  `api_convertChecklistRunToTask`) — no estaba en la lista de vistas
  pedida para Fase 4, ver `docs/07-fase-4-decisiones.md`.
- Limitación conocida y aceptada del auto-refresco: un poll puede
  reemplazar un input a medio escribir (buscador, comentario sin enviar)
  si justo en ese momento hay un cambio que refrescar — ver
  `docs/08-fase-4-hardening.md`.
- People — Fase 5.

## Hardening previo a Fase 5

IDs atómicos (`nextSequentialId` vía Script Properties + `LockService`,
ya no cuenta filas), auto-refresco cada 20s en Dashboard/Tasks/Task Detail
(pausado si la pestaña no está visible, con endpoints livianos de
"versión" para no releer todo el detalle sin cambios) y los specs de
Playwright guardados como tests reales (`e2e/`) — todo documentado en
`docs/08-fase-4-hardening.md`.
