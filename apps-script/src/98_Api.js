/**
 * Api — únicas funciones que el cliente invoca (vía google.script.run en
 * producción, vía fetch en el dev server local — ver apps-script/devserver).
 * google.script.run solo puede llamar funciones globales, nunca métodos de
 * objeto, por eso cada una es un wrapper delgado sobre los Services ya
 * probados en Fase 2/3. Nunca contienen lógica de negocio propia.
 *
 * `token` es el token de sesión (solo existe para la vía SELECT_PIN de
 * Auth); en la vía DIRECT el cliente siempre manda null y el servidor
 * resuelve con Session.getActiveUser() (docs/01-modelo-datos.md → Auth).
 *
 * Este archivo trae los helpers compartidos (_resolveActingUserId,
 * _toPlain) + Auth/bootstrap. El resto de los endpoints vive en
 * 98_Api<Módulo>.js (Dashboard/Tasks/TaskActions/Checklist, ver
 * docs/16-file-split-map.md) — a diferencia de TaskService, estos son
 * funciones `function api_x() {}` independientes (no un objeto
 * compartido), así que no hay ninguna dependencia de orden de carga entre
 * ellos: cada api_* se resuelve por su cuenta cuando Apps Script la llama,
 * mucho después de que todo el proyecto ya cargó.
 */

function _resolveActingUserId(token) {
  var user = AuthService.resolveCurrentUser(token);
  if (!user) throw new Error('Sesión inválida.');
  return user['User ID'];
}

// Apps Script serializa Date de forma inconsistente a través de
// google.script.run — se convierten a ISO string explícitamente para que
// el contrato con el cliente sea siempre el mismo (string o vacío).
function _toPlain(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(_toPlain);
  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = _toPlain(value[key]);
    });
    return out;
  }
  return value;
}

// --- Auth --------------------------------------------------------------

function api_startLogin() {
  var email = Session.getActiveUser().getEmail();
  return _toPlain(AuthService.identify(email));
}

function api_loginWithPin(loginId, pin) {
  return AuthService.loginWithPin(loginId, pin);
}

function api_bootstrap(token) {
  var userId = _resolveActingUserId(token);
  return _toPlain({
    user: UserService.getWithRoles(userId),
    departments: DepartmentService.listActive()
  });
}
