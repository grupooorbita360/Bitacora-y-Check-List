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

  canAccessDepartment: function (userId, departmentId) {
    if (this.isAdmin(userId)) return true;
    var user = new UsersRepository().findById(userId);
    if (!user) return false;
    return String(user['Department ID']) === String(departmentId);
  }
};
