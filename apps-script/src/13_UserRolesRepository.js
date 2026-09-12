/**
 * User_Roles tiene una fila por (User ID, Rol) — un usuario puede tener
 * varios roles activos a la vez (ej. Manager + Admin). idColumn se pasa
 * solo para reutilizar create/update genéricos; findById no es la forma
 * correcta de consultar esta tabla, usar findByUserId.
 */
var UserRolesRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.USER_ROLES, 'User ID');
  }

  findByUserId(userId) {
    return this.findWhere(function (record) {
      return String(record['User ID']) === String(userId) && record.Activo !== false;
    });
  }
}
