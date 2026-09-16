'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./loadGas');

function setUp() {
  const ctx = createContext();
  ctx.PropertiesService.getScriptProperties().setProperty('SESSION_SECRET', 'test-secret');
  ctx.bootstrapTestEnvironment();
  return ctx;
}

// U011: Director puro (sin Admin) — no existe ninguno en la data sembrada
// por defecto (90_Setup.js), y hace falta para probar el nivel "Manager o
// superior" sin que el atajo de Admin (PermissionService.isAdmin) tape el
// resultado real de _visibilityAllows.
function seedDirectorPuro(ctx) {
  new ctx.UsersRepository().create({
    'User ID': 'U011',
    Nombre: 'Directora Pura',
    'Nombre Corto': 'Directora',
    'Login ID': 'd.pura',
    Email: 'directora.pura@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U011', Nombre: 'Directora Pura', Rol: 'Director', Activo: true });
  return 'U011';
}

function makeTask(ctx, overrides) {
  const tasks = new ctx.TasksRepository();
  const taskId = tasks.nextSequentialId('T', 5);
  const base = {
    'Task ID': taskId,
    'Task Title': overrides.title || 'Task de prueba',
    Description: '',
    Type: 'Operativo',
    Department: 'DEP001',
    'Created By ID': 'U001',
    'Created By': 'Eduardo Lopez',
    'Owner ID': 'U004',
    Owner: 'Ana Torres',
    Priority: 'P3',
    'Due Date': '',
    'Review Date': '',
    Status: 'PENDING',
    Visibility: 'OPERATIONAL',
    'Operational Scope': 'OWN',
    'Reference Type': '',
    'Reference ID': '',
    'Origin Department': 'DEP001',
    'System Origin': 'MANUAL',
    'Source Record ID': '',
    'Created At': new Date(),
    'Updated At': new Date(),
    'Completed At': '',
    'Cancelled At': '',
    'Cancelled By ID': '',
    'Cancellation Reason': '',
    Active: true
  };
  tasks.create(Object.assign(base, overrides));
  return taskId;
}

// --- OPERATIONAL: sin cambios de comportamiento -----------------------

test('Visibility OPERATIONAL: el Alcance de siempre sigue mandando, sin restricción adicional', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'OPERATIONAL' });
  const task = new ctx.TasksRepository().findById(taskId);
  // Marta (Supervisor) tiene VIEW/DEPARTMENT (TP041) sobre DEP001 — con
  // OPERATIONAL, ese Alcance sigue siendo suficiente, tal como antes de
  // este enforcement.
  assert.equal(ctx.TaskPermissionService.canView('U002', task), true);
});

// --- RESTRICTED: solo Owner/Participant/Admin --------------------------

test('Visibility RESTRICTED: Owner y Participant pueden ver; nadie más, aunque tenga Alcance DEPARTMENT/ALL', () => {
  const ctx = setUp();
  const directorId = seedDirectorPuro(ctx);
  const taskId = makeTask(ctx, { Visibility: 'RESTRICTED', 'Owner ID': 'U004', Owner: 'Ana Torres' });
  const task = new ctx.TasksRepository().findById(taskId);

  assert.equal(ctx.TaskPermissionService.canView('U004', task), true, 'el Owner siempre puede ver su propia Task, sin importar Visibility');

  new ctx.TaskParticipantsRepository().create({
    'Participant ID': 'PART_TEST_1',
    'Task ID': taskId,
    'User ID': 'U006',
    'Role in Task': 'COLLABORATOR',
    'Added By ID': 'U001',
    'Added At': new Date(),
    Activo: true
  });
  assert.equal(ctx.TaskPermissionService.canView('U006', task), true, 'un Participant también puede ver una Task RESTRICTED');

  // Marta (Supervisor, TP041 VIEW/DEPARTMENT) normalmente vería cualquier
  // Task de DEP001 — RESTRICTED se lo niega igual, porque no es Owner ni Participant.
  assert.equal(ctx.TaskPermissionService.canView('U002', task), false, 'Supervisor con Alcance DEPARTMENT no debe ver una RESTRICTED ajena');
  // Directora (TP001 VIEW/ALL) tampoco: RESTRICTED no hace excepción por Alcance=ALL.
  assert.equal(ctx.TaskPermissionService.canView(directorId, task), false, 'ALL tampoco es excepción para RESTRICTED');
  // Admin sí, siempre (ver PermissionService.isAdmin, resuelto antes de evaluar Visibility).
  assert.equal(ctx.TaskPermissionService.canView('U001', task), true, 'Admin (Eduardo) siempre puede ver, RESTRICTED incluida');
});

// --- SUPERVISION: rol Supervisor o superior, sin excepción para Owner --

test('Visibility SUPERVISION: requiere rol Supervisor o superior — el propio Owner Agent NO tiene excepción', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, {
    Visibility: 'SUPERVISION',
    'Owner ID': 'U004',
    Owner: 'Ana Torres',
    'System Origin': 'CHECKLIST'
  });
  const task = new ctx.TasksRepository().findById(taskId);

  // Caso de uso real (Fase 5: Warnings/coaching) — el Owner de una Task de
  // seguimiento con problema puede ser justo la persona reportada; que sea
  // Owner no debe darle acceso a una Task marcada como asunto de Supervisión.
  assert.equal(ctx.TaskPermissionService.canView('U004', task), false, 'Ana (Agent) es Owner pero no debe poder ver su propia Task de Supervisión');

  new ctx.TaskParticipantsRepository().create({
    'Participant ID': 'PART_TEST_2',
    'Task ID': taskId,
    'User ID': 'U005',
    'Role in Task': 'OBSERVER',
    'Added By ID': 'U001',
    'Added At': new Date(),
    Activo: true
  });
  assert.equal(ctx.TaskPermissionService.canView('U005', task), false, 'ser Participant tampoco exime a un Agent del requisito de rol');

  assert.equal(ctx.TaskPermissionService.canView('U002', task), true, 'Marta (Supervisor) sí debe poder verla');
  assert.equal(ctx.TaskPermissionService.canView('U001', task), true, 'Eduardo (Manager+Admin) sí debe poder verla');
});

