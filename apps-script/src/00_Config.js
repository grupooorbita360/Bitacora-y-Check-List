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

  TASK_ACTIONS: {
    OPEN: 'OPEN',
    COMPLETE: 'COMPLETE',
    SNOOZE: 'SNOOZE',
    RESUME: 'RESUME',
    CANCEL: 'CANCEL',
    REOPEN: 'REOPEN',
    VIEW: 'VIEW',
    REASSIGN: 'REASSIGN',
    BULK_REASSIGN: 'BULK_REASSIGN',
    TAKE_OWNERSHIP: 'TAKE_OWNERSHIP',
    ADD_COMMENT: 'ADD_COMMENT',
    ADD_PARTICIPANT: 'ADD_PARTICIPANT',
    REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
    ADD_SUBTASK: 'ADD_SUBTASK',
    COMPLETE_SUBTASK: 'COMPLETE_SUBTASK',
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

  // Reconstruidos a partir de las reglas de negocio del prompt maestro —
  // no se tuvo acceso en esta fase al listado literal de Task_History en
  // NEW_Bitacora.xlsx. Ver docs/06-fase-3-decisiones.md antes de tratarlos
  // como definitivos.
  HISTORY_EVENTS: {
    CREATED: 'CREATED',
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
    ADJUSTMENT_CANCELLED: 'ADJUSTMENT_CANCELLED',
    PARTICIPANT_ADDED: 'PARTICIPANT_ADDED',
    PARTICIPANT_REMOVED: 'PARTICIPANT_REMOVED',
    SUBTASK_ADDED: 'SUBTASK_ADDED',
    SUBTASK_COMPLETED: 'SUBTASK_COMPLETED'
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
