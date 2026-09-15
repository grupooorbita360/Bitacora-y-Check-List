/**
 * Api — únicas funciones que el cliente invoca (vía google.script.run en
 * producción, vía fetch en el dev server local — ver apps-script/devserver).
 * google.script.run solo puede llamar funciones globales, nunca métodos de
 * objeto, por eso cada una es un wrapper delgado sobre los Services ya
 * probados en Fase 2/3. Nunca contienen lógica de negocio propia.
 *
 * `token` es el token de sesión (solo existe para la vía SELECT_PIN de
 * Auth); en la vía DIRECT el cliente siempre manda null y el servidor
 * resuelve con Session.getActiveUser() (docs/01-modelo-datos.md → Auth).
 */

function _resolveActingUserId(token) {
  var user = AuthService.resolveCurrentUser(token);
  if (!user) throw new Error('Sesión inválida.');
  return user['User ID'];
}

// Apps Script serializa Date de forma inconsistente a través de
// google.script.run — se convierten a ISO string explícitamente para que
// el contrato con el cliente sea siempre el mismo (string o vacío).
function _toPlain(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(_toPlain);
  if (value && typeof value === 'object') {
    var out = {};
    Object.keys(value).forEach(function (key) {
      out[key] = _toPlain(value[key]);
    });
    return out;
  }
  return value;
}

// --- Auth --------------------------------------------------------------

function api_startLogin() {
  var email = Session.getActiveUser().getEmail();
  return _toPlain(AuthService.identify(email));
}

function api_loginWithPin(loginId, pin) {
  return AuthService.loginWithPin(loginId, pin);
}

function api_bootstrap(token) {
  var userId = _resolveActingUserId(token);
  return _toPlain({
    user: UserService.getWithRoles(userId),
    departments: DepartmentService.listActive()
  });
}

// --- Dashboard -----------------------------------------------------------

// Mismo criterio que la lista de Tasks (TaskPermissionService.canView, ya
// alineado con las 87 reglas reales de Task_Permissions): un Agent solo ve
// lo suyo (Owner/Participant/Shared, que es lo único que su rol puede ver
// de por sí); Supervisor/Manager/Director/Admin ven todo lo que su rol les
// permite ver — departamento (o más, para Director/Admin) — no solo lo que
// ellos mismos son Owner. Antes el Dashboard SIEMPRE filtraba por Owner
// sin importar el rol, así que un Manager/Admin veía únicamente sus
// propias Tasks en vez del panorama de su departamento.
function _hasBroadDashboardScope(userId) {
  if (PermissionService.isAdmin(userId)) return true;
  var roles = PermissionService.getRoles(userId);
  return (
    roles.indexOf(Config.ROLES.SUPERVISOR) !== -1 ||
    roles.indexOf(Config.ROLES.MANAGER) !== -1 ||
    roles.indexOf(Config.ROLES.DIRECTOR) !== -1
  );
}

function _dashboardScopeTasksForUser(userId) {
  var visible = new TasksRepository().findAll().filter(function (t) {
    return t.Active !== false && TaskPermissionService.canView(userId, t);
  });
  if (_hasBroadDashboardScope(userId)) {
    return { scope: 'DEPARTMENT', tasks: visible };
  }
  return {
    scope: 'OWN',
    tasks: visible.filter(function (t) {
      return String(t['Owner ID']) === String(userId);
    })
  };
}

// Compartida por api_getDashboard (conteo de "Vencidas") y el filtro
// overdueOnly de _visibleTasksForUser — clic en la tarjeta "Vencidas" del
// Dashboard debe llevar a Tasks mostrando exactamente lo que esa tarjeta
// contó, así que el criterio no puede vivir en dos lugares distintos.
var OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'WAITING'];

function _isOverdueTask(t, today) {
  return !!(t['Due Date'] && new Date(t['Due Date']) < today && OPEN_TASK_STATUSES.indexOf(t.Status) !== -1);
}

function api_getDashboard(token) {
  var userId = _resolveActingUserId(token);
  var scoped = _dashboardScopeTasksForUser(userId);
  var tasks = scoped.tasks;

  function countByStatus(status) {
    return tasks.filter(function (t) {
      return t.Status === status;
    }).length;
  }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var overdue = tasks.filter(function (t) {
    return _isOverdueTask(t, today);
  }).length;

  return _toPlain({
    scope: scoped.scope,
    myTasks: {
      pending: countByStatus('PENDING'),
      inProgress: countByStatus('IN_PROGRESS'),
      waiting: countByStatus('WAITING'),
      overdue: overdue
    },
    visibleTotal: tasks.length
  });
}

