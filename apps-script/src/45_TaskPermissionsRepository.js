/**
 * Task_Permissions real (87 filas, TP001-TP087) — columnas:
 * ID | Departamento | Rol | Accion | Alcance | Activo
 * Todas las filas reales son Departamento=GLOBAL (aplica a cualquier
 * departamento). Ver docs/06-fase-3-decisiones.md.
 */
var TaskPermissionsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_PERMISSIONS, 'ID');
  }

  // Todos los Alcance permitidos para (rol, acción), sin importar departamento
  // (hoy todo es GLOBAL — cuando haya reglas por departamento específico,
  // este método es el único lugar a ajustar para filtrar también por depto).
  findScopesFor(role, action) {
    return this.findWhere(function (row) {
      return row.Activo !== false && row.Rol === role && row.Accion === action;
    }).map(function (row) {
      return row.Alcance;
    });
  }

  // true si la acción está modelada en la tabla real (para cualquier rol) —
  // determina si TaskPermissionService debe usar estas filas o su lógica
  // derivada de respaldo para esa acción.
  actionExists(action) {
    return this.findWhere(function (row) {
      return row.Activo !== false && row.Accion === action;
    }).length > 0;
  }
};
