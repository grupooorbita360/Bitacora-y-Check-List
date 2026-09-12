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

test('Task_Permissions siembra las 87 filas reales; Task_Assignment_Config las 19', () => {
  const ctx = setUp();
  assert.equal(new ctx.TaskPermissionsRepository().findAll().length, 87);
  assert.equal(new ctx.TaskAssignmentConfigRepository().findAll().length, 19);
});

test('TaskPermissionService usa la tabla real para acciones modeladas (Agent sin fila = deny, no fallback)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  // REASSIGN está modelado (Director/Manager/Supervisor tienen filas); Agent
  // no tiene ninguna -> debe negarse aunque sea su propia Task, sin caer al
  // fallback derivado (que antes lo hubiera permitido por ser el Owner).
  assert.equal(ctx.TaskPermissionService.can('U004', 'REASSIGN', task), false);
});

test('TaskPermissionService usa el fallback derivado para acciones sin fila en la tabla (OPEN/RESUME)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.equal(new ctx.TaskPermissionsRepository().actionExists('OPEN'), false);
  // Fallback: el Owner puede OPEN aunque OPEN no tenga fila en Task_Permissions.
  assert.equal(ctx.TaskPermissionService.can('U004', 'OPEN', task), true);
});

test('REASSIGN individual permite cross-department a un Supervisor (TP049); BULK_REASSIGN no, por Task (TP087=solo DEPARTMENT)', () => {
  const ctx = setUp();
  new ctx.DepartmentsRepository().create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });

  const tasks = new ctx.TasksRepository();
  const taskId = tasks.nextSequentialId('T', 5);
  const now = new Date();
  tasks.create({
    'Task ID': taskId,
    'Task Title': 'cross dept',
    Description: '',
    Type: 'Operativo',
    Department: 'DEP002',
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
    'Origin Department': 'DEP002',
    'System Origin': 'MANUAL',
    'Source Record ID': '',
    'Created At': now,
    'Updated At': now,
    'Completed At': '',
    'Cancelled At': '',
    'Cancelled By ID': '',
    'Cancellation Reason': '',
    Active: true
  });

  // U002 (Marta, Supervisor de DEP001) reasigna individual una Task de DEP002: permitido (TP049 CROSS_DEPARTMENT).
  const reassigned = ctx.TaskService.reassign(taskId, 'U006', 'U002', 'cambio de dueño');
  assert.equal(reassigned['Owner ID'], 'U006');

  // La misma Marta, vía bulk reassign sobre esa Task de otro departamento: negado (TP087 Supervisor BULK_REASSIGN solo DEPARTMENT).
  const results = ctx.TaskService.bulkReassign([taskId], 'U004', 'U002', 'bulk cross dept');
  assert.equal(results[0].ok, false);
});

test('Task_Assignment_Config: Manager (sin Admin) no puede reasignar a otro Manager (sin fila que lo permita)', () => {
  const ctx = setUp();
  // Un Manager "puro" sin Admin, para no disparar el bypass de isAdmin()
  // (Eduardo/U001 es Manager+Admin y siempre pasaría este chequeo).
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

  new ctx.UsersRepository().create({
    'User ID': 'U010',
    Nombre: 'Otro Manager',
    'Nombre Corto': 'Otro',
    'Login ID': 'o.manager',
    Email: 'otro.manager@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U010', Nombre: 'Otro Manager', Rol: 'Manager', Activo: true });

  // Task_Assignment_Config no tiene ninguna fila con Rol_Origen=Manager -> Rol_Destino=Manager.
  assert.equal(
    ctx.TaskAssignmentService.canAssignTo('U009', 'U010', ctx.TaskAssignmentService.ACTION_RULES.ASSIGN_REASSIGN),
    false
  );
});

test('takeOwnership: Agent puede tomar ownership de una Task SHARED (TP084), no de una OWN de otro Agent', () => {
  const ctx = setUp();
  const sharedTask = ctx.TaskService.create(
    { title: 'compartida', type: 'Caso', department: 'DEP001', ownerId: 'U004', operationalScope: 'SHARED' },
    'U004'
  );
  // U006 (Carla, Agent) toma ownership de la Task compartida de Ana -> permitido.
  ctx.TaskService.takeOwnership(sharedTask['Task ID'], 'U006', 'U006');
  assert.equal(new ctx.TasksRepository().findById(sharedTask['Task ID'])['Owner ID'], 'U006');

  const ownTask = ctx.TaskService.create({ title: 'propia', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.throws(() => ctx.TaskService.takeOwnership(ownTask['Task ID'], 'U006', 'U006'), /permiso/);
});

test('create(): ASSIGNED se registra cuando el creador asigna a otra persona, no cuando se autoasigna', () => {
  const ctx = setUp();
  const selfAssigned = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001' }, 'U004');
  const selfHistory = ctx.TaskService.getHistory(selfAssigned['Task ID']).map((h) => h['Event Type']);
  assert.deepEqual(selfHistory, ['CREATED']);

  const assignedByOther = ctx.TaskService.create(
    { title: 'y', type: 'Operativo', department: 'DEP001', ownerId: 'U004' },
    'U002'
  );
  const otherHistory = ctx.TaskService.getHistory(assignedByOther['Task ID']).map((h) => h['Event Type']);
  assert.deepEqual(otherHistory, ['CREATED', 'ASSIGNED']);
});
