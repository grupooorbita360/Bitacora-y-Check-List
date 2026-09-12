/**
 * bootstrapTestEnvironment — crea las hojas/columnas del modelo de Fase 2
 * si no existen, y siembra data de ejemplo SOLO si las hojas están vacías.
 * Idempotente: correrla de nuevo no duplica nada.
 *
 * Uso: abrir el proyecto de Apps Script ligado al Sheet personal de
 * prueba (docs/04-protocolo-despliegue.md) y ejecutar esta función una vez
 * desde el editor.
 *
 * IMPORTANTE: los nombres, Login ID y el email compartido de abajo son
 * DATA DE PRUEBA INVENTADA (ver docs/01-modelo-datos.md → Auth → "Datos de
 * prueba inventados"). Nunca deben copiarse al Sheet de la empresa —ahí se
 * carga a mano la data real de Executive Services.
 */
function bootstrapTestEnvironment() {
  var ss = Config.getSpreadsheet();

  var departmentsSheet = _ensureSheet(ss, Config.SHEET_TABS.DEPARTMENTS, [
    'Department ID', 'Nombre', 'Nombre Corto', 'Activo', 'Orden'
  ]);
  var usersSheet = _ensureSheet(ss, Config.SHEET_TABS.USERS, [
    'User ID', 'Nombre', 'Nombre Corto', 'Login ID', 'Email', 'Department ID',
    'Manager', 'Supervisor', 'Activo', 'Fecha Alta', 'Último Acceso'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.USER_ROLES, ['User ID', 'Nombre', 'Rol', 'Activo']);
  _ensureSheet(ss, Config.SHEET_TABS.AUTH_CREDENTIALS, ['User ID', 'PIN Hash', 'Salt', 'Updated At']);
  _ensureTaskAndChecklistTables(ss);

  if (departmentsSheet.getLastRow() < 2) {
    new DepartmentsRepository().create({
      'Department ID': 'DEP001',
      Nombre: 'Executive Services',
      'Nombre Corto': 'ExecServ',
      Activo: true,
      Orden: 1
    });
  }

  if (usersSheet.getLastRow() < 2) {
    _seedExampleUsers();
  }
}

function _ensureSheet(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

// DATA DE PRUEBA — invéntada para poder construir y probar el flujo de
// Auth de dos vías; reemplazar antes de copiar a producción.
var TEST_SHARED_EMAIL = 'executiveservices.team@example.test';

function _seedExampleUsers() {
  var users = new UsersRepository();
  var roles = new UserRolesRepository();

  users.create({
    'User ID': 'U001',
    Nombre: 'Eduardo Lopez',
    'Nombre Corto': 'Eduardo',
    'Login ID': 'e.lopez',
    Email: 'eduardo.lopez@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  roles.create({ 'User ID': 'U001', Nombre: 'Eduardo Lopez', Rol: Config.ROLES.MANAGER, Activo: true });
  roles.create({ 'User ID': 'U001', Nombre: 'Eduardo Lopez', Rol: Config.ROLES.ADMIN, Activo: true });

  var sharedUsers = [
    { id: 'U002', nombre: 'Marta Elvira Moreno', corto: 'Marta', login: 'm.moreno', rol: Config.ROLES.SUPERVISOR, supervisor: '' },
    { id: 'U003', nombre: 'Alessi Hernandez', corto: 'Alessi', login: 'a.hernandez', rol: Config.ROLES.SUPERVISOR, supervisor: '' },
    { id: 'U004', nombre: 'Ana Torres', corto: 'Ana', login: 'a.torres', rol: Config.ROLES.AGENT, supervisor: 'U002' },
    { id: 'U005', nombre: 'Bruno Castillo', corto: 'Bruno', login: 'b.castillo', rol: Config.ROLES.AGENT, supervisor: 'U002' },
    { id: 'U006', nombre: 'Carla Jimenez', corto: 'Carla', login: 'c.jimenez', rol: Config.ROLES.AGENT, supervisor: 'U003' },
    { id: 'U007', nombre: 'Diego Fuentes', corto: 'Diego', login: 'd.fuentes', rol: Config.ROLES.AGENT, supervisor: 'U003' },
    { id: 'U008', nombre: 'Elena Ramos', corto: 'Elena', login: 'e.ramos', rol: Config.ROLES.AGENT, supervisor: 'U002' }
  ];

  sharedUsers.forEach(function (u) {
    users.create({
      'User ID': u.id,
      Nombre: u.nombre,
      'Nombre Corto': u.corto,
      'Login ID': u.login,
      Email: TEST_SHARED_EMAIL,
      'Department ID': 'DEP001',
      Manager: 'U001',
      Supervisor: u.supervisor,
      Activo: true,
      'Fecha Alta': new Date(),
      'Último Acceso': ''
    });
    roles.create({ 'User ID': u.id, Nombre: u.nombre, Rol: u.rol, Activo: true });
    AuthService.seedPinForTesting(u.id, '1234');
  });
}
