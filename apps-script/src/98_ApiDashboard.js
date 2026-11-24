/**
 * Api (Dashboard) — api_getDashboard y los helpers de alcance por rol
 * (docs/11-participantes-dashboard-checklist.md). Ver la cabecera de
 * 98_Api.js para la convención de este split.
 */

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
    // Se excluyen las Tasks con Visibility Supervisión/Management del
    // panorama general — igual que hace la pestaña "Equipo"/"Departamento"
    // de Tasks (docs/12-tabs-tasks-logout.md) — para que el número de cada
    // tarjeta y lo que aparece al hacer clic en ella siempre coincidan.
    // Esas Tasks tienen su propio conteo implícito en la pestaña
    // "Supervisión"/"Management" en vez de mezclarse en los conteos
    // genéricos de Pendientes/En Progreso/En Espera/Vencidas.
    return {
      scope: 'DEPARTMENT',
      tasks: visible.filter(function (t) {
        return !_isSupervisionOrManagementVisibility(t);
      })
    };
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
var CLOSED_TASK_STATUSES = ['COMPLETED', 'CANCELLED'];

function _isOverdueTask(t, today) {
  return !!(t['Due Date'] && new Date(t['Due Date']) < today && OPEN_TASK_STATUSES.indexOf(t.Status) !== -1);
}

// Visibility (OPERATIONAL/SUPERVISION/MANAGEMENT/RESTRICTED, ver
// docs/02-reglas-negocio.md) todavía no está enforced dentro de
// TaskPermissionService.canView — solo Operational Scope lo está, vía las
// filas reales de Task_Permissions. Este helper NO es un control de
// acceso: es un filtro de presentación para las pestañas "Supervisión"/
// "Management" de Tasks (docs/12-tabs-tasks-logout.md), que solo reordena
// lo que canView ya permitió ver — nunca amplía el acceso.
function _isSupervisionOrManagementVisibility(t) {
  return t.Visibility === Config.TASK_VISIBILITY.SUPERVISION || t.Visibility === Config.TASK_VISIBILITY.MANAGEMENT;
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
