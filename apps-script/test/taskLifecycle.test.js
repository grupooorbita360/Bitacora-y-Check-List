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

// U004 Ana Torres (Agent, supervisada por U002 Marta). U002 Marta es Supervisor.
// U001 Eduardo es Manager+Admin de DEP001.

test('TaskService.create: respeta Task_Config (tipo permitido para el rol)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create(
    { title: 'Revisar caso', type: 'Caso', department: 'DEP001', ownerId: 'U004' },
    'U004'
  );
  assert.equal(task.Status, 'PENDING');
  assert.equal(task.Active, true);
  assert.equal(task['Task ID'], 'T00001');
});

test('TaskService.create: rechaza un Task Type no permitido para el rol', () => {
  const ctx = setUp();
  assert.throws(
    () => ctx.TaskService.create({ title: 'x', type: 'Desarrollo', department: 'DEP001', ownerId: 'U004' }, 'U004'),
    /no permitido/
  );
});

test('Task_Config nunca incluye "Reasignación" como Task Type (decisión Fase 1)', () => {
  const ctx = setUp();
  const allTypes = new ctx.TaskConfigRepository().findAll().map((r) => r['Task Type']);
  assert.ok(!allTypes.includes('Reasignación') && !allTypes.includes('Reasignacion'));
});

test('lifecycle: no existe un estado START; CREATED empieza en PENDING', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.equal(task.Status, 'PENDING');
  const statuses = new ctx.TaskStatusConfigRepository().findAll().map((s) => s.Status);
  assert.deepEqual(statuses.sort(), ['CANCELLED', 'COMPLETED', 'IN_PROGRESS', 'PENDING', 'WAITING']);
});

test('lifecycle: OPEN registra evento OPENED y mueve PENDING -> IN_PROGRESS', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const updated = ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  assert.equal(updated.Status, 'IN_PROGRESS');
  const history = ctx.TaskService.getHistory(task['Task ID']).map((h) => h['Event Type']);
  assert.deepEqual(history, ['CREATED', 'OPENED']);
});

test('lifecycle: COMPLETE/SNOOZE/CANCEL/REOPEN exigen comentario', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  assert.throws(() => ctx.TaskService.transition(task['Task ID'], 'COMPLETE', 'U004'), /requiere un comentario/);
  const completed = ctx.TaskService.transition(task['Task ID'], 'COMPLETE', 'U004', { comment: 'Resuelto.' });
  assert.equal(completed.Status, 'COMPLETED');
  assert.ok(completed['Completed At']);
});

test('lifecycle: SNOOZE exige comentario Y fecha de revisión', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  assert.throws(
    () => ctx.TaskService.transition(task['Task ID'], 'SNOOZE', 'U004', { comment: 'Esperando info.' }),
    /fecha de revisión/
  );
  const snoozed = ctx.TaskService.transition(task['Task ID'], 'SNOOZE', 'U004', {
    comment: 'Esperando info.',
    reviewDate: '2026-10-01'
  });
  assert.equal(snoozed.Status, 'WAITING');
  assert.equal(snoozed['Review Date'], '2026-10-01');
});

test('lifecycle: transición inválida (ej. COMPLETE directo desde PENDING) se rechaza', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.throws(
    () => ctx.TaskService.transition(task['Task ID'], 'COMPLETE', 'U004', { comment: 'x' }),
    /Transición inválida/
  );
});

test('lifecycle: ciclo completo WAITING -> RESUME -> COMPLETE, y REOPEN vuelve a PENDING', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U004');
  ctx.TaskService.transition(task['Task ID'], 'SNOOZE', 'U004', { comment: 'x', reviewDate: '2026-10-01' });
  const resumed = ctx.TaskService.transition(task['Task ID'], 'RESUME', 'U004');
  assert.equal(resumed.Status, 'IN_PROGRESS');
  const completed = ctx.TaskService.transition(task['Task ID'], 'COMPLETE', 'U004', { comment: 'listo' });
  assert.equal(completed.Status, 'COMPLETED');
  const reopened = ctx.TaskService.transition(task['Task ID'], 'REOPEN', 'U004', { comment: 'faltó algo' });
  assert.equal(reopened.Status, 'PENDING');
});

test('permisos: un Agent no puede actuar sobre la Task de otro Agent sin relación', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  // U006 Carla es Agent de otro supervisor (U003), sin relación con la Task de Ana (U004).
  assert.throws(() => ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U006'), /permiso/);
});

test('permisos: el Supervisor de un Agent sí puede actuar sobre su Task', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const updated = ctx.TaskService.transition(task['Task ID'], 'OPEN', 'U002'); // Marta supervisa a Ana
  assert.equal(updated.Status, 'IN_PROGRESS');
});

