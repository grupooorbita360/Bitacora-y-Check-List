'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./loadGas');

function setUp() {
  const ctx = createContext();
  ctx.PropertiesService.getScriptProperties().setProperty('SESSION_SECRET', 'test-secret');
  ctx.bootstrapTestEnvironment();
  // api_* resuelve el usuario actuante vía Session.getActiveUser() cuando
  // token es null (vía DIRECT) — Eduardo tiene email único, ve todo (Admin).
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  return ctx;
}

test('api_getTasksVersion: cambia cuando se crea una Task visible con los mismos filtros', () => {
  const ctx = setUp();
  const v1 = ctx.api_getTasksVersion(null, {});
  assert.equal(v1.count, 0);

  ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const v2 = ctx.api_getTasksVersion(null, {});
  assert.equal(v2.count, 1);
  assert.notDeepEqual(v2, v1);
});

test('api_getTasksVersion: no cambia si la Task nueva no coincide con el filtro (status)', () => {
  const ctx = setUp();
  ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const v1 = ctx.api_getTasksVersion(null, { status: 'COMPLETED' });
  assert.equal(v1.count, 0, 'la Task recién creada está PENDING, no debe contar para el filtro COMPLETED');
});

test('api_getTasksVersion: cambia el latestUpdatedAt cuando se actualiza una Task existente (sin cambiar el count)', async () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const v1 = ctx.api_getTasksVersion(null, {});

  // Un pequeño delay real: 'Updated At' es new Date() con resolución de
  // milisegundo — sin esto, create()+transition() en el mismo tick
  // síncrono podrían caer en el mismo milisegundo y dar el mismo valor
  // (no sería un fallo del endpoint, solo una coincidencia del test).
  await new Promise((resolve) => setTimeout(resolve, 5));
  ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  const v2 = ctx.api_getTasksVersion(null, {});

  assert.equal(v2.count, v1.count);
  assert.ok(v2.latestUpdatedAt > v1.latestUpdatedAt);
  assert.notDeepEqual(v2, v1);
});

test('api_getTaskVersion: cambia con un comentario nuevo (historyCount) sin tocar Updated At', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const v1 = ctx.api_getTaskVersion(null, task['Task ID']);

  ctx.TaskService.addComment(task['Task ID'], 'U004', 'un comentario');
  const v2 = ctx.api_getTaskVersion(null, task['Task ID']);

  assert.equal(v2.historyCount, v1.historyCount + 1);
  assert.notDeepEqual(v2, v1);
});

test('api_getTaskVersion: cambia con una subtarea nueva (subtasksCount) y al completarla', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const v1 = ctx.api_getTaskVersion(null, task['Task ID']);

  const subtaskId = ctx.TaskService.addSubtask(task['Task ID'], 'llamar', 'U004');
  const v2 = ctx.api_getTaskVersion(null, task['Task ID']);
  assert.equal(v2.subtasksCount, v1.subtasksCount + 1);

  ctx.TaskService.completeSubtask(subtaskId, 'U004');
  const v3 = ctx.api_getTaskVersion(null, task['Task ID']);
  assert.notDeepEqual(v3, v2, 'completar la subtarea también debe cambiar la versión (historyCount sube)');
});

test('api_getTaskVersion: cambia al aprobar un ajuste (pendingAdjustmentsCount vuelve a 0 + Updated At)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const adjustmentId = ctx.TaskService.requestAdjustment(task['Task ID'], 'REASSIGN', 'U004', { newOwnerId: 'U005' });
  const v1 = ctx.api_getTaskVersion(null, task['Task ID']);
  assert.equal(v1.pendingAdjustmentsCount, 1);

  ctx.TaskService.resolveAdjustment(adjustmentId, 'APPROVED', 'U002', 'ok');
  const v2 = ctx.api_getTaskVersion(null, task['Task ID']);
  assert.equal(v2.pendingAdjustmentsCount, 0);
  assert.notDeepEqual(v2, v1);
});

test('api_getTaskVersion: devuelve null si la Task no existe o el usuario no puede verla', () => {
  const ctx = setUp();
  assert.equal(ctx.api_getTaskVersion(null, 'T99999'), null);
});
