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

// Sección 36 del prompt maestro: convertir un Checklist con problema en
// Task de seguimiento es acción de Supervisor, no de Agent — el Agent solo
// reporta. Ver docs/14-checklist-convert-role.md.

test('recordRun sigue abierto a cualquier rol — el Agent reporta sin restricción', () => {
  const ctx = setUp();
  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234'); // Ana, Agent
  assert.doesNotThrow(() => ctx.api_recordChecklistRun(anaToken, 'CL01', 'OK', '', ''));
  assert.doesNotThrow(() => ctx.api_recordChecklistRun(anaToken, 'CL02', 'PROBLEMA', '150.00', 'Faltante en caja.'));
});

test('PermissionService.isSupervisorOrAbove: Agent no califica; Supervisor/Manager/Director/Admin sí', () => {
  const ctx = setUp();
  new ctx.UsersRepository().create({
    'User ID': 'U012',
    Nombre: 'Directora Pura',
    'Nombre Corto': 'Directora',
    'Login ID': 'd.pura2',
    Email: 'directora.pura2@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U012', Nombre: 'Directora Pura', Rol: 'Director', Activo: true });

  assert.equal(ctx.PermissionService.isSupervisorOrAbove('U004'), false, 'Ana (Agent)');
  assert.equal(ctx.PermissionService.isSupervisorOrAbove('U002'), true, 'Marta (Supervisor)');
  assert.equal(ctx.PermissionService.isSupervisorOrAbove('U001'), true, 'Eduardo (Manager+Admin)');
  assert.equal(ctx.PermissionService.isSupervisorOrAbove('U012'), true, 'Directora pura');
});

test('convertRunToTask: un Agent NO puede convertir, ni el suyo propio ni el de otro', () => {
  const ctx = setUp();
  const runId = ctx.ChecklistService.recordRun('CL02', 'U004', 'PROBLEMA', '150.00', 'Faltante en caja.');

  assert.throws(
    () => ctx.ChecklistService.convertRunToTask(runId, 'U004', {}),
    /Solo un Supervisor o superior puede convertir/,
    'Ana no puede convertir su propio reporte'
  );
  assert.throws(
    () => ctx.ChecklistService.convertRunToTask(runId, 'U005', {}),
    /Solo un Supervisor o superior puede convertir/,
    'ni otro Agent, aunque no sea el autor del reporte'
  );
});

test('convertRunToTask: Supervisor/Manager/Director/Admin sí pueden convertir', () => {
  const ctx = setUp();
  new ctx.UsersRepository().create({
    'User ID': 'U013',
    Nombre: 'Directora Pura',
    'Nombre Corto': 'Directora',
    'Login ID': 'd.pura3',
    Email: 'directora.pura3@example.test',
    'Department ID': 'DEP001',
    Manager: '',
    Supervisor: '',
    Activo: true,
    'Fecha Alta': new Date(),
    'Último Acceso': ''
  });
  new ctx.UserRolesRepository().create({ 'User ID': 'U013', Nombre: 'Directora Pura', Rol: 'Director', Activo: true });

  ['U002' /* Supervisor */, 'U001' /* Manager+Admin */, 'U013' /* Director */].forEach((converterId) => {
    const runId = ctx.ChecklistService.recordRun('CL02', 'U004', 'PROBLEMA', '150.00', 'Faltante en caja.');
    assert.doesNotThrow(() => ctx.ChecklistService.convertRunToTask(runId, converterId, {}));
  });
});

test('api_convertChecklistRunToTask: el rechazo también se enforca en la capa Api (no solo en ChecklistService directo)', () => {
  const ctx = setUp();
  const anaToken = ctx.AuthService.loginWithPin('a.torres', '1234');
  const runId = ctx.api_recordChecklistRun(anaToken, 'CL02', 'PROBLEMA', '150.00', 'Faltante en caja.');

  assert.throws(() => ctx.api_convertChecklistRunToTask(anaToken, runId), /Solo un Supervisor o superior puede convertir/);

  const martaToken = ctx.AuthService.loginWithPin('m.moreno', '1234');
  assert.doesNotThrow(() => ctx.api_convertChecklistRunToTask(martaToken, runId));
});
