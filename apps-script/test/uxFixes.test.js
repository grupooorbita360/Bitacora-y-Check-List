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

// --- Issue 1: "Agregar Participante" pasa de texto libre a un selector de
// nombres (api_listAssignableUsers), enviando el User ID por debajo. ------

test('api_getTaskDetail: incluye assignableUsers del departamento de la Task, sin que el cliente pida un segundo endpoint', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const task = ctx.TaskService.create({ title: 'x', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');

  const detail = ctx.api_getTaskDetail(null, task['Task ID']);

  assert.ok(Array.isArray(detail.assignableUsers));
  // Los 8 usuarios sembrados en DEP001 (90_Setup.js) — mismo resultado que
  // api_listAssignableUsers(token, 'DEP001'), pero sin round-trip aparte.
  assert.equal(detail.assignableUsers.length, ctx.api_listAssignableUsers(null, 'DEP001').length);
  assert.ok(detail.assignableUsers.some((u) => u['User ID'] === 'U004' && u['Nombre Corto']));
});

// --- Issue 2: las tarjetas del Dashboard navegan a Tasks con ese estado (o
// "vencidas") como filtro activo — el filtro tiene que existir en el
// backend para que la navegación produzca la misma lista que contó la
// tarjeta. --------------------------------------------------------------

test('api_listTasks: filters.overdueOnly devuelve solo Tasks vencidas y abiertas, igual que cuenta el Dashboard', () => {
  const ctx = setUp();
  const overdueTask = ctx.TaskService.create(
    { title: 'Vencida', type: 'Operativo', department: 'DEP001', ownerId: 'U004', dueDate: '2020-01-01' },
    'U001'
  );
  ctx.TaskService.transition(overdueTask['Task ID'], 'OPEN', 'U004');
  ctx.TaskService.create({ title: 'Al día', type: 'Operativo', department: 'DEP001', ownerId: 'U004' }, 'U001');

  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const dashboard = ctx.api_getDashboard(null);
  assert.equal(dashboard.myTasks.overdue, 1);

  const overdueOnly = ctx.api_listTasks(null, { overdueOnly: true });
  assert.equal(overdueOnly.length, dashboard.myTasks.overdue);
  assert.equal(overdueOnly[0]['Task ID'], overdueTask['Task ID']);
});

test('api_listTasks: overdueOnly excluye vencidas ya COMPLETED/CANCELLED (mismo criterio que api_getDashboard)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create(
    { title: 'Vencida pero completada', type: 'Operativo', department: 'DEP001', ownerId: 'U004', dueDate: '2020-01-01' },
    'U001'
  );
  ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  ctx.TaskService.transition(task['Task ID'], 'COMPLETE', 'U004', { comment: 'listo' });

  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  assert.equal(ctx.api_listTasks(null, { overdueOnly: true }).length, 0);
});

test('api_listTasks: overdueOnly se combina con status (ej. clic en "Pendientes" no arrastra el filtro de vencidas)', () => {
  const ctx = setUp();
  const overdueTask = ctx.TaskService.create(
    { title: 'Vencida', type: 'Operativo', department: 'DEP001', ownerId: 'U004', dueDate: '2020-01-01' },
    'U001'
  );
  ctx.TaskService.transition(overdueTask['Task ID'], 'OPEN', 'U004');

  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  // Filtro "Pendientes" (status=PENDING) solo: la vencida está IN_PROGRESS, no debe aparecer.
  assert.equal(ctx.api_listTasks(null, { status: 'PENDING' }).length, 0);
  // Filtro "Vencidas" (overdueOnly) solo: sí debe aparecer.
  assert.equal(ctx.api_listTasks(null, { overdueOnly: true }).length, 1);
});

// --- Vista de Checklist: los 3 endpoints de Fase 3 ya existían; se agrega
// cobertura de la capa Api (98_Api.js) que consume la nueva vista, además
// de la ya existente sobre ChecklistService (test/checklist.test.js). ----

test('api_listChecklist: devuelve las actividades activas del departamento para armar la vista', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const items = ctx.api_listChecklist(null, 'DEP001');
  assert.equal(items.length, 3);
  assert.deepEqual(items.map((i) => i.ID), ['CL01', 'CL02', 'CL03']);
});

test('api_recordChecklistRun + api_convertChecklistRunToTask: flujo completo de "problema" a Task de seguimiento', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');

  const runId = ctx.api_recordChecklistRun(null, 'CL02', 'PROBLEMA', '150.00', 'Faltante en caja.');
  assert.ok(runId, 'debe devolver el Run ID para poder ofrecer la conversión a Task en el modal');

  const task = ctx.api_convertChecklistRunToTask(null, runId);
  assert.equal(task['System Origin'], 'CHECKLIST');
  assert.equal(task['Source Record ID'], runId);
  assert.equal(task.Department, 'DEP001');
});

test('api_recordChecklistRun: un resultado OK no requiere Valor ni Comentario', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const runId = ctx.api_recordChecklistRun(null, 'CL01', 'OK', '', '');
  const run = new ctx.ChecklistRunsRepository().findById(runId);
  assert.equal(run.Resultado, 'OK');
});