// --- Tasks ---------------------------------------------------------------

// Compartido por api_listTasks y api_getTasksVersion — la lista completa y
// su "versión" liviana deben coincidir en qué Tasks cuentan, o el polling
// podría no detectar que la lista visible cambió.
function _visibleTasksForUser(userId, filters) {
  filters = filters || {};
  var tasks = new TasksRepository().findAll().filter(function (t) {
    return t.Active !== false;
  });
  var visible = tasks.filter(function (t) {
    return TaskPermissionService.canView(userId, t);
  });
  if (filters.status) {
    visible = visible.filter(function (t) {
      return t.Status === filters.status;
    });
  }
  if (filters.priority) {
    visible = visible.filter(function (t) {
      return t.Priority === filters.priority;
    });
  }
  if (filters.mineOnly) {
    visible = visible.filter(function (t) {
      return String(t['Owner ID']) === String(userId);
    });
  }
  if (filters.overdueOnly) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    visible = visible.filter(function (t) {
      return _isOverdueTask(t, today);
    });
  }
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    visible = visible.filter(function (t) {
      return String(t['Task Title']).toLowerCase().indexOf(q) !== -1;
    });
  }
  return visible;
}

function api_listTasks(token, filters) {
  var userId = _resolveActingUserId(token);
  var visible = _visibleTasksForUser(userId, filters);
  visible.sort(function (a, b) {
    return new Date(b['Created At']) - new Date(a['Created At']);
  });
  return _toPlain(visible);
}

// Endpoint liviano para polling (cada 20s desde Client_Views.html): solo
// cuenta y calcula el Updated At más reciente entre las Tasks visibles con
// estos filtros, sin traer cada Task completa. El cliente solo vuelve a
// pedir la lista si esto cambió respecto a lo que ya tiene pintado.
function api_getTasksVersion(token, filters) {
  var userId = _resolveActingUserId(token);
  var visible = _visibleTasksForUser(userId, filters);
  var latestUpdatedAt = visible.reduce(function (max, t) {
    var updated = t['Updated At'] ? new Date(t['Updated At']).getTime() : 0;
    return updated > max ? updated : max;
  }, 0);
  return { count: visible.length, latestUpdatedAt: latestUpdatedAt };
}

function api_createTask(token, input) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskService.create(input, userId));
}

function api_getAllowedTaskTypes(token, departmentId) {
  var userId = _resolveActingUserId(token);
  return _toPlain(TaskConfigService.getAllowedTypes(userId, departmentId));
}

function api_listDepartments() {
  return _toPlain(DepartmentService.listActive());
}

// Compartido por api_listAssignableUsers y api_getTaskDetail — este último
// la incluye en su respuesta para que "Agregar Participante" pueda ofrecer
// un selector de nombres sin pedirle un segundo round-trip al cliente
// (antes ese campo era texto libre para el User ID a mano).
function _assignableUsersForDepartment(departmentId) {
  return new UsersRepository().findWhere(function (u) {
    return u.Activo !== false && String(u['Department ID']) === String(departmentId);
  });
}

function api_listAssignableUsers(token, departmentId) {
  _resolveActingUserId(token);
  return _toPlain(_assignableUsersForDepartment(departmentId));
}

// --- Task detail + acciones ------------------------------------------------

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
    assignableUsers: _assignableUsersForDepartment(task.Department)
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

// --- Checklist -------------------------------------------------------------

function api_listChecklist(token, departmentId) {
  _resolveActingUserId(token);
  return _toPlain(ChecklistService.listActive(departmentId));
}

function api_recordChecklistRun(token, checklistConfigId, resultado, valor, comentario) {
  var userId = _resolveActingUserId(token);
  return _toPlain(ChecklistService.recordRun(checklistConfigId, userId, resultado, valor, comentario));
}

function api_convertChecklistRunToTask(token, runId, overrides) {
  var userId = _resolveActingUserId(token);
  return _toPlain(ChecklistService.convertRunToTask(runId, userId, overrides));
}
