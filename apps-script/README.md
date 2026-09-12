# Fase 2 — Config / Auth / Users / Departments / Permissions

Código fuente de la capa foundation de la plataforma: Config, capa
Repository/DAO sobre Sheets, Auth de dos vías, Users, Departments y las
primitivas de permisos (RBAC). Ver `docs/00-arquitectura-general.md` y
`docs/01-modelo-datos.md` en la raíz del repo para las decisiones de
arquitectura detrás de este código.

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
  90_Setup.js                bootstrapTestEnvironment(): crea hojas + siembra data de prueba.
test/
  loadGas.js                 Carga src/*.js en un vm.Context de Node con los mocks.
  mocks/gasGlobals.js        Mocks de SpreadsheetApp/PropertiesService/Utilities/Session.
  *.test.js                  Tests (node:test) sobre repository, auth y permission.
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
simula `SpreadsheetApp`, `PropertiesService`, `Utilities` y `Session` en
memoria con Node puro (usa `node:crypto` para el hash SHA-256 y HMAC, sin
dependencias externas).

## Instalar en el Sheet personal de prueba

1. En Google Drive (cuenta personal), crear un Google Sheet nuevo y abrir
   **Extensiones → Apps Script**.
2. Copiar el contenido de `appsscript.json` al manifiesto del proyecto
   (`Ver → Mostrar manifiesto de proyecto` si no aparece).
3. Crear un archivo de script por cada archivo de `src/`, respetando el
   nombre (sin la extensión `.js`, Apps Script la agrega sola).
4. En **Configuración del proyecto → Propiedades del script**, agregar
   `SESSION_SECRET` con un valor aleatorio (ej. generado con
   `Utilities.getUuid()` desde el editor). No hace falta `SHEET_ID` si el
   proyecto queda ligado (bound) al Sheet.
5. Ejecutar `bootstrapTestEnvironment` una vez desde el editor (seleccionar
   la función en el desplegable de "Ejecutar" y correrla). Esto crea las
   pestañas `Departments`, `Users`, `User_Roles`, `Auth_Credentials` y
   siembra la data de ejemplo documentada en
   `docs/01-modelo-datos.md` (Auth → "Datos de prueba inventados").

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

## Qué falta (fuera de alcance de Fase 2)

- Delegación de acceso cross-departamento para Manager (sección 5 del
  prompt maestro) — no hay tabla `Delegations` todavía.
- `Task_Permissions` (reglas TP001–TP087) — se construye en Fase 3 sobre
  las primitivas de `PermissionService`.
- Frontend/HTML Service (Login, Layout) — Fase 4.
