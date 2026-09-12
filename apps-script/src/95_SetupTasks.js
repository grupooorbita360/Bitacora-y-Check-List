/**
 * Crea/siembra las hojas de Tasks y Checklist (Fase 3). Se llama desde
 * bootstrapTestEnvironment() (90_Setup.js) — no hace falta correrla aparte.
 *
 * Task_Status_Config y Task_Status_Transitions se siembran con los valores
 * EXACTOS de la sección 12-13 del prompt maestro. Task_Config usa el
 * catálogo ya corregido en docs/01-modelo-datos.md (sin "Reasignación").
 * Task_Permissions (87 filas) y Task_Assignment_Config (19 filas) se
 * siembran con los datos reales confirmados por Eduardo — ver
 * docs/06-fase-3-decisiones.md.
 */
function _ensureTaskAndChecklistTables(ss) {
  _ensureSheet(ss, Config.SHEET_TABS.TASKS, [
    'Task ID', 'Task Title', 'Description', 'Type', 'Department', 'Created By ID',
    'Created By', 'Owner ID', 'Owner', 'Priority', 'Due Date', 'Review Date', 'Status',
    'Visibility', 'Operational Scope', 'Reference Type', 'Reference ID', 'Origin Department',
    'System Origin', 'Source Record ID', 'Created At', 'Updated At', 'Completed At',
    'Cancelled At', 'Cancelled By ID', 'Cancellation Reason', 'Active'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.TASK_HISTORY, [
    'History ID', 'Task ID', 'Event Type', 'Performed By ID', 'Performed By', 'Comment', 'Details', 'Created At'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.TASK_SUBTASKS, [
    'Subtask ID', 'Task ID', 'Title', 'Status', 'Created By ID', 'Created At', 'Completed At', 'Activo'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.TASK_ADJUSTMENTS, [
    'Adjustment ID', 'Task ID', 'Type', 'Requested By ID', 'Requested At', 'New Owner ID',
    'New Department ID', 'Reason', 'Status', 'Resolved By ID', 'Resolved At', 'Resolution Comment'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.TASK_PARTICIPANTS, [
    'Participant ID', 'Task ID', 'User ID', 'Role in Task', 'Added By ID', 'Added At', 'Activo'
  ]);
  var statusConfigSheet = _ensureSheet(ss, Config.SHEET_TABS.TASK_STATUS_CONFIG, ['ID', 'Status', 'Nombre', 'Activo', 'Orden']);
  var transitionsSheet = _ensureSheet(ss, Config.SHEET_TABS.TASK_STATUS_TRANSITIONS, [
    'ID', 'From Status', 'To Status', 'Action', 'Requires Comment', 'Requires Review Date'
  ]);
  var taskConfigSheet = _ensureSheet(ss, Config.SHEET_TABS.TASK_CONFIG, ['ID', 'Departamento', 'Rol', 'Task Type', 'Activo', 'Orden']);
  var taskPermissionsSheet = _ensureSheet(ss, Config.SHEET_TABS.TASK_PERMISSIONS, [
    'ID', 'Departamento', 'Rol', 'Accion', 'Alcance', 'Activo'
  ]);
  var taskAssignmentConfigSheet = _ensureSheet(ss, Config.SHEET_TABS.TASK_ASSIGNMENT_CONFIG, [
    'ID', 'Accion_Regla', 'Rol_Origen', 'Alcance', 'Rol_Destino', 'Mismo_Departamento', 'Requiere_Aprobacion', 'Activo'
  ]);
  var checklistConfigSheet = _ensureSheet(ss, Config.SHEET_TABS.CHECKLIST_CONFIG, [
    'ID', 'Departamento', 'Actividad', 'Tipo', 'Ayuda', 'Prioridad', 'Frecuencia', 'SUPs requeridos', 'Activo', 'Orden'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.CHECKLIST_RUNS, [
    'Run ID', 'Checklist Config ID', 'Departamento', 'Fecha', 'Ejecutado Por ID', 'Resultado', 'Valor', 'Comentario', 'Created At'
  ]);

  if (statusConfigSheet.getLastRow() < 2) _seedTaskStatusConfig();
  if (transitionsSheet.getLastRow() < 2) _seedTaskStatusTransitions();
  if (taskConfigSheet.getLastRow() < 2) _seedTaskConfig();
  if (taskPermissionsSheet.getLastRow() < 2) _seedTaskPermissionsReal();
  if (taskAssignmentConfigSheet.getLastRow() < 2) _seedTaskAssignmentConfigReal();
  if (checklistConfigSheet.getLastRow() < 2) _seedChecklistConfigExamples();
}

function _seedTaskStatusConfig() {
  var repo = new TaskStatusConfigRepository();
  var S = Config.TASK_STATUS;
  [
    { ID: 'TS01', Status: S.PENDING, Nombre: 'Pendiente', Orden: 1 },
    { ID: 'TS02', Status: S.IN_PROGRESS, Nombre: 'En Progreso', Orden: 2 },
    { ID: 'TS03', Status: S.WAITING, Nombre: 'En Espera', Orden: 3 },
    { ID: 'TS04', Status: S.COMPLETED, Nombre: 'Completada', Orden: 4 },
    { ID: 'TS05', Status: S.CANCELLED, Nombre: 'Cancelada', Orden: 5 }
  ].forEach(function (row) {
    repo.create(Object.assign({ Activo: true }, row));
  });
}

function _seedTaskStatusTransitions() {
  var repo = new TaskStatusTransitionsRepository();
  var S = Config.TASK_STATUS;
  var A = Config.TASK_ACTIONS;
  [
    { ID: 'ST01', from: S.PENDING, to: S.IN_PROGRESS, action: A.OPEN, comment: false, reviewDate: false },
    { ID: 'ST02', from: S.IN_PROGRESS, to: S.COMPLETED, action: A.COMPLETE, comment: true, reviewDate: false },
    { ID: 'ST03', from: S.IN_PROGRESS, to: S.WAITING, action: A.SNOOZE, comment: true, reviewDate: true },
    { ID: 'ST04', from: S.WAITING, to: S.IN_PROGRESS, action: A.RESUME, comment: false, reviewDate: false },
    { ID: 'ST05', from: S.WAITING, to: S.COMPLETED, action: A.COMPLETE, comment: true, reviewDate: false },
    { ID: 'ST06', from: S.PENDING, to: S.CANCELLED, action: A.CANCEL, comment: true, reviewDate: false },
    { ID: 'ST07', from: S.IN_PROGRESS, to: S.CANCELLED, action: A.CANCEL, comment: true, reviewDate: false },
    { ID: 'ST08', from: S.WAITING, to: S.CANCELLED, action: A.CANCEL, comment: true, reviewDate: false },
    { ID: 'ST09', from: S.COMPLETED, to: S.PENDING, action: A.REOPEN, comment: true, reviewDate: false },
    { ID: 'ST10', from: S.CANCELLED, to: S.PENDING, action: A.REOPEN, comment: true, reviewDate: false }
  ].forEach(function (row) {
    repo.create({
      ID: row.ID,
      'From Status': row.from,
      'To Status': row.to,
      Action: row.action,
      'Requires Comment': row.comment,
      'Requires Review Date': row.reviewDate
    });
  });
}

// Catálogo ya corregido en docs/01-modelo-datos.md (sin "Reasignación").
// Data de ejemplo por rol, ajustable libremente — no bloquea Fase 3.
function _seedTaskConfig() {
  var repo = new TaskConfigRepository();
  var G = Config.RESERVED_SCOPE_GLOBAL;
  var D = 'DEP001';
  var R = Config.ROLES;
  [
    { ID: 'TC01', dept: G, rol: R.DIRECTOR, tipo: 'Desarrollo', orden: 1 },
    { ID: 'TC02', dept: G, rol: R.DIRECTOR, tipo: 'Gestión', orden: 2 },
    { ID: 'TC03', dept: G, rol: R.DIRECTOR, tipo: 'Seguimiento', orden: 3 },
    { ID: 'TC04', dept: G, rol: R.DIRECTOR, tipo: 'Operativo', orden: 4 },
    { ID: 'TC05', dept: G, rol: R.DIRECTOR, tipo: 'Otro', orden: 5 },
    { ID: 'TC06', dept: D, rol: R.MANAGER, tipo: 'Desarrollo', orden: 1 },
    { ID: 'TC07', dept: D, rol: R.MANAGER, tipo: 'Gestión', orden: 2 },
    { ID: 'TC08', dept: D, rol: R.MANAGER, tipo: 'Seguimiento', orden: 3 },
    { ID: 'TC09', dept: D, rol: R.MANAGER, tipo: 'Operativo', orden: 4 },
    { ID: 'TC10', dept: D, rol: R.MANAGER, tipo: 'Otro', orden: 5 },
    { ID: 'TC11', dept: D, rol: R.SUPERVISOR, tipo: 'Operativo', orden: 1 },
    { ID: 'TC12', dept: D, rol: R.SUPERVISOR, tipo: 'Caso Escalado', orden: 2 },
    { ID: 'TC13', dept: D, rol: R.SUPERVISOR, tipo: 'Seguimiento', orden: 3 },
    { ID: 'TC14', dept: D, rol: R.SUPERVISOR, tipo: 'Gestión', orden: 4 },
    { ID: 'TC15', dept: D, rol: R.SUPERVISOR, tipo: 'Otro', orden: 5 },
    { ID: 'TC16', dept: D, rol: R.AGENT, tipo: 'Caso', orden: 1 },
    { ID: 'TC17', dept: D, rol: R.AGENT, tipo: 'Seguimiento', orden: 2 },
    { ID: 'TC18', dept: D, rol: R.AGENT, tipo: 'Operativo', orden: 3 },
    { ID: 'TC19', dept: D, rol: R.AGENT, tipo: 'Otro', orden: 4 }
  ].forEach(function (row) {
    repo.create({ ID: row.ID, Departamento: row.dept, Rol: row.rol, 'Task Type': row.tipo, Activo: true, Orden: row.orden });
  });
}

// Task_Permissions REAL (87 filas, TP001-TP087) — confirmadas exactas por
// Eduardo contra NEW_Bitacora.xlsx. Todas Departamento=GLOBAL.
function _seedTaskPermissionsReal() {
  var repo = new TaskPermissionsRepository();
  var G = Config.RESERVED_SCOPE_GLOBAL;
  var R = Config.ROLES;
  [
    ['TP001', R.DIRECTOR, 'VIEW', 'ALL'], ['TP002', R.DIRECTOR, 'CREATE', 'ALL'],
    ['TP003', R.DIRECTOR, 'EDIT', 'ALL'], ['TP004', R.DIRECTOR, 'ASSIGN', 'ALL'],
    ['TP005', R.DIRECTOR, 'REASSIGN', 'ALL'], ['TP006', R.DIRECTOR, 'TAKE_OWNERSHIP', 'ALL'],
    ['TP007', R.DIRECTOR, 'COMPLETE', 'ALL'], ['TP008', R.DIRECTOR, 'SNOOZE', 'ALL'],
    ['TP009', R.DIRECTOR, 'REOPEN', 'ALL'], ['TP010', R.DIRECTOR, 'REQUEST_ADJUSTMENT', 'ALL'],
    ['TP011', R.DIRECTOR, 'APPROVE_ADJUSTMENT', 'ALL'], ['TP012', R.DIRECTOR, 'CANCEL', 'ALL'],
    ['TP013', R.DIRECTOR, 'ADD_PARTICIPANT', 'ALL'], ['TP014', R.DIRECTOR, 'REMOVE_PARTICIPANT', 'ALL'],
    ['TP015', R.DIRECTOR, 'ADD_COMMENT', 'ALL'], ['TP016', R.DIRECTOR, 'VIEW_HISTORY', 'ALL'],
    ['TP017', R.DIRECTOR, 'VIEW_SUBTASKS', 'ALL'], ['TP018', R.DIRECTOR, 'CREATE_SUBTASK', 'ALL'],

    ['TP019', R.MANAGER, 'VIEW', 'DEPARTMENT'], ['TP020', R.MANAGER, 'VIEW', 'CROSS_DEPARTMENT'],
    ['TP021', R.MANAGER, 'CREATE', 'DEPARTMENT'], ['TP022', R.MANAGER, 'EDIT', 'DEPARTMENT'],
    ['TP023', R.MANAGER, 'ASSIGN', 'DEPARTMENT'], ['TP024', R.MANAGER, 'ASSIGN', 'CROSS_DEPARTMENT'],
    ['TP025', R.MANAGER, 'REASSIGN', 'DEPARTMENT'], ['TP026', R.MANAGER, 'REASSIGN', 'CROSS_DEPARTMENT'],
    ['TP027', R.MANAGER, 'TAKE_OWNERSHIP', 'SHARED'], ['TP028', R.MANAGER, 'COMPLETE', 'DEPARTMENT'],
    ['TP029', R.MANAGER, 'SNOOZE', 'DEPARTMENT'], ['TP030', R.MANAGER, 'REOPEN', 'DEPARTMENT'],
    ['TP031', R.MANAGER, 'REQUEST_ADJUSTMENT', 'DEPARTMENT'], ['TP032', R.MANAGER, 'APPROVE_ADJUSTMENT', 'DEPARTMENT'],
    ['TP033', R.MANAGER, 'CANCEL', 'DEPARTMENT'], ['TP034', R.MANAGER, 'ADD_PARTICIPANT', 'DEPARTMENT'],
    ['TP035', R.MANAGER, 'REMOVE_PARTICIPANT', 'DEPARTMENT'], ['TP036', R.MANAGER, 'ADD_COMMENT', 'DEPARTMENT'],
    ['TP037', R.MANAGER, 'VIEW_HISTORY', 'DEPARTMENT'], ['TP038', R.MANAGER, 'VIEW_HISTORY', 'CROSS_DEPARTMENT'],
    ['TP039', R.MANAGER, 'VIEW_SUBTASKS', 'DEPARTMENT'], ['TP040', R.MANAGER, 'CREATE_SUBTASK', 'DEPARTMENT'],

    ['TP041', R.SUPERVISOR, 'VIEW', 'DEPARTMENT'], ['TP042', R.SUPERVISOR, 'VIEW', 'CROSS_DEPARTMENT'],
    ['TP043', R.SUPERVISOR, 'CREATE', 'OWN'], ['TP044', R.SUPERVISOR, 'EDIT', 'OWN'],
    ['TP045', R.SUPERVISOR, 'EDIT', 'PARTICIPANT'], ['TP046', R.SUPERVISOR, 'ASSIGN', 'DEPARTMENT'],
    ['TP047', R.SUPERVISOR, 'ASSIGN', 'CROSS_DEPARTMENT'], ['TP048', R.SUPERVISOR, 'REASSIGN', 'DEPARTMENT'],
    ['TP049', R.SUPERVISOR, 'REASSIGN', 'CROSS_DEPARTMENT'], ['TP050', R.SUPERVISOR, 'TAKE_OWNERSHIP', 'SHARED'],
    ['TP051', R.SUPERVISOR, 'COMPLETE', 'DEPARTMENT'], ['TP052', R.SUPERVISOR, 'SNOOZE', 'DEPARTMENT'],
    ['TP053', R.SUPERVISOR, 'REOPEN', 'DEPARTMENT'], ['TP054', R.SUPERVISOR, 'REQUEST_ADJUSTMENT', 'OWN'],
    ['TP055', R.SUPERVISOR, 'APPROVE_ADJUSTMENT', 'DEPARTMENT'], ['TP056', R.SUPERVISOR, 'APPROVE_ADJUSTMENT', 'CROSS_DEPARTMENT'],
    ['TP057', R.SUPERVISOR, 'CANCEL', 'DEPARTMENT'], ['TP058', R.SUPERVISOR, 'ADD_PARTICIPANT', 'DEPARTMENT'],
    ['TP059', R.SUPERVISOR, 'ADD_PARTICIPANT', 'CROSS_DEPARTMENT'], ['TP060', R.SUPERVISOR, 'REMOVE_PARTICIPANT', 'DEPARTMENT'],
    ['TP061', R.SUPERVISOR, 'REMOVE_PARTICIPANT', 'CROSS_DEPARTMENT'], ['TP062', R.SUPERVISOR, 'ADD_COMMENT', 'DEPARTMENT'],
    ['TP063', R.SUPERVISOR, 'ADD_COMMENT', 'CROSS_DEPARTMENT'], ['TP064', R.SUPERVISOR, 'VIEW_HISTORY', 'DEPARTMENT'],
    ['TP065', R.SUPERVISOR, 'VIEW_HISTORY', 'CROSS_DEPARTMENT'], ['TP066', R.SUPERVISOR, 'VIEW_SUBTASKS', 'DEPARTMENT'],
    ['TP067', R.SUPERVISOR, 'CREATE_SUBTASK', 'OWN'], ['TP068', R.SUPERVISOR, 'CREATE_SUBTASK', 'PARTICIPANT'],

    ['TP069', R.AGENT, 'VIEW', 'OWN'], ['TP070', R.AGENT, 'VIEW', 'PARTICIPANT'],
    ['TP071', R.AGENT, 'VIEW', 'SHARED'], ['TP072', R.AGENT, 'CREATE', 'OWN'],
    ['TP073', R.AGENT, 'EDIT', 'OWN'], ['TP074', R.AGENT, 'COMPLETE', 'OWN'],
    ['TP075', R.AGENT, 'SNOOZE', 'OWN'], ['TP076', R.AGENT, 'REQUEST_ADJUSTMENT', 'OWN'],
    ['TP077', R.AGENT, 'ADD_COMMENT', 'OWN'], ['TP078', R.AGENT, 'ADD_COMMENT', 'PARTICIPANT'],
    ['TP079', R.AGENT, 'VIEW_HISTORY', 'OWN'], ['TP080', R.AGENT, 'VIEW_HISTORY', 'PARTICIPANT'],
    ['TP081', R.AGENT, 'VIEW_HISTORY', 'SHARED'], ['TP082', R.AGENT, 'VIEW_SUBTASKS', 'OWN'],
    ['TP083', R.AGENT, 'CREATE_SUBTASK', 'OWN'], ['TP084', R.AGENT, 'TAKE_OWNERSHIP', 'SHARED'],

    ['TP085', R.DIRECTOR, 'BULK_REASSIGN', 'ALL'], ['TP086', R.MANAGER, 'BULK_REASSIGN', 'DEPARTMENT'],
    ['TP087', R.SUPERVISOR, 'BULK_REASSIGN', 'DEPARTMENT']
  ].forEach(function (row) {
    repo.create({ ID: row[0], Departamento: G, Rol: row[1], Accion: row[2], Alcance: row[3], Activo: true });
  });
}

// Task_Assignment_Config REAL (19 filas, TA01-TA19) — confirmadas exactas
// por Eduardo. Requiere_Aprobacion es NO en las 19 (se lee, no cambia el
// flujo hoy — ver docs/06-fase-3-decisiones.md).
function _seedTaskAssignmentConfigReal() {
  var repo = new TaskAssignmentConfigRepository();
  var R = Config.ROLES;
  var AR = TaskAssignmentService.ACTION_RULES;
  [
    ['TA01', AR.ASSIGN_REASSIGN, R.DIRECTOR, 'ALL', R.DIRECTOR, false],
    ['TA02', AR.ASSIGN_REASSIGN, R.DIRECTOR, 'ALL', R.MANAGER, false],
    ['TA03', AR.ASSIGN_REASSIGN, R.DIRECTOR, 'ALL', R.SUPERVISOR, false],
    ['TA04', AR.ASSIGN_REASSIGN, R.DIRECTOR, 'ALL', R.AGENT, false],
    ['TA05', AR.ASSIGN_REASSIGN, R.MANAGER, 'DEPARTMENT', R.SUPERVISOR, true],
    ['TA06', AR.ASSIGN_REASSIGN, R.MANAGER, 'DEPARTMENT', R.AGENT, true],
    ['TA07', AR.ASSIGN_REASSIGN, R.SUPERVISOR, 'DEPARTMENT', R.SUPERVISOR, true],
    ['TA08', AR.ASSIGN_REASSIGN, R.SUPERVISOR, 'DEPARTMENT', R.AGENT, true],
    ['TA09', AR.TAKE_OWNERSHIP, R.AGENT, 'SHARED', R.AGENT, true],
    ['TA10', AR.TAKE_OWNERSHIP, R.SUPERVISOR, 'SHARED', R.SUPERVISOR, true],
    ['TA11', AR.TAKE_OWNERSHIP, R.SUPERVISOR, 'SHARED', R.AGENT, true],
    ['TA12', AR.BULK_REASSIGN, R.DIRECTOR, 'ALL', R.DIRECTOR, false],
    ['TA13', AR.BULK_REASSIGN, R.DIRECTOR, 'ALL', R.MANAGER, false],
    ['TA14', AR.BULK_REASSIGN, R.DIRECTOR, 'ALL', R.SUPERVISOR, false],
    ['TA15', AR.BULK_REASSIGN, R.DIRECTOR, 'ALL', R.AGENT, false],
    ['TA16', AR.BULK_REASSIGN, R.MANAGER, 'DEPARTMENT', R.SUPERVISOR, true],
    ['TA17', AR.BULK_REASSIGN, R.MANAGER, 'DEPARTMENT', R.AGENT, true],
    ['TA18', AR.BULK_REASSIGN, R.SUPERVISOR, 'DEPARTMENT', R.SUPERVISOR, true],
    ['TA19', AR.BULK_REASSIGN, R.SUPERVISOR, 'DEPARTMENT', R.AGENT, true]
  ].forEach(function (row) {
    repo.create({
      ID: row[0],
      Accion_Regla: row[1],
      Rol_Origen: row[2],
      Alcance: row[3],
      Rol_Destino: row[4],
      Mismo_Departamento: row[5],
      Requiere_Aprobacion: false,
      Activo: true
    });
  });
}

// DATA DE PRUEBA — actividades inventadas a modo de ejemplo (igual que el
// resto de la data de Fase 1/2), reemplazar por las reales de Executive
// Services antes de copiar a producción.
function _seedChecklistConfigExamples() {
  var repo = new ChecklistConfigRepository();
  var T = Config.CHECKLIST_TYPE;
  [
    { ID: 'CL01', actividad: 'Revisión de correos pendientes', tipo: T.CHECK, ayuda: 'Verificar la bandeja compartida y responder correos con más de 24h.', prioridad: 'P2', frecuencia: 'DIARIA', sups: 1, orden: 1 },
    { ID: 'CL02', actividad: 'Conteo de caja chica', tipo: T.DATA, ayuda: 'Registrar el monto exacto en caja al cierre del turno.', prioridad: 'P1', frecuencia: 'DIARIA', sups: 1, orden: 2 },
    { ID: 'CL03', actividad: 'Revisión semanal de inventario', tipo: T.CHECK, ayuda: 'Confirmar que el inventario físico coincide con el sistema.', prioridad: 'P2', frecuencia: 'SEMANAL_LUN', sups: 2, orden: 3 }
  ].forEach(function (row) {
    repo.create({
      ID: row.ID,
      Departamento: 'DEP001',
      Actividad: row.actividad,
      Tipo: row.tipo,
      Ayuda: row.ayuda,
      Prioridad: row.prioridad,
      Frecuencia: row.frecuencia,
      'SUPs requeridos': row.sups,
      Activo: true,
      Orden: row.orden
    });
  });
}
