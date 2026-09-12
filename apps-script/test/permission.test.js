'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContext } = require('./loadGas');

function setUp() {
  const ctx = createContext();
  ctx.bootstrapTestEnvironment();
  return ctx;
}

test('PermissionService.getRoles/hasRole/isAdmin', () => {
  const ctx = setUp();
  const roles = ctx.PermissionService.getRoles('U001');
  assert.deepEqual(roles.sort(), ['Admin', 'Manager']);
  assert.equal(ctx.PermissionService.hasRole('U001', ctx.Config.ROLES.MANAGER), true);
  assert.equal(ctx.PermissionService.isAdmin('U001'), true);
  assert.equal(ctx.PermissionService.isAdmin('U002'), false);
});

test('PermissionService.canAccessDepartment: Admin accede a cualquier departamento', () => {
  const ctx = setUp();
  new ctx.DepartmentsRepository().create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });
  assert.equal(ctx.PermissionService.canAccessDepartment('U001', 'DEP002'), true);
});

test('PermissionService.canAccessDepartment: usuario sin Admin solo accede a su propio departamento', () => {
  const ctx = setUp();
  new ctx.DepartmentsRepository().create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });
  assert.equal(ctx.PermissionService.canAccessDepartment('U002', 'DEP001'), true);
  assert.equal(ctx.PermissionService.canAccessDepartment('U002', 'DEP002'), false);
});

test('UserService.getWithRoles combina Users + User_Roles', () => {
  const ctx = setUp();
  const eduardo = ctx.UserService.getWithRoles('U001');
  assert.equal(eduardo.Nombre, 'Eduardo Lopez');
  assert.deepEqual(eduardo.roles.sort(), ['Admin', 'Manager']);
  assert.equal(ctx.UserService.getWithRoles('NO_EXISTE'), null);
});

test('DepartmentService.listActive ordena por Orden y excluye inactivos', () => {
  const ctx = setUp();
  const depts = new ctx.DepartmentsRepository();
  depts.create({ 'Department ID': 'DEP003', Nombre: 'Reservations', 'Nombre Corto': 'Res', Activo: true, Orden: 3 });
  depts.create({ 'Department ID': 'DEP002', Nombre: 'Sales', 'Nombre Corto': 'Sales', Activo: true, Orden: 2 });
  depts.softDelete('DEP003');

  const active = ctx.DepartmentService.listActive();
  assert.deepEqual(active.map((d) => d['Department ID']), ['DEP001', 'DEP002']);
});
