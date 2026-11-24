/**
 * Api (Task detail + acciones) — detalle completo, versión liviana para
 * polling, botones disponibles (progressive disclosure) y el resto de
 * las acciones de lifecycle/ownership/comments/participants/subtasks/
 * adjustments. Ver la cabecera de 98_Api.js para la convención de este
 * split.
 */

function api_getTaskDetail(token, taskId) {
  var userId = _resolveActingUserId(token);
  var task = TaskService.get(taskId, userId);
  if (!task) throw new Error('Task no encontrada.');
  return _toPlain({
    task: task,
    history: TaskService.getHistory(taskId),
    subtasks: new TaskSubtasksRepository().findByTask(taskId),
    participants: new TaskParticipantsRepository().findByTask(taskId),
    pendingAdjustments: new TaskAdjustmentsRepository().findPendingByTask(taskId),
    availableActions: _computeAvailableActions(userId, task),
    // assignableUsers: todo el departamento, sin filtrar — lo sigue usando
    // sectionParticipants (Client_Views.html) para resolver el nombre de
    // participantes YA agregados, incluso uno que no alcance (ej. se
    // agregó antes de este chequeo, o la Task cambió de Visibility
    // después). eligibleAssignees: subconjunto filtrado por
    // canReceiveAssignment — el que sí debe ofrecerse para agregar.
    assignableUsers: _assignableUsersForDepartment(task.Department),
    eligibleAssignees: _eligibleAssigneesForTask(task.Department, task)
  });
}

// Endpoint liviano para polling del Task Detail (cada 20s): un puñado de
// números en vez de repetir todo lo que arma api_getTaskDetail (history,
// subtasks, participants, adjustments, availableActions). El cliente solo
// vuelve a pedir el detalle completo si esto cambió — ver
// computeTaskVersionFromDetail() en Client_Views.html, que calcula lo
// mismo a partir del detalle ya cargado para tener la línea base sin un
// viaje de red extra.
function api_getTaskVersion(token, taskId) {
  var userId = _resolveActingUserId(token);
  var task = new TasksRepository().findById(taskId);
  if (!task || !TaskPermissionService.canView(userId, task)) return null;
  return {
    updatedAt: task['Updated At'] ? new Date(task['Updated At']).getTime() : 0,
    historyCount: new TaskHistoryRepository().findByTask(taskId).length,
    subtasksCount: new TaskSubtasksRepository().findByTask(taskId).length,
    participantsCount: new TaskParticipantsRepository().findByTask(taskId).length,
    pendingAdjustmentsCount: new TaskAdjustmentsRepository().findPendingByTask(taskId).length
  };
}

// El servidor decide qué botones tienen sentido mostrar (progressive
// disclosure) — el cliente solo renderiza, y cada acción se re-valida en
// backend igual al invocarse (docs/00-arquitectura-general.md).
function _computeAvailableActions(userId, task) {
  var A = Config.TASK_ACTIONS;
  var lifecycleActions = [A.OPEN, A.COMPLETE, A.SNOOZE, A.RESUME, A.CANCEL, A.REOPEN];
  var allowed = {};

  lifecycleActions.forEach(function (action) {
    var permitted = TaskPermissionService.can(userId, action, task);
    var hasTransition = !!new TaskStatusTransitionsRepository().findTransition(task.Status, action);
    allowed[action] = permitted && hasTransition;
  });

  [A.REASSIGN, A.TAKE_OWNERSHIP, A.ADD_COMMENT, A.ADD_PARTICIPANT, A.REMOVE_PARTICIPANT, A.CREATE_SUBTASK].forEach(
    function (action) {
      allowed[action] = TaskPermissionService.can(userId, action, task);
    }
  );

  allowed[A.REQUEST_ADJUSTMENT] = true; // cualquiera con VIEW puede pedir un ajuste; se valida igual en backend.
  allowed[A.APPROVE_ADJUSTMENT] = TaskPermissionService.can(userId, A.APPROVE_ADJUSTMENT, task);
  return allowed;
}

function api_transitionTask(token, taskId, action, opts) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.transition(taskId, action, userId, opts));
}

function api_takeOwnership(token, taskId, newOwnerId) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.takeOwnership(taskId, newOwnerId, userId));
}

function api_reassignTask(token, taskId, newOwnerId, comment) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.reassign(taskId, newOwnerId, userId, comment));
}

function api_canBulkReassign(token) {
  var userId = _resolveActingUserId(token);
  return TaskPermissionService.canBulkReassign(userId);
}

function api_bulkReassign(token, taskIds, newOwnerId, comment) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.bulkReassign(taskIds, newOwnerId, userId, comment));
}

function api_addComment(token, taskId, text) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.addComment(taskId, userId, text));
}

function api_addParticipant(token, taskId, userIdToAdd, roleInTask) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.addParticipant(taskId, userIdToAdd, userId, roleInTask));
}

function api_removeParticipant(token, taskId, userIdToRemove) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.removeParticipant(taskId, userIdToRemove, userId));
}

function api_addSubtask(token, taskId, title) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.addSubtask(taskId, title, userId));
}

function api_completeSubtask(token, subtaskId) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.completeSubtask(subtaskId, userId));
}

function api_requestAdjustment(token, taskId, type, details) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.requestAdjustment(taskId, type, userId, details));
}

function api_resolveAdjustment(token, adjustmentId, decision, comment) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.resolveAdjustment(adjustmentId, decision, userId, comment));
}

function api_cancelAdjustment(token, adjustmentId, reason) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.cancelAdjustment(adjustmentId, userId, reason));
}
