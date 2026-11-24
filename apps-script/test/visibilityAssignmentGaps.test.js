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

// U020: Director puro (sin Admin), para probar "Manager o superior" sin
// que el atajo de Admin tape el resultado real — mismo patrón que
// test/visibilityEnforcement.test.js.
function seedDirectorPuro(ctx) {
  new ctx.UsersRepository().create({
    'User ID': 'U020',
    Nombre: 'Directora Pura',
    'Nombre Corto': 'Directora',
    'Login ID': 'd.pura20',
    Email: 'directora.pura20@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U020', Nombre: 'Directora Pura', Rol: 'Director', Activo: true });
  return 'U020';
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
    'Owner ID': 'U001',
    Owner: 'Eduardo Lopez',
    Priority: 'P3',
    'Due Date': '',
    'Review Date': '',
    Status: 'PENDING',
    Visibility: 'OPERATIONAL',
    'Operational Scope': 'DEPARTMENT',
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

// --- _applyReassign (reassign) -----------------------------------------

test('reassign: Agent -> SUPERVISION se rechaza con mensaje claro, aunque el actor tenga permiso de reasignar', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'SUPERVISION' });
  assert.throws(
    () => ctx.TaskService.reassign(taskId, 'U004', 'U001'), // Eduardo (Admin) reasigna a Ana (Agent)
    /El rol de "Ana Torres" no alcanza la Visibility de esta Task \(SUPERVISION\)/
  );
});

test('reassign: Supervisor -> SUPERVISION permitido; Admin -> SUPERVISION permitido', () => {
  const ctx = setUp();
  const taskId1 = makeTask(ctx, { Visibility: 'SUPERVISION' });
  assert.doesNotThrow(() => ctx.TaskService.reassign(taskId1, 'U002', 'U001')); // Marta, Supervisor

  const taskId2 = makeTask(ctx, { Visibility: 'SUPERVISION' });
  assert.doesNotThrow(() => ctx.TaskService.reassign(taskId2, 'U001', 'U001')); // Eduardo, Admin
});

test('reassign: Supervisor -> MANAGEMENT se rechaza; Manager/Director -> MANAGEMENT permitido', () => {
  const ctx = setUp();
  const directorId = seedDirectorPuro(ctx);

  const taskId1 = makeTask(ctx, { Visibility: 'MANAGEMENT' });
  assert.throws(
    () => ctx.TaskService.reassign(taskId1, 'U002', 'U001'), // Marta, Supervisor
    /El rol de "Marta Elvira Moreno" no alcanza la Visibility de esta Task \(MANAGEMENT\)/
  );

  const taskId2 = makeTask(ctx, { Visibility: 'MANAGEMENT' });
  assert.doesNotThrow(() => ctx.TaskService.reassign(taskId2, directorId, 'U001'));
});

test('reassign: RESTRICTED sin cambios — el nuevo Owner puede ser cualquier rol (el acto de reasignar ya lo convierte en Owner)', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'RESTRICTED' });
  assert.doesNotThrow(() => ctx.TaskService.reassign(taskId, 'U004', 'U001')); // Ana, Agent — sin restricción nueva
});

test('reassign: OPERATIONAL sin cambios', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'OPERATIONAL' });
  assert.doesNotThrow(() => ctx.TaskService.reassign(taskId, 'U004', 'U001'));
});

// --- bulkReassign: reporta el rechazo por Task, no aborta el lote -------

test('bulkReassign: una Task SUPERVISION falla por Visibility y se reporta por Task; las demás (OPERATIONAL) sí se reasignan', () => {
  const ctx = setUp();
  const supervisionTaskId = makeTask(ctx, { Visibility: 'SUPERVISION', title: 'De supervisión' });
  const normalTaskId = makeTask(ctx, { Visibility: 'OPERATIONAL', title: 'Normal' });

  const results = ctx.TaskService.bulkReassign([supervisionTaskId, normalTaskId], 'U004', 'U001', '');
  const bySupervision = results.filter((r) => r.taskId === supervisionTaskId)[0];
  const byNormal = results.filter((r) => r.taskId === normalTaskId)[0];

  assert.equal(bySupervision.ok, false);
  assert.match(bySupervision.error, /no alcanza la Visibility/);
  assert.equal(byNormal.ok, true);

  const stillPending = new ctx.TasksRepository().findById(supervisionTaskId);
  assert.equal(stillPending['Owner ID'], 'U001', 'la Task SUPERVISION no debe haber cambiado de Owner');
  const reassigned = new ctx.TasksRepository().findById(normalTaskId);
  assert.equal(reassigned['Owner ID'], 'U004');
});

