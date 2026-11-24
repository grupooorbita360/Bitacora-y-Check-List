/**
 * TaskService (Ownership/Reassignment) — tomar ownership, reasignar
 * (individual y en bloque). Extiende TaskService (43_TaskService.js, que
 * carga antes — ver su comentario de cabecera) con Object.assign.
 */
Object.assign(TaskService, {
  takeOwnership: function (taskId, newOwnerId, actingUserId) {
    var tasks = new TasksRepository();
    var task = tasks.findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, Config.TASK_ACTIONS.TAKE_OWNERSHIP, task)) {
      throw new Error('No tienes permiso para tomar ownership de esta Task.');
    }
    var newOwner = new UsersRepository().findById(newOwnerId);
    if (!newOwner) throw new Error('El nuevo Owner no existe.');
    if (!TaskAssignmentService.canAssignTo(actingUserId, newOwnerId, TaskAssignmentService.ACTION_RULES.TAKE_OWNERSHIP)) {
      throw new Error('El rol de "' + newOwner.Nombre + '" no puede tomar ownership según Task_Assignment_Config.');
    }
    if (!TaskPermissionService.canReceiveAssignment(newOwnerId, task)) {
      throw new Error('El rol de "' + newOwner.Nombre + '" no alcanza la Visibility de esta Task (' + task.Visibility + ').');
    }

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
    return this._applyReassign(
      taskId,
      newOwnerId,
      actingUserId,
      comment,
      Config.TASK_ACTIONS.REASSIGN,
      TaskAssignmentService.ACTION_RULES.ASSIGN_REASSIGN
    );
  },

  // BULK_REASSIGN es una acción, nunca un Task Type (sección 35/decisión
  // cerrada Fase 1). Es una acción y una regla propias en los datos reales
  // (Task_Permissions/Task_Assignment_Config), distinta de REASSIGN: un
  // Supervisor puede tener BULK_REASSIGN limitado a su departamento aunque
  // REASSIGN individual le alcance cross-department (ver TP087 vs TP048-49).
  // Reasigna lo que pueda y reporta el resto como error por Task, en vez de
  // abortar todo el lote.
  bulkReassign: function (taskIds, newOwnerId, actingUserId, comment) {
    if (!TaskPermissionService.canBulkReassign(actingUserId)) {
      throw new Error('No tienes permiso para reasignar en bloque.');
    }
    var newOwner = new UsersRepository().findById(newOwnerId);
    if (!newOwner) throw new Error('El nuevo Owner no existe.');
    if (!TaskAssignmentService.canAssignTo(actingUserId, newOwnerId, TaskAssignmentService.ACTION_RULES.BULK_REASSIGN)) {
      throw new Error('El rol de "' + newOwner.Nombre + '" no puede recibir Tasks por bulk reassign según Task_Assignment_Config.');
    }

    var self = this;
    return taskIds.map(function (taskId) {
      try {
        self._applyReassign(taskId, newOwnerId, actingUserId, comment, Config.TASK_ACTIONS.BULK_REASSIGN, null);
        return { taskId: taskId, ok: true };
      } catch (e) {
        return { taskId: taskId, ok: false, error: e.message };
      }
    });
  },

  // assignmentActionRule en null omite la validación de Task_Assignment_Config
  // (bulkReassign ya la valida una sola vez para todo el lote, arriba). El
  // chequeo de Visibility (canReceiveAssignment) sí va Task por Task acá
  // dentro — a diferencia de Task_Assignment_Config, la Visibility puede
  // ser distinta en cada Task del lote, así que bulkReassign no puede
  // validarla una sola vez para todo el batch; cae en el try/catch por
  // Task que bulkReassign ya tiene, reportando el error solo para esa Task.
  _applyReassign: function (taskId, newOwnerId, actingUserId, comment, permissionAction, assignmentActionRule) {
    var tasks = new TasksRepository();
    var task = tasks.findById(taskId);
    if (!task) throw new Error('Task no encontrada.');
    if (!TaskPermissionService.can(actingUserId, permissionAction, task)) {
      throw new Error('No tienes permiso para reasignar directamente; usa requestAdjustment().');
    }
    var newOwner = new UsersRepository().findById(newOwnerId);
    if (!newOwner) throw new Error('El nuevo Owner no existe.');
    if (assignmentActionRule && !TaskAssignmentService.canAssignTo(actingUserId, newOwnerId, assignmentActionRule)) {
      throw new Error('El rol de "' + newOwner.Nombre + '" no puede ser el nuevo Owner según Task_Assignment_Config.');
    }
    if (!TaskPermissionService.canReceiveAssignment(newOwnerId, task)) {
      throw new Error('El rol de "' + newOwner.Nombre + '" no alcanza la Visibility de esta Task (' + task.Visibility + ').');
    }

    var updated = tasks.update(taskId, {
      'Owner ID': newOwner['User ID'],
      Owner: newOwner.Nombre,
      'Updated At': new Date()
    });
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.REASSIGNED, actingUserId, comment || '', {
      newOwnerId: newOwnerId
    });
    return updated;
  }
});
