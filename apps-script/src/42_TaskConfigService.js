var TaskConfigService = {
  // Task Types permitidos para un usuario+departamento, según su(s) rol(es)
  // activos. "Reasignación" nunca aparece aquí porque no se sembró como
  // Task Type (decisión cerrada Fase 1, sección 35) — es la acción REASSIGN.
  getAllowedTypes: function (userId, departmentId) {
    var roles = PermissionService.getRoles(userId);
    var rows = new TaskConfigRepository().findWhere(function (row) {
      return row.Activo !== false;
    });
    var allowed = [];
    rows.forEach(function (row) {
      var deptMatches = row.Departamento === Config.RESERVED_SCOPE_GLOBAL || String(row.Departamento) === String(departmentId);
      if (deptMatches && roles.indexOf(row.Rol) !== -1 && allowed.indexOf(row['Task Type']) === -1) {
        allowed.push(row['Task Type']);
      }
    });
    return allowed;
  }
};
