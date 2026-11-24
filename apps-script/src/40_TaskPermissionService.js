/**
 * TaskPermissionService — motor de permisos de Tasks, ahora sobre datos
 * reales de Task_Permissions (TP001-TP087, ver docs/06-fase-3-decisiones.md).
 *
 * Regla de resolución por acción:
 *  1. Si la acción NO tiene ninguna fila en Task_Permissions (OPEN, RESUME,
 *     COMPLETE_SUBTASK — no están modeladas ahí), se usa la lógica derivada
 *     de respaldo (_fallbackCan), igual que antes de tener los datos reales.
 *  2. Si la acción SÍ está modelada, se resuelve EXCLUSIVAMENTE con las
 *     filas reales: se toman los roles del usuario, se juntan los Alcance
 *     permitidos para (rol, acción), y se evalúa cada Alcance contra la
 *     Task. Si el usuario tiene un rol sin fila para esa acción (ej. Agent
 *     + REASSIGN), es una negación real de los datos, no un fallback.
 *
 * Alcance se evalúa así (ver docs/06-fase-3-decisiones.md para el porqué):
 *   ALL              -> siempre true
 *   DEPARTMENT       -> mismo Department ID que la Task
 *   CROSS_DEPARTMENT -> departamento distinto (sin tabla de Delegations
 *                       todavía, se resuelve como "cualquier otro depto")
 *   OWN              -> el usuario es el Owner de la Task
 *   PARTICIPANT      -> el usuario es Participant de la Task
 *   SHARED           -> Tasks['Operational Scope'] === 'SHARED' (así,
 *                       Take Ownership con Alcance=SHARED no necesita que el
 *                       usuario ya sea Participant, igual que en el caso
 *                       "Task Shared" de la sección 10).
 *
 * Visibility (docs/02-reglas-negocio.md) es una barrera ADICIONAL, evaluada
 * antes que Alcance — no lo reemplaza, se le suma con AND (docs/13-
 * visibility-enforcement.md). Antes de este enforcement, Visibility era
 * puramente decorativo (solo lo usaban las pestañas de Tasks en el
 * cliente); ahora es un requisito real de `can()`, así que ninguna acción
 * (ver, comentar, completar, etc.) puede violarlo ni siquiera llamando a
 * la API directo, saltándose el cliente:
 *   OPERATIONAL -> sin restricción adicional (solo el Alcance de siempre).
 *   RESTRICTED  -> Owner, Participant o Admin únicamente.
 *   SUPERVISION -> rol Supervisor o superior (Supervisor/Manager/Director),
 *                  o Admin. Sin excepción para el Owner/Participant: una
 *                  Task de seguimiento (ej. Checklist con problema) puede
 *                  tener como Owner a quien reportó el problema sin que
 *                  eso le dé acceso — es justamente el caso de uso que
 *                  motivó este enforcement (Fase 5: Warnings/coaching).
 *   MANAGEMENT  -> rol Manager o superior (Manager/Director), o Admin.
 *                  Mismo criterio, sin excepción para Owner/Participant.
 */
