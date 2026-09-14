'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./loadGas');

test('SheetRepository: create/findAll/findById/update/softDelete sobre Departments', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  const all = repo.findAll();
  assert.equal(all.length, 1);
  assert.equal(all[0]['Department ID'], 'DEP001');

  repo.create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });
  assert.equal(repo.findAll().length, 2);

  const found = repo.findById('DEP002');
  assert.equal(found.Nombre, 'Sales');
  assert.equal(repo.findById('DOES_NOT_EXIST'), null);

  const updated = repo.update('DEP002', { Nombre: 'Sales & Marketing' });
  assert.equal(updated.Nombre, 'Sales & Marketing');
  assert.equal(repo.findById('DEP002').Nombre, 'Sales & Marketing');

  repo.softDelete('DEP002');
  assert.equal(repo.findById('DEP002').Activo, false);
});

test('bootstrapTestEnvironment es idempotente (no duplica al correr dos veces)', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  ctx.bootstrapTestEnvironment();

  assert.equal(new ctx.DepartmentsRepository().findAll().length, 1);
  assert.equal(new ctx.UsersRepository().findAll().length, 8);
});

test('UsersRepository.findByEmail distingue email único vs. compartido', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const users = new ctx.UsersRepository();

  assert.equal(users.findByEmail('eduardo.lopez@example.test').length, 1);
  assert.equal(users.findByEmail('executiveservices.team@example.test').length, 7);
  assert.equal(users.findByEmail('nadie@example.test').length, 0);
});

test('nextSequentialId: consecutivo por prefijo vía Script Properties, no cuenta filas del Sheet', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  assert.equal(repo.nextSequentialId('T', 5), 'T00001');
  assert.equal(repo.nextSequentialId('T', 5), 'T00002');
  assert.equal(repo.nextSequentialId('T', 5), 'T00003');

  // Prefijo distinto = contador independiente, sin importar cuántas Tasks
  // se hayan generado ya (a diferencia de contar filas del Sheet, que
  // mezclaba el conteo de una tabla con el ID de otra si compartieran
  // instancia de repositorio).
  assert.equal(repo.nextSequentialId('ADJ', 5), 'ADJ00001');
  assert.equal(repo.nextSequentialId('T', 5), 'T00004');

  // El contador vive en Script Properties (no en el Sheet): softDelete o
  // filas existentes no lo alteran, y una instancia nueva del repositorio
  // sigue la secuencia en vez de reiniciarla.
  repo.softDelete('DEP001');
  const otherRepoInstance = new ctx.DepartmentsRepository();
  assert.equal(otherRepoInstance.nextSequentialId('T', 5), 'T00005');
});

test('nextSequentialId: usa LockService.getScriptLock() para el incremento atómico', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  let waitLockCalls = 0;
  let releaseLockCalls = 0;
  const realGetScriptLock = ctx.LockService.getScriptLock;
  ctx.LockService.getScriptLock = function () {
    const lock = realGetScriptLock();
    return {
      waitLock: function (ms) {
        waitLockCalls++;
        return lock.waitLock(ms);
      },
      releaseLock: function () {
        releaseLockCalls++;
        return lock.releaseLock();
      }
    };
  };

  repo.nextSequentialId('T', 5);
  assert.equal(waitLockCalls, 1);
  assert.equal(releaseLockCalls, 1);

  // El lock se libera incluso si algo falla en el medio (no debe quedar
  // trabado para el siguiente request de otro usuario).
  const realGetScriptProperties = ctx.PropertiesService.getScriptProperties;
  ctx.PropertiesService.getScriptProperties = function () {
    throw new Error('fallo simulado');
  };
  assert.throws(() => repo.nextSequentialId('T', 5), /fallo simulado/);
  ctx.PropertiesService.getScriptProperties = realGetScriptProperties;
  assert.equal(releaseLockCalls, 2, 'releaseLock debe llamarse aunque falle el incremento (finally)');
});

// Cuenta cuántas veces se llama getRange() sobre una hoja — cada llamada es
// una operación real contra Sheets en producción, que es lo que sentía
// "lento" antes de agregar el cache (ver comentario en 10_SheetRepository.js).
function countGetRangeCalls(sheet) {
  let calls = 0;
  const original = sheet.getRange.bind(sheet);
  sheet.getRange = function (...args) {
    calls++;
    return original(...args);
  };
  return () => calls;
}

test('SheetRepository.findAll(): cachea por nombre de hoja — llamadas repetidas no releen el Sheet', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();
  const sheet = ctx.__spreadsheet.getSheetByName(ctx.Config.SHEET_TABS.DEPARTMENTS);
  const getCalls = countGetRangeCalls(sheet);

  repo.findAll();
  const callsAfterFirst = getCalls();
  assert.ok(callsAfterFirst > 0, 'la primera llamada sí debe leer el Sheet');

  repo.findAll();
  repo.findAll();
  assert.equal(getCalls(), callsAfterFirst, 'llamadas subsecuentes deben servirse del cache, sin nuevas lecturas');
});

test('SheetRepository: el cache es por nombre de hoja, no por instancia — una instancia nueva también lo aprovecha', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const sheet = ctx.__spreadsheet.getSheetByName(ctx.Config.SHEET_TABS.DEPARTMENTS);

  new ctx.DepartmentsRepository().findAll();
  const getCalls = countGetRangeCalls(sheet);

  // Instancia distinta del mismo repositorio (el patrón real: el código
  // hace `new XRepository()` en casi cada llamada) — debe reusar el cache
  // llenado por la instancia anterior.
  new ctx.DepartmentsRepository().findAll();
  assert.equal(getCalls(), 0, 'una instancia nueva del mismo repositorio no debe releer el Sheet si ya hay cache');
});

test('SheetRepository: create() invalida el cache — el próximo findAll ve el registro nuevo', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  assert.equal(repo.findAll().length, 1); // llena el cache con 1 fila
  repo.create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });

  assert.equal(repo.findAll().length, 2, 'create() debe invalidar el cache para que el nuevo registro sea visible de inmediato');
});

test('SheetRepository: update() invalida el cache — el próximo findAll/findById ve el cambio', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  repo.findAll(); // llena el cache
  repo.update('DEP001', { Nombre: 'Executive Services (renombrado)' });

  assert.equal(repo.findById('DEP001').Nombre, 'Executive Services (renombrado)', 'update() debe invalidar el cache, no servir el nombre viejo');
});

test('SheetRepository.findAll(): devuelve copias — mutar el resultado no corrompe el cache compartido', () => {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  const repo = new ctx.DepartmentsRepository();

  const first = repo.findAll();
  first[0].Nombre = 'Mutado a mano';

  const second = repo.findAll();
  assert.equal(second[0].Nombre, 'Executive Services', 'mutar un resultado anterior no debe afectar llamadas futuras (cache por valor, no por referencia)');
});
