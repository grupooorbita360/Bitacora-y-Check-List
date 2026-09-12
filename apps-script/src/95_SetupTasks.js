/**
 * Crea/siembra las hojas de Tasks y Checklist (Fase 3). Se llama desde
 * bootstrapTestEnvironment() (90_Setup.js) — no hace falta correrla aparte.
 *
 * Task_Status_Config y Task_Status_Transitions se siembran con los valores
 * EXACTOS de la sección 12-13 del prompt maestro (confirmados contra el
 * Sheet real en la auditoría de Fase 1). Task_Config usa el catálogo ya
 * corregido en docs/01-modelo-datos.md (sin "Reasignación"). Task_Permissions
 * y Task_Assignment_Config NO se crean aquí — ver docs/06-fase-3-decisiones.md.
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
  var checklistConfigSheet = _ensureSheet(ss, Config.SHEET_TABS.CHECKLIST_CONFIG, [
    'ID', 'Departamento', 'Actividad', 'Tipo', 'Ayuda', 'Prioridad', 'Frecuencia', 'SUPs requeridos', 'Activo', 'Orden'
  ]);
  _ensureSheet(ss, Config.SHEET_TABS.CHECKLIST_RUNS, [
    'Run ID', 'Checklist Config ID', 'Departamento', 'Fecha', 'Ejecutado Por ID', 'Resultado', 'Valor', 'Comentario', 'Created At'
  ]);

  if (statusConfigSheet.getLastRow() < 2) _seedTaskStatusConfig();
  if (transitionsSheet.getLastRow() < 2) _seedTaskStatusTransitions();
  if (taskConfigSheet.getLastRow() < 2) _seedTaskConfig();
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
