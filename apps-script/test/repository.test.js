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
