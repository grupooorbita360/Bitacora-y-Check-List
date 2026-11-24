/**
 * TaskService (Adjustments) — flujo de aprobación para reasignar/cambiar
 * depto (pedir/resolver/cancelar un ajuste). Extiende TaskService
 * (43_TaskService.js, que carga antes — ver su comentario de cabecera)
 * con Object.assign.
 */
Object.assign(TaskService, {
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
    // No hay evento de History para esto (ADJUSTMENT_CANCELLED no existe en
    // el Sheet real, ver docs/06-fase-3-decisiones.md) — la cancelación
    // queda completamente reflejada en Task_Adjustments (Status/Resolved *).
    return adjustments.update(adjustmentId, {
      Status: Config.ADJUSTMENT_STATUS.CANCELLED,
      'Resolved By ID': actingUserId,
      'Resolved At': new Date(),
      'Resolution Comment': reason || ''
    });
  }
});
