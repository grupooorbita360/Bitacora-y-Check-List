/**
 * Config — única capa que conoce nombres de hojas, constantes y Script
 * Properties. Nada fuera de este archivo debe usar SpreadsheetApp/
 * PropertiesService directamente (ver docs/00-arquitectura-general.md).
 */
var Config = {
  SHEET_TABS: {
    DEPARTMENTS: 'Departments',
    USERS: 'Users',
    USER_ROLES: 'User_Roles',
    AUTH_CREDENTIALS: 'Auth_Credentials',
    TASKS: 'Tasks',
    TASK_HISTORY: 'Task_History',
    TASK_SUBTASKS: 'Task_Subtasks',
    TASK_ADJUSTMENTS: 'Task_Adjustments',
    TASK_PARTICIPANTS: 'Task_Participants',
    TASK_STATUS_CONFIG: 'Task_Status_Config',
    TASK_STATUS_TRANSITIONS: 'Task_Status_Transitions',
    TASK_CONFIG: 'Task_Config',
    TASK_PERMISSIONS: 'Task_Permissions',
    TASK_ASSIGNMENT_CONFIG: 'Task_Assignment_Config',
    CHECKLIST_CONFIG: 'Checklist_Config',
    CHECKLIST_RUNS: 'Checklist_Runs'
  },

  ROLES: {
    DIRECTOR: 'Director',
    MANAGER: 'Manager',
    SUPERVISOR: 'Supervisor',
    AGENT: 'Agent',
    ADMIN: 'Admin'
  },

  // Alcance reservado del motor de permisos — nunca una fila real de
  // Departments ni el Department ID de un usuario (docs/01-modelo-datos.md).
  RESERVED_SCOPE_GLOBAL: 'GLOBAL',

  TASK_STATUS: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING: 'WAITING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },

  // Nombres alineados 1:1 con la columna Accion de Task_Permissions donde
  // existe fila real (VIEW, CREATE, EDIT, ASSIGN, REASSIGN, TAKE_OWNERSHIP,
  // COMPLETE, SNOOZE, REOPEN, REQUEST_ADJUSTMENT, APPROVE_ADJUSTMENT,
  // CANCEL, ADD_PARTICIPANT, REMOVE_PARTICIPANT, ADD_COMMENT, VIEW_HISTORY,
  // VIEW_SUBTASKS, CREATE_SUBTASK, BULK_REASSIGN). OPEN, RESUME y
  // COMPLETE_SUBTASK no tienen fila en Task_Permissions — TaskPermissionService
  // los resuelve con la lógica derivada (fallback), ver docs/06-fase-3-decisiones.md.
  TASK_ACTIONS: {
    VIEW: 'VIEW',
    CREATE: 'CREATE',
    EDIT: 'EDIT',
    ASSIGN: 'ASSIGN',
    OPEN: 'OPEN',
    COMPLETE: 'COMPLETE',
    SNOOZE: 'SNOOZE',
    RESUME: 'RESUME',
    CANCEL: 'CANCEL',
    REOPEN: 'REOPEN',
    REASSIGN: 'REASSIGN',
    BULK_REASSIGN: 'BULK_REASSIGN',
    TAKE_OWNERSHIP: 'TAKE_OWNERSHIP',
    ADD_COMMENT: 'ADD_COMMENT',
    ADD_PARTICIPANT: 'ADD_PARTICIPANT',
    REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
    VIEW_HISTORY: 'VIEW_HISTORY',
    VIEW_SUBTASKS: 'VIEW_SUBTASKS',
    CREATE_SUBTASK: 'CREATE_SUBTASK',
    COMPLETE_SUBTASK: 'COMPLETE_SUBTASK',
    REQUEST_ADJUSTMENT: 'REQUEST_ADJUSTMENT',
    APPROVE_ADJUSTMENT: 'APPROVE_ADJUSTMENT',
    REJECT_ADJUSTMENT: 'REJECT_ADJUSTMENT'
  },

  TASK_VISIBILITY: {
    OPERATIONAL: 'OPERATIONAL',
    SUPERVISION: 'SUPERVISION',
    MANAGEMENT: 'MANAGEMENT',
    RESTRICTED: 'RESTRICTED'
  },

  TASK_SCOPE: {
    OWN: 'OWN',
    SHARED: 'SHARED',
    DEPARTMENT: 'DEPARTMENT',
    CROSS_DEPARTMENT: 'CROSS_DEPARTMENT',
    ALL: 'ALL'
  },

  SYSTEM_ORIGIN: {
    BITACORA: 'BITACORA',
    PEOPLE: 'PEOPLE',
    MANUAL: 'MANUAL',
    CHECKLIST: 'CHECKLIST'
  },

  ADJUSTMENT_TYPE: {
    REASSIGN: 'REASSIGN',
    CHANGE_DEPARTMENT: 'CHANGE_DEPARTMENT',
    REASSIGN_AND_CHANGE_DEPARTMENT: 'REASSIGN_AND_CHANGE_DEPARTMENT',
    OTHER: 'OTHER'
  },

  ADJUSTMENT_STATUS: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
  },

  SUBTASK_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED'
  },

  CHECKLIST_TYPE: {
    CHECK: 'CHECK',
    DATA: 'DATA'
  },

  // Confirmados contra el listado real de Task_History (18 eventos): se
  // agregó ASSIGNED (asignación explícita de Owner distinta de quien crea),
  // se quitó ADJUSTMENT_CANCELLED (no existe — cancelar un ajuste queda
  // reflejado solo en Task_Adjustments.Status, sin evento de History) y se
  // renombró SUBTASK_ADDED a SUBTASK_CREATED.
  HISTORY_EVENTS: {
    CREATED: 'CREATED',
    ASSIGNED: 'ASSIGNED',
    OPENED: 'OPENED',
    OWNERSHIP_TAKEN: 'OWNERSHIP_TAKEN',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REOPENED: 'REOPENED',
    SNOOZED: 'SNOOZED',
    RESUMED: 'RESUMED',
    COMMENT_ADDED: 'COMMENT_ADDED',
    REASSIGNED: 'REASSIGNED',
    ADJUSTMENT_REQUESTED: 'ADJUSTMENT_REQUESTED',
    ADJUSTMENT_APPROVED: 'ADJUSTMENT_APPROVED',
    ADJUSTMENT_REJECTED: 'ADJUSTMENT_REJECTED',
    PARTICIPANT_ADDED: 'PARTICIPANT_ADDED',
    PARTICIPANT_REMOVED: 'PARTICIPANT_REMOVED',
    SUBTASK_CREATED: 'SUBTASK_CREATED',
    SUBTASK_COMPLETED: 'SUBTASK_COMPLETED'
  },

  TASK_PARTICIPANT_ROLES: {
    COLLABORATOR: 'COLLABORATOR',
    SUPPORT: 'SUPPORT',
    REVIEWER: 'REVIEWER',
    OBSERVER: 'OBSERVER'
  },

  getSpreadsheet: function () {
    var active = SpreadsheetApp.getActive();
    if (active) return active;
    var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('No hay spreadsheet activo ni SHEET_ID configurado en Script Properties.');
    }
    return SpreadsheetApp.openById(sheetId);
  },

  getSessionSecret: function () {
    var secret = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
    if (!secret) {
      throw new Error('Falta configurar SESSION_SECRET en Script Properties.');
    }
    return secret;
  }
};
