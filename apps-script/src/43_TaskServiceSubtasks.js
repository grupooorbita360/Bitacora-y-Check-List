/**
 * TaskService (Subtasks) — crear/completar/cancelar subtareas. Extiende
 * TaskService (43_TaskService.js, que carga antes — ver su comentario de
 * cabecera) con Object.assign.
 */
Object.assign(TaskService, {
  addSubtask: function (taskId, title, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.CREATE_SUBTASK, task)) {
      throw new Error('No tienes permiso para agregar subtareas.');
    }
    var subtasks = new TaskSubtasksRepository();
    var subtaskId = subtasks.nextSequentialId('SUB', 5);
    subtasks.create({
      'Subtask ID': subtaskId,
      'Task ID': taskId,
      Title: title,
      Status: Config.SUBTASK_STATUS.PENDING,
      'Created By ID': actingUserId,
      'Created At': new Date(),
      'Completed At': '',
      Activo: true
    });
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.SUBTASK_CREATED, actingUserId, '', { subtaskId: subtaskId });
    return subtaskId;
  },

  // Completar una subtarea NUNCA completa la Task principal (sección 23).
  completeSubtask: function (subtaskId, actingUserId) {
    var subtasks = new TaskSubtasksRepository();
    var subtask = subtasks.findById(subtaskId);
    if (!subtask) throw new Error('Subtarea no encontrada.');
    var task = new TasksRepository().findById(subtask['Task ID']);
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.COMPLETE_SUBTASK, task)) {
      throw new Error('No tienes permiso para completar esta subtarea.');
    }
    var updated = subtasks.update(subtaskId, { Status: Config.SUBTASK_STATUS.COMPLETED, 'Completed At': new Date() });
    TaskHistoryService.record(subtask['Task ID'], Config.HISTORY_EVENTS.SUBTASK_COMPLETED, actingUserId, '', {
      subtaskId: subtaskId
    });
    return updated;
  },

  cancelSubtask: function (subtaskId) {
    return new TaskSubtasksRepository().update(subtaskId, { Status: Config.SUBTASK_STATUS.CANCELLED });
  }
});
