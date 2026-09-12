var UserService = {
  getWithRoles: function (userId) {
    var user = new UsersRepository().findById(userId);
    if (!user) return null;
    var roles = new UserRolesRepository().findByUserId(userId).map(function (r) {
      return r.Rol;
    });
    return Object.assign({}, user, { roles: roles });
  },

  listActiveByDepartment: function (departmentId) {
    return new UsersRepository().findWhere(function (user) {
      return user.Activo !== false && String(user['Department ID']) === String(departmentId);
    });
  }
};
