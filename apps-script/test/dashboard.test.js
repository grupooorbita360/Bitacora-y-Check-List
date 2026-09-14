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

test('api_getDashboard: Agent ve scope OWN — solo cuenta sus propias Tasks', () => {
  const ctx = setUp();
  // Eduardo (Manager+Admin) crea una Task para Ana y otra para sí mismo.
  ctx.TaskService.create({ title: 'Para Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
  ctx.TaskService.create({ title: 'Para Eduardo', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');

  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234');
  const dashboard = ctx.api_getDashboard(anaToken);

  assert.equal(dashboard.scope, 'OWN');
  assert.equal(dashboard.visibleTotal, 1, 'Ana (Agent) solo debe contar la Task de la que es Owner');
  assert.equal(dashboard.myTasks.pending, 1);
});

test('api_getDashboard: Manager/Admin ve scope DEPARTMENT — cuenta todo lo visible, no solo lo propio', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  // Dos Tasks de otras personas del departamento, ninguna de Eduardo.
  ctx.TaskService.create({ title: 'Para Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U002');
  ctx.TaskService.create({ title: 'Para Bruno', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U002');

  const dashboard = ctx.api_getDashboard(null); // Eduardo, vía DIRECT

  assert.equal(dashboard.scope, 'DEPARTMENT');
  assert.equal(dashboard.visibleTotal, 2, 'Eduardo (Manager+Admin) debe ver el panorama del departamento, no solo lo suyo (0 Tasks propias)');
  assert.equal(dashboard.myTasks.pending, 2);
});

test('api_getDashboard: Supervisor también ve scope DEPARTMENT (mismo criterio que la lista de Tasks)', () => {
  const ctx = setUp();
  ctx.TaskService.create({ title: 'Para Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
  ctx.TaskService.create({ title: 'Para Carla', type: 'Operativo', department: 'DEP001', ownerId: 'U006' }, 'U001');

  const martaToken = ctx.AuthService.loginWithPin('m.moreno', '1234'); // Supervisor de Ana, no de Carla
  const dashboard = ctx.api_getDashboard(martaToken);

  assert.equal(dashboard.scope, 'DEPARTMENT');
  // TaskPermissionService.canView para Supervisor incluye DEPARTMENT/CROSS_DEPARTMENT
  // (TP041/042) — Marta ve ambas Tasks del departamento aunque Carla no sea su supervisada directa.
  assert.equal(dashboard.visibleTotal, 2);
});

test('api_getDashboard: "Vencidas" también respeta el scope (department para Manager, own para Agent)', () => {
  const ctx = setUp();
  const overdueTask = ctx.TaskService.create(
    { title: 'Vencida de Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004', dueDate: '2020-01-01' },
    'U001'
  );
  ctx.TaskService.transition(overdueTask['Task ID'], 'OPEN', 'U004');

  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234');
  const anaDashboard = ctx.api_getDashboard(anaToken);
  assert.equal(anaDashboard.myTasks.overdue, 1, 'Ana es Owner de la Task vencida, debe contarla');

  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const eduardoDashboard = ctx.api_getDashboard(null);
  assert.equal(eduardoDashboard.myTasks.overdue, 1, 'Eduardo (scope DEPARTMENT) también debe verla, aunque no sea el Owner');
});
