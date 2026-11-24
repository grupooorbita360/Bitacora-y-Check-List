/**
 * TaskService (Lifecycle) — transiciones de Status (OPEN/COMPLETE/SNOOZE/
 * RESUME/CANCEL/REOPEN). Extiende TaskService (43_TaskService.js, que
 * carga antes — ver su comentario de cabecera) con Object.assign.
 */
Object.assign(TaskService, {
  transition: function (taskId, action, actingUserId, opts) {
    opts = opts || {};
    var tasks = new TasksRepository();
    var task = tasks.findById(taskId);
    if (!task) throw new Error('Task no encontrada.');

    if (!TaskPermissionService.can(actingUserId, action, task)) {
      throw new Error('No tienes permiso para realizar la acción "' + action + '" sobre esta Task.');
    }

    var rule = new TaskStatusTransitionsRepository().findTransition(task.Status, action);
    if (!rule) {
      throw new Error('Transición inválida: no se puede ' + action + ' una Task en estado ' + task.Status + '.');
    }
    if (rule['Requires Comment'] === true && !opts.comment) {
      throw new Error('La acción "' + action + '" requiere un comentario.');
    }
    if (rule['Requires Review Date'] === true && !opts.reviewDate) {
      throw new Error('SNOOZE requiere una fecha de revisión (reviewDate).');
    }

    var patch = { Status: rule['To Status'], 'Updated At': new Date() };
    if (action === Config.TASK_ACTIONS.COMPLETE) {
      patch['Completed At'] = new Date();
    }
    if (action === Config.TASK_ACTIONS.CANCEL) {
      patch['Cancelled At'] = new Date();
      patch['Cancelled By ID'] = actingUserId;
      patch['Cancellation Reason'] = opts.comment;
    }
    if (action === Config.TASK_ACTIONS.SNOOZE) {
      patch['Review Date'] = opts.reviewDate;
    }

    var updated = tasks.update(taskId, patch);
    TaskHistoryService.record(taskId, this._eventForAction(action), actingUserId, opts.comment || '', {
      reviewDate: opts.reviewDate || ''
    });
    return updated;
  },

  _eventForAction: function (action) {
    var A = Config.TASK_ACTIONS;
    var E = Config.HISTORY_EVENTS;
    var map = {};
    map[A.OPEN] = E.OPENED;
    map[A.COMPLETE] = E.COMPLETED;
    map[A.SNOOZE] = E.SNOOZED;
    map[A.RESUME] = E.RESUMED;
    map[A.CANCEL] = E.CANCELLED;
    map[A.REOPEN] = E.REOPENED;
    return map[action] || action;
  }
});
