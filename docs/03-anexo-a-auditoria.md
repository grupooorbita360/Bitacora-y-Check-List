# Anexo A — Auditoría de consistencia: prompt vs. datos reales

Registro histórico de la auditoría hecha contra `NEW_Bitacora.xlsx` (16
hojas) y de las decisiones que la cerraron. Las tablas de `01-modelo-datos.md`
ya reflejan el resultado final — este documento es la traza de *por qué*.

## A) Lo que estaba correcto

- `Task_Status_Config` (TS01–TS05), `Task_Status_Transitions` (ST01–ST10),
  el catálogo de 18 eventos de `Task_History`, `Task_Assignment_Config`
  (TA01–TA19) y las 87 reglas de `Task_Permissions` (TP001–TP087) coinciden
  exactamente con el documento original.
- `Tasks` tiene las 27 columnas exactas.
- La jerarquía de roles (Director/Manager/Supervisor/Agent + Admin como rol
  técnico separado) está bien reflejada en `User_Roles`.

## B) Inconsistencias detectadas y C) por qué importaban

1. **Rol real de Eduardo Lopez**: registrado como Manager+Admin en los
   datos, no como Director+Admin (como decía el documento original).
   Contradicción directa documento vs. datos/realidad operativa.
2. **Campo "Departamento" en Users**: implementado como "Rol Principal" con
   valores de departamento mezclados con "GLOBAL" (que no es un
   departamento). Ambigüedad de nombre y semántica.
3. **"Reasignación" como Task Type**: presente en `Task_Config` real
   (TC11-Supervisor, TC15-Agent) pese a que la regla del propio documento
   lo prohíbe explícitamente. La inconsistencia más grave: contradecía una
   regla ya aprobada por escrito.
4. **Columnas huérfanas en `User_Roles`**: H/I ("Gerente"/"Supervisor") con
   datos sueltos sin relación con la estructura de la tabla.
5. **Filas de referencia dentro de tablas operativas**: `Tasks`,
   `Task_Participants`, `Task_Subtasks`, `Task_Adjustments` tenían filas sin
   ID real que solo documentaban valores válidos (Visibility/Scope, Status,
   Role in Task, Adjustment Type) — deberían vivir en configuración, no en
   datos reales.
6. **`Checklist_Config` sin especificación formal**: existía como tabla
   real y funcional, pero el documento original solo la trataba
   conceptualmente, sin sección estructural propia (a diferencia de Tasks).
7. **Hoja `Leads`** (CRM de leads Fly & Buy: Lead/Contract/Vendor/Hotel/REP/
   ESA/STATUS): dominio completo no contemplado en el prompt original.
8. **Datos sueltos a limpiar**: hoja `Login ID` vacía; fila huérfana
   "Carlos Riviera" sin `User ID` en `Users`.
9. **Sin catálogo `Departments`**: el departamento era texto libre en varias
   tablas pese a que el diseño es explícitamente multi-departamento.

## D) Decisiones — todas cerradas (v3)

1. ✅ Eduardo Lopez = Manager + Admin (no Director). Jerarquía con nivel
   Director vacante por ahora. Toda la data de usuarios actual (Eduardo,
   Carlos, etc.) es de ejemplo/inventable, no bloqueante.
2. ✅ "Reasignación" se elimina del catálogo `Task_Config` — queda solo
   como acción (`REASSIGN`), nunca como Task Type.
3. ✅ Se crea catálogo `Departments` formal desde Fase 1, aunque hoy solo
   tenga Executive Services sembrado.
4. ✅ `Leads` queda fuera de alcance — no se migra ni se replica (ver
   `01-modelo-datos.md` → Fuera de alcance).
5. ✅ `Checklist_Config` se formaliza como módulo completo, a construir en
   Fase 3 junto con Tasks (incluye la nueva tabla `Checklist_Runs`).

## E) Consecuencia para el arranque

Con las 5 decisiones cerradas, no queda ningún bloqueante de arquitectura
para iniciar Fase 2. Orden sugerido (ver `05-roadmap.md`):

1. Fase 2 — Config/Auth/Users/Departments/Permissions sobre el Sheet
   personal de prueba (repo externo), con capa Repository/DAO separada de
   `SpreadsheetApp` desde el día uno.
2. Fase 3 — Tasks + Checklist juntos (CRUD, permisos, lifecycle, history, y
   el módulo `Checklist_Config`/`Checklist_Runs`).
3. Fase 4 — Frontend (Apps Script Web App con HTML Service, desktop-first,
   progressive disclosure).
4. Validar cada fase en el entorno externo antes de copiar manualmente al
   proyecto de Apps Script de la empresa (`04-protocolo-despliegue.md`).

Las decisiones ya definidas son baseline de arquitectura y no cambian solo
porque exista otra alternativa. Cualquier inconsistencia nueva que aparezca
más adelante se trata igual que este Anexo: se señala, se propone una
opción, y se espera aprobación explícita antes de tocar código.