test('takeOwnership: no crea Participant y deja registro en History', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.takeOwnership(task['Task ID'], 'U005', 'U002');
  const updatedTask = new ctx.TasksRepository().findById(task['Task ID']);
  assert.equal(updatedTask['Owner ID'], 'U005');

  const participants = new ctx.TaskParticipantsRepository().findByTask(task['Task ID']);
  assert.equal(participants.length, 0);

  const history = ctx.TaskService.getHistory(task['Task ID']).map((h) => h['Event Type']);
  assert.ok(history.includes('OWNERSHIP_TAKEN'));
});

test('reassign: un Agent no puede reasignar directo, debe pedir un ajuste', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.throws(() => ctx.TaskService.reassign(task['Task ID'], 'U005', 'U004'), /requestAdjustment/);

  const adjustmentId = ctx.TaskService.requestAdjustment(task['Task ID'], 'REASSIGN', 'U004', { newOwnerId: 'U005', reason: 'me voy de vacaciones' });
  const resolved = ctx.TaskService.resolveAdjustment(adjustmentId, 'APPROVED', 'U002', 'aprobado');
  assert.equal(resolved.Status, 'APPROVED');

  const updatedTask = new ctx.TasksRepository().findById(task['Task ID']);
  assert.equal(updatedTask['Owner ID'], 'U005');
});

test('adjustments: rechazar un ajuste no cambia el Owner', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const adjustmentId = ctx.TaskService.requestAdjustment(task['Task ID'], 'REASSIGN', 'U004', { newOwnerId: 'U005' });
  ctx.TaskService.resolveAdjustment(adjustmentId, 'REJECTED', 'U002', 'no procede');
  const updatedTask = new ctx.TasksRepository().findById(task['Task ID']);
  assert.equal(updatedTask['Owner ID'], 'U004');
});

test('adjustments: quien lo solicitó puede cancelarlo mientras esté PENDING', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const adjustmentId = ctx.TaskService.requestAdjustment(task['Task ID'], 'REASSIGN', 'U004', { newOwnerId: 'U005' });
  ctx.TaskService.cancelAdjustment(adjustmentId, 'U004', 'ya no hace falta');
  const adjustment = new ctx.TaskAdjustmentsRepository().findById(adjustmentId);
  assert.equal(adjustment.Status, 'CANCELLED');
});

test('bulkReassign: acción de Manager, no un Task Type; reasigna varias Tasks', () => {
  const ctx = setUp();
  const t1 = ctx.TaskService.create({ title: 'a', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const t2 = ctx.TaskService.create({ title: 'b', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const results = ctx.TaskService.bulkReassign([t1['Task ID'], t2['Task ID']], 'U006', 'U001', 'redistribución');
  assert.ok(results.every((r) => r.ok));
  assert.equal(new ctx.TasksRepository().findById(t1['Task ID'])['Owner ID'], 'U006');
  assert.equal(new ctx.TasksRepository().findById(t2['Task ID'])['Owner ID'], 'U006');
});

test('bulkReassign: un Agent no tiene permiso de reasignar en bloque', () => {
  const ctx = setUp();
  const t1 = ctx.TaskService.create({ title: 'a', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  assert.throws(() => ctx.TaskService.bulkReassign([t1['Task ID']], 'U006', 'U004', 'x'), /permiso/);
});

test('subtasks: completar una subtarea NO completa la Task principal', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  const subtaskId = ctx.TaskService.addSubtask(task['Task ID'], 'Llamar al cliente', 'U004');
  ctx.TaskService.completeSubtask(subtaskId, 'U004');

  const subtask = new ctx.TaskSubtasksRepository().findById(subtaskId);
  assert.equal(subtask.Status, 'COMPLETED');

  const parentTask = new ctx.TasksRepository().findById(task['Task ID']);
  assert.equal(parentTask.Status, 'PENDING');
});

test('comments: se registran en Task_History como COMMENT_ADDED', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.addComment(task['Task ID'], 'U004', 'Hablé con el cliente.');
  const history = ctx.TaskService.getHistory(task['Task ID']);
  const commentEvent = history.find((h) => h['Event Type'] === 'COMMENT_ADDED');
  assert.equal(commentEvent.Comment, 'Hablé con el cliente.');
});

test('participants: agregar y quitar no duplica filas (Participant ID compuesto)', () => {
  const ctx = setUp();
  const task = ctx.TaskService.create({ title: 'x', type: 'Caso', department: 'DEP001', ownerId: 'U004' }, 'U004');
  ctx.TaskService.addParticipant(task['Task ID'], 'U006', 'U004');
  ctx.TaskService.addParticipant(task['Task ID'], 'U006', 'U004'); // idempotente
  assert.equal(new ctx.TaskParticipantsRepository().findAll().length, 1);

  ctx.TaskService.removeParticipant(task['Task ID'], 'U006', 'U004');
  assert.equal(new ctx.TaskParticipantsRepository().findByTask(task['Task ID']).length, 0);
});
