/**
 * TaskAssignmentService — valida contra Task_Assignment_Config (TA01-TA19)
 * si `actingUserId` puede convertir a `newOwnerId` en el nuevo Owner, según
 * sus roles y (cuando la regla lo exige) si comparten Department ID.
 *
 * `Requiere_Aprobacion` es NO en las 19 filas reales — se lee pero hoy no
 * cambia el flujo (ver docs/06-fase-3-decisiones.md): el flujo de
 * aprobación de Fase 3 es Task_Adjustments (request/approve/reject), un
 * mecanismo aparte para cuando no hay ninguna regla directa de asignación.
 */
var TaskAssignmentService = {
  ACTION_RULES: {
    ASSIGN_REASSIGN: 'ASSIGN_REASSIGN',
    TAKE_OWNERSHIP: 'TAKE_OWNERSHIP',
    BULK_REASSIGN: 'BULK_REASSIGN'
  },

  canAssignTo: function (actingUserId, newOwnerId, actionRule) {
    if (PermissionService.isAdmin(actingUserId)) return true;

    var actingUser = new UsersRepository().findById(actingUserId);
    var targetUser = new UsersRepository().findById(newOwnerId);
    if (!actingUser || !targetUser) return false;

    var actingRoles = PermissionService.getRoles(actingUserId);
    var targetRoles = PermissionService.getRoles(newOwnerId);
    var config = new TaskAssignmentConfigRepository();

    var matchingRules = [];
    actingRoles.forEach(function (originRole) {
      targetRoles.forEach(function (destinationRole) {
        matchingRules = matchingRules.concat(config.findRules(actionRule, originRole, destinationRole));
      });
    });
    if (!matchingRules.length) return false;

    return matchingRules.some(function (rule) {
      if (rule.Mismo_Departamento === true) {
        return String(actingUser['Department ID']) === String(targetUser['Department ID']);
      }
      return true;
    });
  }
};
