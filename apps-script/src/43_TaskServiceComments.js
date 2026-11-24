/**
 * TaskService (Comments) — agregar comentarios y leer el historial.
 * Extiende TaskService (43_TaskService.js, que carga antes — ver su
 * comentario de cabecera) con Object.assign.
 */
Object.assign(TaskService, {
  addComment: function (taskId, actingUserId, commentText) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!commentText) throw new Error('El comentario no puede estar vacío.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.ADD_COMMENT, task)) {
      throw new Error('No tienes permiso para comentar esta Task.');
    }
    return TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.COMMENT_ADDED, actingUserId, commentText, {});
  },

  getHistory: function (taskId) {
    return TaskHistoryService.listForTask(taskId);
  }
});
