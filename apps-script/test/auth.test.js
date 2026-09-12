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

test('identify(): email único entra DIRECT sin PIN', () => {
  const ctx = setUp();
  const result = ctx.AuthService.identify('eduardo.lopez@example.test');
  assert.equal(result.mode, 'DIRECT');
  assert.equal(result.user.userId, 'U001');
});

test('identify(): email compartido devuelve candidatos para selector+PIN', () => {
  const ctx = setUp();
  const result = ctx.AuthService.identify('executiveservices.team@example.test');
  assert.equal(result.mode, 'SELECT_PIN');
  assert.equal(result.candidates.length, 7);
  assert.ok(result.candidates.some((c) => c.loginId === 'm.moreno'));
});

test('identify(): email sin usuarios activos es DENIED', () => {
  const ctx = setUp();
  const result = ctx.AuthService.identify('nadie@example.test');
  assert.equal(result.mode, 'DENIED');
});

test('emailRequiresPin() se deriva del conteo, no es un campo guardado', () => {
  const ctx = setUp();
  assert.equal(ctx.AuthService.emailRequiresPin('eduardo.lopez@example.test'), false);
  assert.equal(ctx.AuthService.emailRequiresPin('executiveservices.team@example.test'), true);
});

test('loginWithPin(): PIN correcto emite un token válido', () => {
  const ctx = setUp();
  const token = ctx.AuthService.loginWithPin('m.moreno', '1234');
  assert.equal(typeof token, 'string');
  const user = ctx.AuthService.resolveCurrentUser(token);
  assert.equal(user['User ID'], 'U002');
});

test('loginWithPin(): PIN incorrecto lanza error y no emite token', () => {
  const ctx = setUp();
  assert.throws(() => ctx.AuthService.loginWithPin('m.moreno', '9999'), /PIN incorrecto/);
});

test('loginWithPin(): PIN con formato inválido (no 4 dígitos) se rechaza', () => {
  const ctx = setUp();
  assert.throws(() => ctx.AuthService.loginWithPin('m.moreno', '12'), /PIN inválido/);
  assert.throws(() => ctx.AuthService.loginWithPin('m.moreno', 'abcd'), /PIN inválido/);
});

test('loginWithPin(): Login ID inexistente lanza error', () => {
  const ctx = setUp();
  assert.throws(() => ctx.AuthService.loginWithPin('no.existe', '1234'), /no encontrado/);
});

test('resolveCurrentUser(): sin token, usa Session.getActiveUser() para email único', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('eduardo.lopez@example.test');
  const user = ctx.AuthService.resolveCurrentUser();
  assert.equal(user['User ID'], 'U001');
});

test('resolveCurrentUser(): sin token, email compartido exige selector+PIN', () => {
  const ctx = setUp();
  ctx.__setActiveUserEmail('executiveservices.team@example.test');
  assert.throws(() => ctx.AuthService.resolveCurrentUser(), /requiere seleccionar usuario y PIN/);
});

test('resolveCurrentUser(): token alterado (firma inválida) se rechaza', () => {
  const ctx = setUp();
  const token = ctx.AuthService.loginWithPin('m.moreno', '1234');
  const tampered = token.slice(0, -2) + 'xx';
  assert.throws(() => ctx.AuthService.resolveCurrentUser(tampered), /Token de sesión inválido/);
});

test('resetPin(): solo un Admin puede reiniciar el PIN de otro usuario', () => {
  const ctx = setUp();
  // U002 (Marta) es Supervisor, no Admin.
  assert.throws(() => ctx.AuthService.resetPin('U002', 'U003', '5555'), /Solo un usuario con rol Admin/);

  // U001 (Eduardo) es Admin.
  ctx.AuthService.resetPin('U001', 'U003', '5555');
  const token = ctx.AuthService.loginWithPin('a.hernandez', '5555');
  assert.equal(ctx.AuthService.resolveCurrentUser(token)['User ID'], 'U003');
});

test('PIN nunca se guarda en texto plano en Auth_Credentials', () => {
  const ctx = setUp();
  const creds = new ctx.AuthCredentialsRepository().findByUserId('U002');
  assert.notEqual(creds['PIN Hash'], '1234');
  assert.equal(creds['PIN Hash'].length, 64); // hex de SHA-256
  assert.ok(creds.Salt && creds.Salt.length > 0);
});
