/**
 * Task_Assignment_Config real (19 filas, TA01-TA19) — columnas:
 * ID | Accion_Regla | Rol_Origen | Alcance | Rol_Destino | Mismo_Departamento
 * | Requiere_Aprobacion | Activo
 *
 * Responde una pregunta distinta y complementaria a Task_Permissions:
 * Task_Permissions valida "¿puedo tocar ESTA Task?" (relativo a la Task);
 * esta tabla valida "¿puedo convertir a ESTA PERSONA en el nuevo Owner?"
 * (relativo al usuario destino y su rol/departamento).
 */
var TaskAssignmentConfigRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_ASSIGNMENT_CONFIG, 'ID');
  }

  findRules(actionRule, originRole, destinationRole) {
    return this.findWhere(function (row) {
      return (
        row.Activo !== false &&
        row.Accion_Regla === actionRule &&
        row.Rol_Origen === originRole &&
        row.Rol_Destino === destinationRole
      );
    });
  }
};
