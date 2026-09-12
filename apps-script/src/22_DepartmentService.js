var DepartmentService = {
  listActive: function () {
    return new DepartmentsRepository()
      .findWhere(function (dept) {
        return dept.Activo !== false;
      })
      .sort(function (a, b) {
        return (a.Orden || 0) - (b.Orden || 0);
      });
  },

  getById: function (departmentId) {
    return new DepartmentsRepository().findById(departmentId);
  }
};