// --- MANAGEMENT: rol Manager o superior — el caso explícito del pedido -

test('Visibility MANAGEMENT: un Supervisor NO puede verla aunque tenga Alcance DEPARTMENT; Manager/Director sí', () => {
  const ctx = setUp();
  const directorId = seedDirectorPuro(ctx);
  new ctx.UsersRepository().create({
    'User ID': 'U009',
    Nombre: 'Manager Puro',
    'Nombre Corto': 'Puro',
    'Login ID': 'm.puro',
    Email: 'manager.puro@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U009', Nombre: 'Manager Puro', Rol: 'Manager', Activo: true });

  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT', 'Owner ID': 'U001', Owner: 'Eduardo Lopez' });
  const task = new ctx.TasksRepository().findById(taskId);

  // Este es el caso puntual del pedido: Marta tiene VIEW/DEPARTMENT real
  // (TP041) sobre DEP001 — sin el enforcement de Visibility, vería esta
  // Task igual. Con el enforcement, debe quedar bloqueada.
  assert.equal(ctx.TaskPermissionService.canView('U002', task), false, 'Supervisor con Alcance DEPARTMENT no debe ver una Task MANAGEMENT');
  assert.equal(ctx.TaskPermissionService.can('U002', 'ADD_COMMENT', task), false, 'tampoco ninguna otra acción sobre esa Task — no solo VIEW');

  assert.equal(ctx.TaskPermissionService.canView('U009', task), true, 'Manager puro sí debe poder verla');
  assert.equal(ctx.TaskPermissionService.canView(directorId, task), true, 'Director puro también');
  assert.equal(ctx.TaskPermissionService.canView('U001', task), true, 'Admin siempre');
});

// --- Enforcement real de extremo a extremo, no solo en TaskPermissionService ---

test('api_getTaskDetail: un Supervisor no puede leer el detalle de una Task MANAGEMENT llamando la API directo', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT', 'Owner ID': 'U001', Owner: 'Eduardo Lopez' });
  const martaToken = ctx.AuthService.loginWithPin('m.moreno', '1234');

  assert.throws(() => ctx.api_getTaskDetail(martaToken, taskId), /No tienes permiso para ver esta Task/);
});

test('api_listTasks: una Task MANAGEMENT no aparece en la lista de un Supervisor bajo ningún filtro', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT', 'Owner ID': 'U001', Owner: 'Eduardo Lopez' });
  const martaToken = ctx.AuthService.loginWithPin('m.moreno', '1234');

  const allVisible = ctx.api_listTasks(martaToken, {}).map((t) => t['Task ID']);
  assert.equal(allVisible.indexOf(taskId), -1);
  // Ni siquiera pidiendo el tab MANAGEMENT explícito — canView es la
  // primera barrera, antes de que el filtro de tab se aplique.
  const managementTab = ctx.api_listTasks(martaToken, { tab: 'MANAGEMENT' }).map((t) => t['Task ID']);
  assert.equal(managementTab.indexOf(taskId), -1);
});

// --- El flujo de Checklist -> Supervisión sigue funcionando para quien SÍ tiene rol ---

test('Checklist con problema -> Task de Supervisión: Marta (Supervisor) sí puede verla y actuar; Ana (Agent, Owner) no', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const runId = ctx.api_recordChecklistRun(null, 'CL02', 'PROBLEMA', '150.00', 'Faltante en caja.');
  // Ana (Agent) convierte su propio reporte a Task — ownerId por defecto es
  // quien convierte, exactamente el caso de uso que motivó el enforcement.
  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234');
  const task = ctx.api_convertChecklistRunToTask(anaToken, runId);
  assert.equal(task.Visibility, 'SUPERVISION');

  // Ana ya no puede ver su propia Task de seguimiento.
  assert.throws(() => ctx.api_getTaskDetail(anaToken, task['Task ID']), /No tienes permiso para ver esta Task/);

  // Marta (su Supervisor) sí puede verla y comentar.
  const martaToken = ctx.AuthService.loginWithPin('m.moreno', '1234');
  const detail = ctx.api_getTaskDetail(martaToken, task['Task ID']);
  assert.equal(detail.task['Task ID'], task['Task ID']);
  assert.doesNotThrow(() => ctx.api_addComment(martaToken, task['Task ID'], 'Reviso este caso.'));

  // Y aparece en su pestaña Supervisión.
  const supervisionTab = ctx.api_listTasks(martaToken, { tab: 'SUPERVISION' }).map((t) => t['Task ID']);
  assert.ok(supervisionTab.indexOf(task['Task ID']) !== -1);
});

// --- Fail-closed ante un valor de Visibility desconocido/corrupto ------

test('Visibility desconocida (dato corrupto en el Sheet): se niega por defecto, no se asume OPERATIONAL', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'ALGO_QUE_NO_EXISTE' });
  const task = new ctx.TasksRepository().findById(taskId);

  assert.equal(ctx.TaskPermissionService.canView('U002', task), false, 'un valor de Visibility desconocido no debe interpretarse como acceso libre');
  assert.equal(ctx.TaskPermissionService.canView('U001', task), true, 'Admin sigue viendo todo, incluso con datos corruptos');
});
