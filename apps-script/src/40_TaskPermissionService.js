/**
 * TaskPermissionService — motor de permisos de Tasks para Fase 3.
 *
 * IMPORTANTE (ver docs/06-fase-3-decisiones.md): esta lógica es una
 * reconstrucción a partir de la jerarquía Director→Manager→Supervisor→
 * Agent, el modelo Owner/Visibility/Operational Scope (secciones 9-10) y
 * el flujo de Task_Adjustments — NO es una transcripción de las 87 filas
 * reales de Task_Permissions ni de las 19 de Task_Assignment_Config, cuyo
 * contenido literal no estaba disponible en esta sesión. Task_Permissions/
 * Task_Assignment_Config ya existen correctas en el Sheet real (confirmado
 * en la auditoría de Fase 1); si al instalar Fase 3 se detectan reglas más
 * finas que esta lógica no cubre, este es el único archivo a ajustar.
 */
var TaskPermissionService = {
  canView: function (userId, task) {
    if (PermissionService.isAdmin(userId)) return true;
    if (String(task['Owner ID']) === String(userId)) return true;
    if (this._isParticipant(userId, task['Task ID'])) return true;

    var user = new UsersRepository().findById(userId);
    if (!user) return false;
    var roles = PermissionService.getRoles(userId);
    var sameDepartment = String(user['Department ID']) === String(task.Department);

    switch (task.Visibility) {
      case Config.TASK_VISIBILITY.OPERATIONAL:
        return sameDepartment && this._supervises(userId, task['Owner ID']);
      case Config.TASK_VISIBILITY.SUPERVISION:
        return sameDepartment && this._isSupervisorOrAbove(roles);
      case Config.TASK_VISIBILITY.MANAGEMENT:
        return this._isManagerOrAbove(roles);
      case Config.TASK_VISIBILITY.RESTRICTED:
        return false;
      default:
        return false;
    }
  },

  can: function (userId, action, task) {
    if (PermissionService.isAdmin(userId)) return true;

    var isOwner = String(task['Owner ID']) === String(userId);
    var isSupervisorOfOwner = this._supervises(userId, task['Owner ID']);
    var isRealSupervisorOfOwner = this._isRealSupervisorOf(userId, task['Owner ID']);
    var isManagerOfDepartment = this._managesDepartment(userId, task.Department);
    var A = Config.TASK_ACTIONS;

    switch (action) {
      case A.VIEW:
        return this.canView(userId, task);

      case A.OPEN:
      case A.COMPLETE:
      case A.SNOOZE:
      case A.RESUME:
      case A.CANCEL:
      case A.REOPEN:
      case A.ADD_SUBTASK:
      case A.COMPLETE_SUBTASK:
        return isOwner || isSupervisorOfOwner || isManagerOfDepartment;

      case A.ADD_COMMENT:
        return isOwner || this._isParticipant(userId, task['Task ID']) || isSupervisorOfOwner || isManagerOfDepartment;

      case A.TAKE_OWNERSHIP:
      case A.REASSIGN:
        // El Agent nunca reasigna directo (ni a sí mismo): debe pasar por
        // TaskService.requestAdjustment() para que lo apruebe su
        // Supervisor/Manager. Por eso aquí NO se usa isSupervisorOfOwner
        // (que trata al propio Owner como "supervisor de sí mismo" para
        // las acciones normales de lifecycle) sino un chequeo que exige un
        // Supervisor/Manager real, distinto del Owner.
        return isRealSupervisorOfOwner || isManagerOfDepartment;

      case A.ADD_PARTICIPANT:
      case A.REMOVE_PARTICIPANT:
        return isOwner || isSupervisorOfOwner || isManagerOfDepartment;

      case A.APPROVE_ADJUSTMENT:
      case A.REJECT_ADJUSTMENT:
        return isRealSupervisorOfOwner || isManagerOfDepartment;

      default:
        return false;
    }
  },

  canBulkReassign: function (userId) {
    if (PermissionService.isAdmin(userId)) return true;
    var roles = PermissionService.getRoles(userId);
    return this._isManagerOrAbove(roles);
  },

  _isParticipant: function (userId, taskId) {
    return new TaskParticipantsRepository().findByTask(taskId).some(function (p) {
      return String(p['User ID']) === String(userId);
    });
  },

  // Un usuario "supervisa" a ownerId si es su Supervisor, su Manager, o es
  // el propio owner (para no negar acciones normales de lifecycle sobre la
  // propia Task). NO usar esto para REASSIGN/TAKE_OWNERSHIP/adjustments —
  // ahí hace falta un supervisor real, ver _isRealSupervisorOf.
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

  _isSupervisorOrAbove: function (roles) {
    return (
      roles.indexOf(Config.ROLES.SUPERVISOR) !== -1 ||
      roles.indexOf(Config.ROLES.MANAGER) !== -1 ||
      roles.indexOf(Config.ROLES.DIRECTOR) !== -1
    );
  },

  _isManagerOrAbove: function (roles) {
    return roles.indexOf(Config.ROLES.MANAGER) !== -1 || roles.indexOf(Config.ROLES.DIRECTOR) !== -1;
  }
};
