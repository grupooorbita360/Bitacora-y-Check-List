/**
 * Api (Tasks) — lista, filtros, pestañas, creación y usuarios asignables.
 * Ver la cabecera de 98_Api.js para la convención de este split.
 */

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
  // Pestañas de Tasks (sección 44 del prompt maestro — docs/12-tabs-tasks-logout.md):
  // cada tab es una capa de filtrado ADICIONAL sobre lo que canView ya
  // permitió ver arriba, nunca una ampliación de acceso.
  if (filters.tab === 'MINE') {
    visible = visible.filter(function (t) {
      return String(t['Owner ID']) === String(userId) && CLOSED_TASK_STATUSES.indexOf(t.Status) === -1;
    });
  } else if (filters.tab === 'TEAM') {
    // "Equipo"/"Departamento" — sin excluir al propio usuario: si es Owner
    // de alguna Task del equipo (poco común pero posible, ej. un Manager
    // que convirtió un Checklist con problema a su propio nombre) debe
    // seguir viéndola en el desglose por persona, no perderla. Sí excluye
    // Visibility Supervisión/Management (van agrupadas en sus propias
    // pestañas, no mezcladas aquí — el mismo criterio que ya usa
    // _dashboardScopeTasksForUser para que la tarjeta del Dashboard y esta
    // pestaña siempre cuenten exactamente lo mismo).
    visible = visible.filter(function (t) {
      return !_isSupervisionOrManagementVisibility(t) && CLOSED_TASK_STATUSES.indexOf(t.Status) === -1;
    });
  } else if (filters.tab === 'WAITING') {
    visible = visible.filter(function (t) {
      return t.Status === 'WAITING';
    });
  } else if (filters.tab === 'DONE') {
    visible = visible.filter(function (t) {
      return CLOSED_TASK_STATUSES.indexOf(t.Status) !== -1;
    });
  } else if (filters.tab === 'SUPERVISION') {
    visible = visible.filter(function (t) {
      return t.Visibility === Config.TASK_VISIBILITY.SUPERVISION;
    });
  } else if (filters.tab === 'MANAGEMENT') {
    visible = visible.filter(function (t) {
      return t.Visibility === Config.TASK_VISIBILITY.MANAGEMENT;
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

// Subconjunto de _assignableUsersForDepartment cuyo rol alcanza la
// Visibility de UNA Task concreta (docs/15-visibility-assignment-gaps.md)
// — para los selectores de "nuevo Owner"/"nuevo Participant", que no deben
// ni ofrecer a alguien que TaskService rechazaría de todos modos al
// reasignar/agregar. Nunca la fuente de verdad (esa sigue siendo
// TaskPermissionService.canReceiveAssignment en el momento de la acción);
// esto es solo para que el selector no ofrezca una opción condenada a fallar.
function _eligibleAssigneesForTask(departmentId, task) {
  return _assignableUsersForDepartment(departmentId).filter(function (u) {
    return TaskPermissionService.canReceiveAssignment(u['User ID'], task);
  });
}

// taskId es opcional — lo pasan Reassign/TakeOwnership (sí hay una Task
// concreta contra la que filtrar); Nueva Task y Reasignar en bloque lo
// omiten (sin Task todavía, o con varias de Visibility potencialmente
// distinta — ver docs/15-visibility-assignment-gaps.md para por qué bulk
// reassign no intenta pre-filtrar el selector y en cambio reporta el
// rechazo Task por Task, igual que ya hacía con Task_Assignment_Config).
function api_listAssignableUsers(token, departmentId, taskId) {
  var userId = _resolveActingUserId(token);
  if (taskId) {
    var task = new TasksRepository().findById(taskId);
    if (task && TaskPermissionService.canView(userId, task)) {
      return _toPlain(_eligibleAssigneesForTask(departmentId, task));
    }
  }
  return _toPlain(_assignableUsersForDepartment(departmentId));
}
