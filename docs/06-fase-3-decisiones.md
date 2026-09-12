# Fase 3 — decisiones y supuestos a reconciliar

Fase 3 (Tasks + Checklist) se construyó con todo lo que el prompt maestro
especifica de forma completa y verificable (lifecycle, estados,
transiciones, subtasks, adjustments, Checklist_Config/Runs). Hay tres
piezas, sin embargo, cuyo contenido **literal** de `NEW_Bitacora.xlsx` no
estuvo disponible en esta sesión — solo la confirmación de que existen y
coinciden con "v1" en la auditoría de Fase 1. Se documentan aquí en vez de
inventarse en silencio, siguiendo el mismo criterio que Fase 1/2.

## 1. Task_Permissions (TP001–TP087) y Task_Assignment_Config (TA01–TA19)

**No se leyó ni se reconstruyó su contenido fila por fila.** En vez de
fabricar 87+19 reglas plausibles pero potencialmente incorrectas, Fase 3
implementa el control de acceso a Tasks como un motor de código
(`apps-script/src/40_TaskPermissionService.js`) derivado directamente de
reglas que sí están confirmadas y completas en el prompt maestro:

- La jerarquía Director→Manager→Supervisor→Agent + Admin (sección 4).
- El modelo Owner/Visibility/Operational Scope (secciones 9-10).
- El flujo de Task_Adjustments para reasignación con aprobación (sección
  10, "Caso crítico: Task Shared", y sección 24).

Regla implementada en resumen: el Owner y su cadena de Supervisor/Manager
pueden operar el lifecycle de la Task (abrir, completar, snooze, etc.); un
Agent nunca reasigna directo (ni a sí mismo) — debe pedir un ajuste que
apruebe su Supervisor o Manager; Manager+ puede hacer bulk reassign dentro
de su departamento; Admin siempre puede todo.

**Esto no reemplaza Task_Permissions/Task_Assignment_Config** — esas dos
hojas ya existen correctas en el Sheet real (confirmado en la auditoría).
Si al instalar Fase 3 se comparan y hay reglas más finas que esta lógica no
cubre (ej. un permiso puntual distinto por Task Type), el único archivo a
ajustar es `40_TaskPermissionService.js` — no se tocan las demás capas.

## 2. Los 18 tipos de evento de Task_History

El prompt maestro confirma que son exactamente 18, listando el primero
(`CREATED`) y el último (`SUBTASK_COMPLETED`), sin enumerar los 16
restantes literalmente. `Config.HISTORY_EVENTS`
(`apps-script/src/00_Config.js`) los reconstruye a partir de cada acción y
flujo descrito explícitamente en el documento:

```
CREATED, OPENED, OWNERSHIP_TAKEN, COMPLETED, CANCELLED, REOPENED,
SNOOZED, RESUMED, COMMENT_ADDED, REASSIGNED, ADJUSTMENT_REQUESTED,
ADJUSTMENT_APPROVED, ADJUSTMENT_REJECTED, ADJUSTMENT_CANCELLED,
PARTICIPANT_ADDED, PARTICIPANT_REMOVED, SUBTASK_ADDED, SUBTASK_COMPLETED
```

Son exactamente 18, empiezan en `CREATED` y terminan en `SUBTASK_COMPLETED`
como confirma el documento. **Pendiente**: comparar esta lista contra la
pestaña `Task_History` real al instalar Fase 3 — si los nombres literales
difieren (aunque el conteo y el concepto coincidan), ajustar
`Config.HISTORY_EVENTS` y los pocos puntos de `43_TaskService.js` que los
usan.

## 3. Task_Participants — columna "Role in Task"

La auditoría de Fase 1 (Anexo A-B5) menciona "Role in Task" como columna
existente en `Task_Participants`, pero no su lista de valores posibles.
Fase 3 usa un único valor por defecto, `'PARTICIPANT'`, y no distingue
roles dentro del participante. Si el Sheet real usa valores más finos
(ej. `WATCHER`, `COLLABORATOR`), es un cambio menor y aislado en
`TaskService.addParticipant()`.

## Qué SÍ es literal y no necesita reconciliarse

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
