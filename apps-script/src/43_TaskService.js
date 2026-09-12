/**
 * TaskService — CRUD, lifecycle, comments, participants, subtasks,
 * adjustments y bulk reassignment. Orquesta TasksRepository +
 * TaskHistoryService + TaskPermissionService; nunca toca SpreadsheetApp
 * directamente (docs/00-arquitectura-general.md).
 */
var TaskService = {
  create: function (input, actingUserId) {
    var actingUser = new UsersRepository().findById(actingUserId);
    if (!actingUser) throw new Error('El usuario que crea la Task no existe.');
    if (!input || !input.title) throw new Error('La Task requiere un título.');
    if (!input.department) throw new Error('La Task requiere un departamento.');
    if (!input.type) throw new Error('La Task requiere un Task Type.');

    var allowedTypes = TaskConfigService.getAllowedTypes(actingUserId, input.department);
    if (allowedTypes.indexOf(input.type) === -1) {
      throw new Error('Task Type "' + input.type + '" no permitido para este rol/departamento.');
    }

    var ownerId = input.ownerId || actingUserId;
    var owner = new UsersRepository().findById(ownerId);
    if (!owner) throw new Error('El Owner indicado no existe.');

    var tasks = new TasksRepository();
    var taskId = tasks.nextSequentialId('T', 5);
    var now = new Date();

    var task = {
      'Task ID': taskId,
      'Task Title': input.title,
      Description: input.description || '',
      Type: input.type,
      Department: input.department,
      'Created By ID': actingUserId,
      'Created By': actingUser.Nombre,
      'Owner ID': owner['User ID'],
      Owner: owner.Nombre,
      Priority: input.priority || 'P3',
      'Due Date': input.dueDate || '',
      'Review Date': '',
      Status: Config.TASK_STATUS.PENDING,
      Visibility: input.visibility || Config.TASK_VISIBILITY.OPERATIONAL,
      'Operational Scope': input.operationalScope || Config.TASK_SCOPE.OWN,
      'Reference Type': input.referenceType || '',
      'Reference ID': input.referenceId || '',
      'Origin Department': input.originDepartment || input.department,
      'System Origin': input.systemOrigin || Config.SYSTEM_ORIGIN.MANUAL,
      'Source Record ID': input.sourceRecordId || '',
      'Created At': now,
      'Updated At': now,
      'Completed At': '',
      'Cancelled At': '',
      'Cancelled By ID': '',
      'Cancellation Reason': '',
      Active: true
    };

    tasks.create(task);
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.CREATED, actingUserId, '', { type: input.type });
    return task;
  },

  get: function (taskId, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) return null;
    if (!TaskPermissionService.canView(actingUserId, task)) {
      throw new Error('No tienes permiso para ver esta Task.');
    }
    return task;
  },

  // --- Lifecycle -----------------------------------------------------

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
  },

  // --- Ownership / reassignment ---------------------------------------

  takeOwnership: function (taskId, newOwnerId, actingUserId) {
    var tasks = new TasksRepository();
    var task = tasks.findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.TAKE_OWNERSHIP, task)) {
      throw new Error('No tienes permiso para tomar ownership de esta Task.');
    }
    var newOwner = new UsersRepository().findById(newOwnerId);
    if (!newOwner) throw new Error('El nuevo Owner no existe.');

    var previousOwnerId = task['Owner ID'];
    var updated = tasks.update(taskId, {
      'Owner ID': newOwner['User ID'],
      Owner: newOwner.Nombre,
      'Updated At': new Date()
    });
    // Take Ownership NO crea Participant (sección 9-10): el Owner anterior
    // solo queda registrado en Task_History.
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.OWNERSHIP_TAKEN, actingUserId, '', {
      previousOwnerId: previousOwnerId,
      newOwnerId: newOwnerId
    });
    return updated;
  },

  reassign: function (taskId, newOwnerId, actingUserId, comment) {
    var tasks = new TasksRepository();
    var task = tasks.findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.REASSIGN, task)) {
      throw new Error('No tienes permiso para reasignar directamente; usa requestAdjustment().');
    }
    var newOwner = new UsersRepository().findById(newOwnerId);
    if (!newOwner) throw new Error('El nuevo Owner no existe.');

    var updated = tasks.update(taskId, {
      'Owner ID': newOwner['User ID'],
      Owner: newOwner.Nombre,
      'Updated At': new Date()
    });
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.REASSIGNED, actingUserId, comment || '', {
      newOwnerId: newOwnerId
    });
    return updated;
  },

  // BULK_REASSIGN es una acción, nunca un Task Type (sección 35/decisión
  // cerrada Fase 1). Reasigna lo que pueda y reporta el resto como error
  // por Task, en vez de abortar todo el lote.
  bulkReassign: function (taskIds, newOwnerId, actingUserId, comment) {
    if (!TaskPermissionService.canBulkReassign(actingUserId)) {
      throw new Error('No tienes permiso para reasignar en bloque.');
    }
    var self = this;
    return taskIds.map(function (taskId) {
      try {
        self.reassign(taskId, newOwnerId, actingUserId, comment);
        return { taskId: taskId, ok: true };
      } catch (e) {
        return { taskId: taskId, ok: false, error: e.message };
      }
    });
  },

  // --- Comments --------------------------------------------------------

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
  },

  // --- Participants ------------------------------------------------------

  addParticipant: function (taskId, userId, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.ADD_PARTICIPANT, task)) {
      throw new Error('No tienes permiso para agregar participantes.');
    }
    var participants = new TaskParticipantsRepository();
    var participantId = TaskParticipantsRepository.buildId(taskId, userId);
    var existing = participants.findById(participantId);
    if (existing) {
      if (existing.Activo !== false) return existing;
      return participants.update(participantId, { Activo: true, 'Added By ID': actingUserId, 'Added At': new Date() });
    }
    var created = {
      'Participant ID': participantId,
      'Task ID': taskId,
      'User ID': userId,
      'Role in Task': 'PARTICIPANT',
      'Added By ID': actingUserId,
      'Added At': new Date(),
      Activo: true
    };
    participants.create(created);
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.PARTICIPANT_ADDED, actingUserId, '', { userId: userId });
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
  },

  // --- Subtasks ------------------------------------------------------

  addSubtask: function (taskId, title, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.ADD_SUBTASK, task)) {
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
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.SUBTASK_ADDED, actingUserId, '', { subtaskId: subtaskId });
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
  },

  // --- Adjustments (flujo de aprobación para reasignar/cambiar depto) ----

  requestAdjustment: function (taskId, type, actingUserId, details) {
    details = details || {};
    var task = new TasksRepository().findById(taskId);
    if (!task) throw new Error('Task no encontrada.');

    var adjustments = new TaskAdjustmentsRepository();
    var adjustmentId = adjustments.nextSequentialId('ADJ', 5);
    adjustments.create({
      'Adjustment ID': adjustmentId,
      'Task ID': taskId,
      Type: type,
      'Requested By ID': actingUserId,
      'Requested At': new Date(),
      'New Owner ID': details.newOwnerId || '',
      'New Department ID': details.newDepartmentId || '',
      Reason: details.reason || '',
      Status: Config.ADJUSTMENT_STATUS.PENDING,
      'Resolved By ID': '',
      'Resolved At': '',
      'Resolution Comment': ''
    });
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.ADJUSTMENT_REQUESTED, actingUserId, details.reason || '', {
      adjustmentId: adjustmentId,
      type: type
    });
    return adjustmentId;
  },

  resolveAdjustment: function (adjustmentId, decision, actingUserId, resolutionComment) {
    var adjustments = new TaskAdjustmentsRepository();
    var adjustment = adjustments.findById(adjustmentId);
    if (!adjustment) throw new Error('Ajuste no encontrado.');
    if (adjustment.Status !== Config.ADJUSTMENT_STATUS.PENDING) {
      throw new Error('El ajuste ya fue resuelto (' + adjustment.Status + ').');
    }
    var task = new TasksRepository().findById(adjustment['Task ID']);
    var action =
      decision === Config.ADJUSTMENT_STATUS.APPROVED
        ? Config.TASK_ACTIONS.APPROVE_ADJUSTMENT
        : Config.TASK_ACTIONS.REJECT_ADJUSTMENT;
    if (!TaskPermissionService.can(actingUserId, action, task)) {
      throw new Error('No tienes permiso para resolver este ajuste.');
    }

    adjustments.update(adjustmentId, {
      Status: decision,
      'Resolved By ID': actingUserId,
      'Resolved At': new Date(),
      'Resolution Comment': resolutionComment || ''
    });

    if (decision === Config.ADJUSTMENT_STATUS.APPROVED) {
      var patch = { 'Updated At': new Date() };
      if (adjustment['New Owner ID']) {
        var newOwner = new UsersRepository().findById(adjustment['New Owner ID']);
        if (!newOwner) throw new Error('El nuevo Owner del ajuste ya no existe.');
        patch['Owner ID'] = newOwner['User ID'];
        patch.Owner = newOwner.Nombre;
      }
      if (adjustment['New Department ID']) {
        patch.Department = adjustment['New Department ID'];
      }
      new TasksRepository().update(adjustment['Task ID'], patch);
    }

    var event =
      decision === Config.ADJUSTMENT_STATUS.APPROVED
        ? Config.HISTORY_EVENTS.ADJUSTMENT_APPROVED
        : Config.HISTORY_EVENTS.ADJUSTMENT_REJECTED;
    TaskHistoryService.record(adjustment['Task ID'], event, actingUserId, resolutionComment || '', {
      adjustmentId: adjustmentId
    });
    return adjustments.findById(adjustmentId);
  },

  cancelAdjustment: function (adjustmentId, actingUserId, reason) {
    var adjustments = new TaskAdjustmentsRepository();
    var adjustment = adjustments.findById(adjustmentId);
    if (!adjustment) throw new Error('Ajuste no encontrado.');
    if (adjustment.Status !== Config.ADJUSTMENT_STATUS.PENDING) {
      throw new Error('El ajuste ya fue resuelto (' + adjustment.Status + ').');
    }
    var isRequester = String(adjustment['Requested By ID']) === String(actingUserId);
    if (!isRequester && !PermissionService.isAdmin(actingUserId)) {
      throw new Error('Solo quien solicitó el ajuste (o un Admin) puede cancelarlo.');
    }
    adjustments.update(adjustmentId, {
      Status: Config.ADJUSTMENT_STATUS.CANCELLED,
      'Resolved By ID': actingUserId,
      'Resolved At': new Date(),
      'Resolution Comment': reason || ''
    });
    TaskHistoryService.record(adjustment['Task ID'], Config.HISTORY_EVENTS.ADJUSTMENT_CANCELLED, actingUserId, reason || '', {
      adjustmentId: adjustmentId
    });
  }
};
