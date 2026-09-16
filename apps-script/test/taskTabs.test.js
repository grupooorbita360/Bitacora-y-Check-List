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

// Sección 44 del prompt maestro: pestañas de Tasks. Cada filters.tab es una
// capa de filtrado ADICIONAL sobre lo que TaskPermissionService.canView ya
// permite ver — estos tests verifican esa semántica, no el motor de
// permisos en sí (ya cubierto en taskPermissionsReal.test.js).

test('filters.tab MINE: solo Tasks propias, sin las ya cerradas (COMPLETED/CANCELLED)', () => {
  const ctx = setUp();
  const mine = ctx.TaskService.create({ title: 'Mía pendiente', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const mineDone = ctx.TaskService.create({ title: 'Mía completada', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.transition(mineDone['Task ID'], 'OPEN', 'U004');
  ctx.TaskService.transition(mineDone['Task ID'], 'COMPLETE', 'U004', { comment: 'listo' });
  ctx.TaskService.create({ title: 'De Bruno', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U005');

  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234');
  const result = ctx.api_listTasks(anaToken, { tab: 'MINE' });

  assert.deepEqual(result.map((t) => t['Task ID']).sort(), [mine['Task ID']].sort());
});

test('filters.tab TEAM: Tasks visibles que no son Supervisión/Management ni están cerradas — incluye las propias', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const deAna = ctx.TaskService.create({ title: 'De Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
  const deEduardo = ctx.TaskService.create({ title: 'De Eduardo mismo', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');
  const cerrada = ctx.TaskService.create({ title: 'Cerrada', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U001');
  ctx.TaskService.transition(cerrada['Task ID'], 'OPEN', 'U005');
  ctx.TaskService.transition(cerrada['Task ID'], 'CANCEL', 'U001', { comment: 'ya no aplica' });
  const supervision = ctx.TaskService.create(
    { title: 'De Supervisión', type: 'Operativo', department: 'DEP001', ownerId: 'U004', visibility: ctx.Config.TASK_VISIBILITY.SUPERVISION },
    'U001'
  );

  const team = ctx.api_listTasks(null, { tab: 'TEAM' }).map((t) => t['Task ID']);

  assert.ok(team.indexOf(deAna['Task ID']) !== -1, 'debe incluir Tasks de otras personas del departamento');
  assert.ok(team.indexOf(deEduardo['Task ID']) !== -1, 'debe incluir también las propias del usuario (ej. una que convirtió a su propio nombre)');
  assert.equal(team.indexOf(cerrada['Task ID']), -1, 'no debe incluir Tasks ya cerradas (COMPLETED/CANCELLED)');
  assert.equal(team.indexOf(supervision['Task ID']), -1, 'Visibility=SUPERVISION no debe mezclarse en Equipo/Departamento');
});

test('filters.tab WAITING y DONE: cortan por Status sin importar el Owner, dentro del alcance visible', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const waiting = ctx.TaskService.create({ title: 'Esperando', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
  ctx.TaskService.transition(waiting['Task ID'], 'OPEN', 'U004');
  ctx.TaskService.transition(waiting['Task ID'], 'SNOOZE', 'U004', { comment: 'esperando al cliente', reviewDate: '2026-12-01' });
  const done = ctx.TaskService.create({ title: 'Lista', type: 'Operativo', department: 'DEP001', ownerId: 'U005' }, 'U001');
  ctx.TaskService.transition(done['Task ID'], 'OPEN', 'U005');
  ctx.TaskService.transition(done['Task ID'], 'COMPLETE', 'U005', { comment: 'listo' });
  ctx.TaskService.create({ title: 'Pendiente normal', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');

  const waitingList = ctx.api_listTasks(null, { tab: 'WAITING' }).map((t) => t['Task ID']);
  assert.deepEqual(waitingList, [waiting['Task ID']]);

  const doneList = ctx.api_listTasks(null, { tab: 'DONE' }).map((t) => t['Task ID']);
  assert.deepEqual(doneList, [done['Task ID']]);
});

test('filters.tab SUPERVISION/MANAGEMENT: solo Tasks con esa Visibility exacta', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const supervision = ctx.TaskService.create(
    { title: 'Problema de checklist', type: 'Operativo', department: 'DEP001', ownerId: 'U004', visibility: ctx.Config.TASK_VISIBILITY.SUPERVISION },
    'U001'
  );
  const management = ctx.TaskService.create(
    { title: 'Tema de gerencia', type: 'Operativo', department: 'DEP001', ownerId: 'U001', visibility: ctx.Config.TASK_VISIBILITY.MANAGEMENT },
    'U001'
  );
  ctx.TaskService.create({ title: 'Normal', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');

  assert.deepEqual(ctx.api_listTasks(null, { tab: 'SUPERVISION' }).map((t) => t['Task ID']), [supervision['Task ID']]);
  assert.deepEqual(ctx.api_listTasks(null, { tab: 'MANAGEMENT' }).map((t) => t['Task ID']), [management['Task ID']]);
});

test('+Convertir en Task de un Checklist con problema cae en la pestaña Supervisión (Visibility=SUPERVISION por defecto)', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const runId = ctx.api_recordChecklistRun(null, 'CL02', 'PROBLEMA', '150.00', 'Faltante en caja.');
  const task = ctx.api_convertChecklistRunToTask(null, runId);

  assert.equal(task.Visibility, 'SUPERVISION');
  assert.deepEqual(ctx.api_listTasks(null, { tab: 'SUPERVISION' }).map((t) => t['Task ID']), [task['Task ID']]);
  assert.equal(
    ctx.api_listTasks(null, { tab: 'TEAM' }).map((t) => t['Task ID']).indexOf(task['Task ID']),
    -1,
    'no debe verse mezclada en Equipo/Departamento'
  );
});

test('Paridad Dashboard <-> pestaña TEAM: el conteo de la tarjeta coincide exactamente con lo que muestra Tasks al hacer clic', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  ctx.TaskService.create({ title: 'Pendiente de Ana', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');
  ctx.TaskService.create({ title: 'Pendiente de Eduardo', type: 'Operativo', department: 'DEP001', ownerId: 'U001' }, 'U001');
  // Una Task Pendiente con Visibility=SUPERVISION: NO debe contarse en el
  // Dashboard general ni en TEAM (tiene su propia pestaña) — si esto se
  // rompe, el número de la tarjeta "Pendientes" y lo que aparece en Tasks
  // al hacer clic dejan de coincidir.
  ctx.TaskService.create(
    { title: 'Pendiente de Supervisión', type: 'Operativo', department: 'DEP001', ownerId: 'U004', visibility: ctx.Config.TASK_VISIBILITY.SUPERVISION },
    'U001'
  );

  const dashboard = ctx.api_getDashboard(null);
  const teamPending = ctx.api_listTasks(null, { tab: 'TEAM', status: 'PENDING' });

  assert.equal(dashboard.myTasks.pending, 2);
  assert.equal(teamPending.length, dashboard.myTasks.pending);
});
