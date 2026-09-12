# Reglas de negocio

## Task vs. Bitácora vs. Checklist

- **Bitácora**: controla/registra el control operativo del día.
- **Task**: trabajo que debe ejecutarse y/o recibir seguimiento. No es una
  nota, observación histórica, indicador, conversación, objetivo, ni
  actividad recurrente de checklist.
- **Checklist**: control recurrente (diario/semanal/preventivo/crítico).
  Checklist controla, Task ejecuta y da seguimiento.

Si una actividad de checklist detecta un problema: la ejecución del
checklist queda `COMPLETED` y se crea una Task de seguimiento con
`System Origin = CHECKLIST` (botón `+ Convertir en Task`, ver
`01-modelo-datos.md` → Checklist_Runs).

## Owner, Visibility, Operational Scope

- **Owner**: responsable principal de la Task.
- **Visibility**: `OPERATIONAL | SUPERVISION | MANAGEMENT | RESTRICTED` —
  determina quién puede ver la Task.
- **Operational Scope**: `OWN | SHARED | DEPARTMENT | CROSS_DEPARTMENT | ALL`
  — determina el alcance.
- **Participants**: involucrados que no son Owner.
- **Take Ownership**: convierte a alguien en Owner sin crear un Participant.

### Caso Task Shared (ejemplo de referencia)

Ejemplo Juan/No Show: `TAKE_OWNERSHIP` registra el evento
`OWNERSHIP_TAKEN` en `Task_History` sin crear un Participant; el Owner
original queda registrado en el History.

## Ciclo de vida de la Task

No existe un estado `START`. Flujo:

```
CREATED → PENDING → (Owner abre) → IN_PROGRESS → COMPLETED
```

Al abrir se registra el evento `OPENED` y el estado cambia
`PENDING → IN_PROGRESS`. Si alguien distinto del Owner abre la Task, puede
verla si tiene permiso, pero eso **no implica** que el Owner la haya
reconocido.

Detalle completo de estados/transiciones/permisos en `01-modelo-datos.md`
(`Task_Status_Config`, `Task_Status_Transitions`, `Task_Permissions`).

## Bulk Reassignment vs. Take Ownership vs. Reassign

- `REASSIGN` y `BULK_REASSIGN` son **acciones**, nunca Task Types.
- `Take Ownership` no reasigna: transfiere ownership sin crear Participant
  y sin pasar por el flujo de aprobación de `Task_Adjustments`.
- `Reassign` (individual) puede requerir aprobación según
  `Task_Adjustments` (`Type = REASSIGN`, `Status = PENDING → APPROVED/
  REJECTED/CANCELLED`), según el rol de quien la solicita
  (`Task_Permissions`).

## Reglas transversales de UI

Desktop-first, progressive disclosure (ayuda/detalle expandible, no todo
visible de una vez), validación siempre en backend (nunca confiar solo en
el frontend), performance optimizada para Sheets como backend inicial
(evitar lecturas/escrituras innecesarias de rango completo).
