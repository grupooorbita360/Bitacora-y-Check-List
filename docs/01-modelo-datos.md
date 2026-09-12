# Modelo de datos definitivo

Estado post-auditoría (Anexo A, v3): incluye las correcciones ya decididas.
Este documento es la referencia para Fase 2 en adelante — no se agregan
tablas/columnas fuera de esta lista sin pasar antes por la Regla de Oro
(`00-arquitectura-general.md`).

## Departments (nueva, formal — decisión cerrada)

```
Department ID | Nombre | Nombre Corto | Activo | Orden
```

Referenciada por `Users.Department ID`, `Task_Config.Departamento`,
`Task_Permissions.Departamento`, `Checklist_Config.Departamento`, etc. Hoy
solo tiene sembrado **Executive Services**; el resto de departamentos
mencionados en el prompt (Sales, Reservations, Member Services...) se
agregan cuando existan reales. `GLOBAL` NO es una fila de esta tabla — es un
valor reservado del motor de permisos (ver `00-arquitectura-general.md`).

## Users

```
User ID | Nombre | Nombre Corto | Login ID | Email | Department ID |
Manager | Supervisor | Activo | Fecha Alta | Último Acceso
```

Cambios respecto al Sheet original:
- La columna se llama `Department ID` (no "Rol Principal") y apunta a
  `Departments`.
- El rol ya no vive aquí: vive exclusivamente en `User_Roles`.
- `GLOBAL` nunca se guarda como `Department ID` de un usuario. Un usuario
  con alcance amplio tipo Manager (ej. Eduardo) se modela dejando
  `Department ID` vacío o asignándole su departamento operativo real — a
  definir con data real cuando exista; no bloquea la construcción.
- Limpieza pendiente antes de migrar: eliminar la hoja `Login ID` vacía y la
  fila huérfana "Carlos Riviera" sin `User ID`.
- Toda la data de usuarios actual (Eduardo, Carlos Riviera, etc.) es data de
  prueba/inventada mientras se arma el sistema, no la nómina real.

## Auth — autenticación de dos vías (decisión Fase 2)

`Login ID` y `Email` son conceptos distintos (sección Users): un correo
puede ser compartido por varios agentes. La autenticación se resuelve según
cuántos `Users` activos comparten ese `Email`:

- **Email único** → entra directo. El backend toma
  `Session.getActiveUser().getEmail()` (identidad de Google ya autenticada
  por el Web App) y busca el único `User` activo con ese `Email`. No se pide
  PIN.
- **Email compartido** (2+ `Users` activos con el mismo `Email`) → el
  frontend muestra un selector por `Login ID`/`Nombre Corto` y pide un PIN
  de 4 dígitos para confirmar cuál de esos usuarios está entrando.

**"Requiere PIN" no se guarda como campo.** Se deriva en el momento
contando cuántos `Users` activos tienen ese `Email` (`> 1` → requiere PIN).
Guardarlo aparte duplicaría información que ya vive en `Users.Email`
(Regla de Oro, `00-arquitectura-general.md`).

### Auth_Credentials (nueva)

```
User ID | PIN Hash | Salt | Updated At
```

Una fila solo para los usuarios que necesitan PIN (email compartido). Nunca
se guarda el PIN en texto plano: `PIN Hash = SHA-256(PIN + Salt)` vía
`Utilities.computeDigest`, `Salt` aleatorio por usuario. El PIN es de 4
dígitos (limitación conocida y aceptada: un PIN de 4 dígitos es
intrínsecamente de espacio pequeño incluso con salt — aceptable para este
alcance porque el reset es exclusivo de Admin y no hay superficie de
API pública de fuerza bruta más allá del propio Web App). El reset de PIN,
por ahora, solo lo puede hacer un usuario con rol `Admin` — no hay
autoservicio de "olvidé mi PIN" en esta fase.

### Datos de prueba inventados (a reemplazar antes de producción)

En el Sheet real, los 7 usuarios de correo compartido de Executive Services
(Marta, Alessi y los agentes asignados a ambas) no tienen `Login ID`
cargado. Para poder construir y probar el flujo de selector+PIN, el
`bootstrapTestEnvironment()` de Fase 2 (`apps-script/src/90_Setup.js`)
**inventa** `Login ID`, nombres de agentes y un `Email` compartido de
prueba (`executiveservices.team@example.test`) — todo placeholder, igual
que el resto de la data de usuarios de Fase 1. **Antes de copiar el código
al proyecto de Apps Script de la empresa** (`04-protocolo-despliegue.md`),
estos placeholders deben reemplazarse por los `Login ID` y `Email` reales
de cada agente — nunca deben llegar al Sheet de producción.

### Alcance no cubierto en Fase 2

Delegación de acceso cross-departamento para Manager (sección 5) no se
construye todavía — no existe tabla `Delegations` ni mecanismo equivalente.
`PermissionService.canAccessDepartment` en esta fase solo resuelve
Admin-global y mismo-departamento; delegación queda señalada, no inventada.

## User_Roles

```
User ID | Nombre | Rol | Activo
```

Roles (valores internos en inglés, UI puede traducir): `Director`,
`Manager`, `Supervisor`, `Agent`, `Admin`.

Limpieza pendiente: eliminar las columnas H/I sueltas ("Gerente",
"Supervisor") presentes en la hoja real — son residuo de otra vista, sin
relación con esta estructura.

## Tasks (27 columnas — confirmado exacto contra datos reales)