var TaskPermissionService = {
  canView: function (userId, task) {
    return this.can(userId, Config.TASK_ACTIONS.VIEW, task);
  },

  can: function (userId, action, task) {
    if (PermissionService.isAdmin(userId)) return true;
    if (!this._visibilityAllows(userId, task)) return false;

    var permissions = new TaskPermissionsRepository();
    if (!permissions.actionExists(action)) {
      return this._fallbackCan(userId, action, task);
    }

    var roles = PermissionService.getRoles(userId);
    var self = this;
    var scopes = [];
    roles.forEach(function (role) {
      scopes = scopes.concat(permissions.findScopesFor(role, action));
    });
    if (!scopes.length) return false;

    return scopes.some(function (scope) {
      return self._evaluateScope(scope, userId, task);
    });
  },

  // Barrera de Visibility — ver cabecera del archivo. Se evalúa para TODA
  // acción sobre una Task concreta (no solo VIEW): si no se puede ni ver,
  // tampoco se puede actuar sobre ella. isAdmin ya se resolvió en can()
  // antes de llegar acá.
  _visibilityAllows: function (userId, task) {
    var visibility = task.Visibility || Config.TASK_VISIBILITY.OPERATIONAL;
    if (visibility === Config.TASK_VISIBILITY.OPERATIONAL) return true;

    if (visibility === Config.TASK_VISIBILITY.RESTRICTED) {
      return String(task['Owner ID']) === String(userId) || this._isParticipant(userId, task['Task ID']);
    }

    var roles = PermissionService.getRoles(userId);
    if (visibility === Config.TASK_VISIBILITY.SUPERVISION) {
      return this._isSupervisorOrAbove(roles);
    }
    if (visibility === Config.TASK_VISIBILITY.MANAGEMENT) {
      return this._isManagerOrAbove(roles);
    }
    // Visibility desconocida/corrupta: negar por defecto (fail-closed).
    return false;
  },

  // Verifica que un usuario CANDIDATO a convertirse en Owner o Participant
  // de una Task alcance el nivel de rol que exige su Visibility — el
  // mismo criterio de SUPERVISION/MANAGEMENT que usa _visibilityAllows,
  // pero sin sus ramas de OPERATIONAL/RESTRICTED: esas no hacen falta
  // acá porque el propio acto de reasignar/agregar ya satisface su único
  // requisito (RESTRICTED exige Owner o Participant, y el candidato está
  // justamente a punto de convertirse en eso). Sin este chequeo, alguien
  // podía quedar como Owner/Participant de una Task SUPERVISION/MANAGEMENT
  // que su propio rol ya no le permite ver (docs/15-visibility-assignment-gaps.md)
  // — exactamente el hueco que _applyReassign/addParticipant/takeOwnership
  // tenían antes de este chequeo.
  //
  // Usa las primitivas públicas de PermissionService (userId), no las
  // internas de este archivo (roles ya resueltos) — son las mismas que ya
  // reutiliza ChecklistService.convertRunToTask, sin duplicar la lista de
  // roles una tercera vez.
  canReceiveAssignment: function (candidateUserId, task) {
    if (PermissionService.isAdmin(candidateUserId)) return true;
    var visibility = task.Visibility || Config.TASK_VISIBILITY.OPERATIONAL;
    if (visibility === Config.TASK_VISIBILITY.SUPERVISION) {
      return PermissionService.isSupervisorOrAbove(candidateUserId);
    }
    if (visibility === Config.TASK_VISIBILITY.MANAGEMENT) {
      return PermissionService.isManagerOrAbove(candidateUserId);
    }
    return true;
  },

  // Capacidad general de usar bulk reassign (sin Task concreta todavía).
  canBulkReassign: function (userId) {
    if (PermissionService.isAdmin(userId)) return true;
    var action = Config.TASK_ACTIONS.BULK_REASSIGN;
    var permissions = new TaskPermissionsRepository();
    var roles = PermissionService.getRoles(userId);
    if (!permissions.actionExists(action)) {
      return this._isManagerOrAbove(roles);
    }
    return roles.some(function (role) {
      return permissions.findScopesFor(role, action).length > 0;
    });
  },

  _evaluateScope: function (scope, userId, task) {
    var user = new UsersRepository().findById(userId);
    if (!user) return false;

    switch (scope) {
      case 'ALL':
        return true;
      case Config.TASK_SCOPE.DEPARTMENT:
        return String(user['Department ID']) === String(task.Department);
      case Config.TASK_SCOPE.CROSS_DEPARTMENT:
        return String(user['Department ID']) !== String(task.Department);
      case Config.TASK_SCOPE.OWN:
        return String(task['Owner ID']) === String(userId);
      case 'PARTICIPANT':
        return this._isParticipant(userId, task['Task ID']);
      case Config.TASK_SCOPE.SHARED:
        return task['Operational Scope'] === Config.TASK_SCOPE.SHARED;
      default:
        return false;
    }
  },

  // Lógica derivada — SOLO para acciones sin fila en Task_Permissions
  // (ver cabecera del archivo). No usar para acciones ya modeladas.
  _fallbackCan: function (userId, action, task) {
    var isOwner = String(task['Owner ID']) === String(userId);
    var isSupervisorOfOwner = this._supervises(userId, task['Owner ID']);
    var isManagerOfDepartment = this._managesDepartment(userId, task.Department);
    var A = Config.TASK_ACTIONS;

    switch (action) {
      case A.OPEN:
      case A.RESUME:
      case A.COMPLETE_SUBTASK:
        return isOwner || isSupervisorOfOwner || isManagerOfDepartment;
      default:
        return isOwner || isSupervisorOfOwner || isManagerOfDepartment;
    }
  },

  _isParticipant: function (userId, taskId) {
    return new TaskParticipantsRepository().findByTask(taskId).some(function (p) {
      return String(p['User ID']) === String(userId);
    });
  },

  // Un usuario "supervisa" a ownerId si es su Supervisor, su Manager, o es
  // el propio owner (para no negar acciones normales de lifecycle sobre la
  // propia Task). Solo usado por _fallbackCan.
  _supervises: function (candidateId, ownerId) {
    if (String(candidateId) === String(ownerId)) return true;
    return this._isRealSupervisorOf(candidateId, ownerId);
  },

  _isRealSupervisorOf: function (candidateId, ownerId) {
    var owner = new UsersRepository().findById(ownerId);
    if (!owner) return false;
    return String(owner.Supervisor) === String(candidateId) || String(owner.Manager) === String(candidateId);
  },

  _managesDepartment: function (userId, departmentId) {
    var roles = PermissionService.getRoles(userId);
    if (!this._isManagerOrAbove(roles)) return false;
    var user = new UsersRepository().findById(userId);
    return !!user && String(user['Department ID']) === String(departmentId);
  },

  _isManagerOrAbove: function (roles) {
    return roles.indexOf(Config.ROLES.MANAGER) !== -1 || roles.indexOf(Config.ROLES.DIRECTOR) !== -1;
  },

  _isSupervisorOrAbove: function (roles) {
    return roles.indexOf(Config.ROLES.SUPERVISOR) !== -1 || this._isManagerOrAbove(roles);
  }
};
