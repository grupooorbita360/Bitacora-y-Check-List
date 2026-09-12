var UsersRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.USERS, 'User ID');
  }

  findByEmail(email) {
    var target = String(email).toLowerCase();
    return this.findWhere(function (user) {
      return user.Activo !== false && String(user.Email).toLowerCase() === target;
    });
  }

  findByLoginId(loginId) {
    var match = this.findWhere(function (user) {
      return String(user['Login ID']) === String(loginId);
    });
    return match.length ? match[0] : null;
  }
}