```
Task ID | Task Title | Description | Type | Department | Created By ID |
Created By | Owner ID | Owner | Priority | Due Date | Review Date | Status |
Visibility | Operational Scope | Reference Type | Reference ID |
Origin Department | System Origin | Source Record ID | Created At |
Updated At | Completed At | Cancelled At | Cancelled By ID |
Cancellation Reason | Active
```

No agregar: `Parent Task ID`, `Has Subtasks`, `Subtask Progress`,
`Observations`, `Origin User ID`, `Origin User`.

Limpieza pendiente: eliminar (o mover a una tabla de configuración propia)
las filas sin `Task ID` que solo documentan combinaciones válidas de
Visibility/Operational Scope — no son Tasks reales. Mismo tratamiento para
filas equivalentes en `Task_Participants`, `Task_Subtasks` y
`Task_Adjustments`.

### System Origin (enum)

`BITACORA | PEOPLE | MANUAL | CHECKLIST`

(`CHECKLIST` es nuevo, agregado por la formalización del módulo Checklist —
ver más abajo.)

## Task_History

18 tipos de evento (confirmado exacto contra datos reales): `CREATED`,
`OPENED`, ... `SUBTASK_COMPLETED`. Inmutable — solo inserts.

## Task_Subtasks

Estructura simple: `PENDING` / `COMPLETED` / `CANCELLED`. Completar
subtareas **no** completa la Task principal automáticamente.

## Task_Adjustments

```
Types: REASSIGN | CHANGE_DEPARTMENT | REASSIGN_AND_CHANGE_DEPARTMENT | OTHER
Status: PENDING | APPROVED | REJECTED | CANCELLED
```

## Task_Status_Config (TS01–TS05 — confirmado exacto)

Estados únicos de Task: `PENDING`, `IN_PROGRESS`, `WAITING`, `COMPLETED`,
`CANCELLED`. No existen `OPENED`/`REOPENED`/`STARTED` como estados —
`OPENED` es evento, `REOPEN` es acción.

## Task_Status_Transitions (ST01–ST10 — confirmado exacto)

Transiciones válidas: PENDING→IN_PROGRESS, IN_PROGRESS→COMPLETED,
IN_PROGRESS→WAITING, WAITING→IN_PROGRESS, WAITING→COMPLETED,
PENDING→CANCELLED, IN_PROGRESS→CANCELLED, WAITING→CANCELLED,
COMPLETED→PENDING, CANCELLED→PENDING.

Acciones: `OPEN`, `COMPLETE`, `SNOOZE`, `RESUME`, `CANCEL`, `REOPEN`.
`COMPLETE`/`SNOOZE`/`CANCEL`/`REOPEN` requieren comentario; `SNOOZE` además
requiere fecha de revisión.

## Task_Permissions (TP001–TP087 — confirmado exacto)

Reglas de permisos por rol (Director/Manager/Supervisor/Agent), incluyendo
`BULK_REASSIGN` como acción (no como Task Type). Es la tabla mejor alineada
del sistema — usarla como referencia de calidad para las demás.

## Task_Assignment_Config (TA01–TA19 — confirmado exacto)

## Task_Config (corregido — decisión cerrada)

```
ID | Departamento | Rol | Task Type | Activo | Orden
```

**"Reasignación" eliminado del catálogo** (estaba en TC11-Supervisor y
TC15-Agent, violando la propia regla de que Reasignación es una acción
[`REASSIGN`], nunca un Task Type). El resto de los Task Types por rol es
data de ejemplo, ajustable libremente durante la construcción — no bloquea
Fase 2.

No se crea una `Task_Creation_Config` adicional. Las reglas de creación se
derivan de: User role, Task permissions, Task config, Assignment config,
Status config.

## Checklist_Config (formalizada — decisión cerrada)

```
ID | Departamento | Actividad | Tipo | Ayuda | Prioridad | Frecuencia |
SUPs requeridos | Activo | Orden
```

- `Departamento` → referencia a `Departments`, no texto libre.
- `Tipo`: `CHECK` (marcar hecho/no hecho) | `DATA` (capturar un dato/cifra).
  A confirmar si hace falta un tercer tipo antes de construir el UI.
- `Prioridad`: mismos valores que Task Priority (P1/P2/P3).
- `Frecuencia`: hoy texto libre ("Diario", "Martes"...); se recomienda
  normalizar a un catálogo `Frecuencia` (`DIARIA` / `SEMANAL_LUN...` /
  `MENSUAL`) para que el motor de recurrencias la genere automáticamente.
- `SUPs requeridos`: cantidad de Supervisores que deben validar la
  actividad (doble validación heredada de la Bitácora original).
- `Ayuda`: instrucciones para quien ejecuta, mostradas como
  tooltip/expandible (progressive disclosure, igual que Task Detail).

## Checklist_Runs (nueva — a construir en Fase 3)

No existe aún en el Sheet. Registra cada ejecución real de una actividad de
`Checklist_Config` (plantilla): fecha, quién la marcó, resultado. Es lo que
alimenta `Source Record ID` cuando una Task se crea con
`System Origin = CHECKLIST` (el `Source Record ID` es el ID de la
*ejecución*, no el `ID` de la plantilla en `Checklist_Config`).

## Fuera de alcance

`Leads` (CRM externo tipo Lead/Contract/Vendor/Hotel/REP/ESA/STATUS) — no se
migra, no se replica, no aparece en el repo. Ver `03-anexo-a-auditoria.md`.
