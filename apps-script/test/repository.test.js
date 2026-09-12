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
