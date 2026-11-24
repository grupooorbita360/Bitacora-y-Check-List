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

test('ChecklistService.listActive devuelve las actividades del departamento ordenadas', () => {
  const ctx = setUp();
  const activities = ctx.ChecklistService.listActive('DEP001');
  assert.equal(activities.length, 3);
  assert.deepEqual(activities.map((a) => a.ID), ['CL01', 'CL02', 'CL03']);
});

test('recordRun registra una ejecución real distinta de la plantilla', () => {
  const ctx = setUp();
  const runId = ctx.ChecklistService.recordRun('CL01', 'U004', 'OK', '', '');
  const run = new ctx.ChecklistRunsRepository().findById(runId);
  assert.equal(run['Checklist Config ID'], 'CL01');
  assert.notEqual(runId, 'CL01');
});

test('convertRunToTask: crea una Task con System Origin=CHECKLIST y Source Record ID = Run ID (no el ID de la plantilla)', () => {
  const ctx = setUp();
  const runId = ctx.ChecklistService.recordRun('CL02', 'U004', 'PROBLEMA', '150.00', 'Faltante en caja.');
  const task = ctx.ChecklistService.convertRunToTask(runId, 'U002', { ownerId: 'U004' });

  assert.equal(task['System Origin'], 'CHECKLIST');
  assert.equal(task['Source Record ID'], runId);
  assert.notEqual(task['Source Record ID'], 'CL02');
  assert.equal(task.Department, 'DEP001');
  assert.equal(task.Status, 'PENDING');
});

test('Checklist_Config: Tipo solo admite CHECK o DATA en la data de ejemplo', () => {
  const ctx = setUp();
  const tipos = new ctx.ChecklistConfigRepository().findAll().map((c) => c.Tipo);
  tipos.forEach((t) => assert.ok(t === 'CHECK' || t === 'DATA'));
});

// Mismo conjunto que ofrece el <select> de Client_Modals.html — formalizado
// en Config.CHECKLIST_RESULT y validado acá (docs/15-visibility-assignment-gaps.md).
test('recordRun: Resultado debe ser OK o PROBLEMA, el mismo conjunto que usa el frontend', () => {
  const ctx = setUp();
  assert.doesNotThrow(() => ctx.ChecklistService.recordRun('CL01', 'U004', 'OK', '', ''));
  assert.doesNotThrow(() => ctx.ChecklistService.recordRun('CL01', 'U004', 'PROBLEMA', '', 'algo salió mal'));
  assert.throws(
    () => ctx.ChecklistService.recordRun('CL01', 'U004', 'ok', '', ''),
    /Resultado inválido/,
    'no debe aceptar variaciones de mayúsculas/minúsculas'
  );
  assert.throws(() => ctx.ChecklistService.recordRun('CL01', 'U004', 'MAL', '', ''), /Resultado inválido/);
  assert.throws(() => ctx.ChecklistService.recordRun('CL01', 'U004', '', '', ''), /Resultado inválido/);
  assert.throws(() => ctx.ChecklistService.recordRun('CL01', 'U004', undefined, '', ''), /Resultado inválido/);
});