// --- takeOwnership --------------------------------------------------------

test('takeOwnership: asignar a un Agent como nuevo Owner de una Task SUPERVISION se rechaza', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'SUPERVISION' });
  assert.throws(
    () => ctx.TaskService.takeOwnership(taskId, 'U004', 'U001'),
    /El rol de "Ana Torres" no alcanza la Visibility de esta Task \(SUPERVISION\)/
  );
});

test('takeOwnership: un Supervisor sí puede tomar ownership de una Task SUPERVISION', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'SUPERVISION' });
  assert.doesNotThrow(() => ctx.TaskService.takeOwnership(taskId, 'U002', 'U001'));
});

// --- addParticipant --------------------------------------------------------

test('addParticipant: agregar a un Agent como Participant de una Task MANAGEMENT se rechaza', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT' });
  assert.throws(
    () => ctx.TaskService.addParticipant(taskId, 'U004', 'U001'),
    /No se puede agregar a esta persona como Participant.*no alcanza la Visibility de esta Task \(MANAGEMENT\)/
  );
});

test('addParticipant: un Manager sí puede agregarse (o agregar a otro Manager/Director) como Participant de una Task MANAGEMENT', () => {
  const ctx = setUp();
  const directorId = seedDirectorPuro(ctx);
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT' });
  assert.doesNotThrow(() => ctx.TaskService.addParticipant(taskId, directorId, 'U001'));
});

test('addParticipant: un Admin agregado como Participant siempre alcanza, aun en MANAGEMENT', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT' });
  // Eduardo (U001) tiene rol Admin — se agrega a sí mismo como Participant;
  // quien agrega (actingUserId) también es Eduardo, con permiso de sobra.
  assert.doesNotThrow(() => ctx.TaskService.addParticipant(taskId, 'U001', 'U001', 'OBSERVER'));
});

test('addParticipant: RESTRICTED sin cambios — cualquier rol puede ser agregado como Participant', () => {
  const ctx = setUp();
  const taskId = makeTask(ctx, { Visibility: 'RESTRICTED' });
  assert.doesNotThrow(() => ctx.TaskService.addParticipant(taskId, 'U004', 'U001'));
});

// --- api_listAssignableUsers / eligibleAssignees: el selector no ofrece a quien no alcanza ---

test('api_getTaskDetail: eligibleAssignees excluye a los Agent en una Task SUPERVISION; assignableUsers sigue completo', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const taskId = makeTask(ctx, { Visibility: 'SUPERVISION' });
  const detail = ctx.api_getTaskDetail(null, taskId); // Eduardo, DIRECT

  const eligibleIds = detail.eligibleAssignees.map((u) => u['User ID']);
  assert.equal(eligibleIds.indexOf('U004'), -1, 'Ana (Agent) no debe estar entre los elegibles');
  assert.ok(eligibleIds.indexOf('U002') !== -1, 'Marta (Supervisor) sí debe estar');

  const allIds = detail.assignableUsers.map((u) => u['User ID']);
  assert.ok(allIds.indexOf('U004') !== -1, 'assignableUsers no debe filtrarse — lo usa el display de nombres de participantes ya agregados');
});

test('api_listAssignableUsers: con taskId filtra por Visibility; sin taskId devuelve todo el departamento (Nueva Task / bulk reassign)', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const taskId = makeTask(ctx, { Visibility: 'MANAGEMENT' });

  const filtered = ctx.api_listAssignableUsers(null, 'DEP001', taskId).map((u) => u['User ID']);
  assert.equal(filtered.indexOf('U002'), -1, 'Marta (Supervisor) no alcanza MANAGEMENT');

  const unfiltered = ctx.api_listAssignableUsers(null, 'DEP001').map((u) => u['User ID']);
  assert.ok(unfiltered.indexOf('U002') !== -1, 'sin taskId no debe filtrar');
});
