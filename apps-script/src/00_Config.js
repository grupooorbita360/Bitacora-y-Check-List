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
    AUTH_CREDENTIALS: 'Auth_Credentials'
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
