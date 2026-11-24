/**
 * TaskService (Participants) — agregar/quitar Participants. Extiende
 * TaskService (43_TaskService.js, que carga antes — ver su comentario de
 * cabecera) con Object.assign.
 */
Object.assign(TaskService, {
  addParticipant: function (taskId, userId, actingUserId, roleInTask) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.ADD_PARTICIPANT, task)) {
      throw new Error('No tienes permiso para agregar participantes.');
    }
    roleInTask = roleInTask || Config.TASK_PARTICIPANT_ROLES.COLLABORATOR;
    var validRoles = Object.keys(Config.TASK_PARTICIPANT_ROLES).map(function (k) {
      return Config.TASK_PARTICIPANT_ROLES[k];
    });
    if (validRoles.indexOf(roleInTask) === -1) {
      throw new Error('Role in Task inválido: "' + roleInTask + '". Debe ser uno de ' + validRoles.join(', ') + '.');
    }
    if (!TaskPermissionService.canReceiveAssignment(userId, task)) {
      throw new Error('No se puede agregar a esta persona como Participant: su rol no alcanza la Visibility de esta Task (' + task.Visibility + ').');
    }

    var participants = new TaskParticipantsRepository();
    var participantId = TaskParticipantsRepository.buildId(taskId, userId);
    var existing = participants.findById(participantId);
    if (existing) {
      if (existing.Activo !== false) return existing;
      return participants.update(participantId, {
        Activo: true,
        'Role in Task': roleInTask,
        'Added By ID': actingUserId,
        'Added At': new Date()
      });
    }
    var created = {
      'Participant ID': participantId,
      'Task ID': taskId,
      'User ID': userId,
      'Role in Task': roleInTask,
      'Added By ID': actingUserId,
      'Added At': new Date(),
      Activo: true
    };
    participants.create(created);
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.PARTICIPANT_ADDED, actingUserId, '', { userId: userId, roleInTask: roleInTask });
    return created;
  },

  removeParticipant: function (taskId, userId, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.REMOVE_PARTICIPANT, task)) {
      throw new Error('No tienes permiso para quitar participantes.');
    }
    var participantId = TaskParticipantsRepository.buildId(taskId, userId);
    var updated = new TaskParticipantsRepository().softDelete(participantId);
    if (updated) {
      TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.PARTICIPANT_REMOVED, actingUserId, '', { userId: userId });
    }
    return updated;
  }
});
