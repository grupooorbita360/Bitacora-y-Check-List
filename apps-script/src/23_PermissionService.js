/**
 * PermissionService — primitivas de RBAC reutilizables. Task_Permissions
 * (Fase 3) se construye ENCIMA de estas primitivas, no las duplica.
 *
 * Delegación cross-departamento (sección 5 del prompt maestro) queda fuera
 * de esta fase: no existe tabla de delegaciones todavía, ver
 * docs/01-modelo-datos.md → Auth → "Alcance no cubierto en Fase 2".
 */
var PermissionService = {
  getRoles: function (userId) {
    return new UserRolesRepository().findByUserId(userId).map(function (r) {
      return r.Rol;
    });
  },

  hasRole: function (userId, role) {
    return this.getRoles(userId).indexOf(role) !== -1;
  },

  isAdmin: function (userId) {
    return this.hasRole(userId, Config.ROLES.ADMIN);
  },

  // Primitivas de jerarquía de rol reutilizadas fuera del motor de Tasks
  // (ej. ChecklistService.convertRunToTask, sección 36 del prompt maestro:
  // convertir un Checklist con problema en Task de seguimiento es acción
  // de Supervisor, no de Agent) — ver docs/14-checklist-convert-role.md.
  isManagerOrAbove: function (userId) {
    if (this.isAdmin(userId)) return true;
    var roles = this.getRoles(userId);
    return roles.indexOf(Config.ROLES.MANAGER) !== -1 || roles.indexOf(Config.ROLES.DIRECTOR) !== -1;
  },

  isSupervisorOrAbove: function (userId) {
    if (this.isManagerOrAbove(userId)) return true;
    return this.hasRole(userId, Config.ROLES.SUPERVISOR);
  },

  canAccessDepartment: function (userId, departmentId) {
    if (this.isAdmin(userId)) return true;
    var user = new UsersRepository().findById(userId);
    if (!user) return false;
    return String(user['Department ID']) === String(departmentId);
  }
};
