'use strict';
/**
 * Simula el subconjunto de globals de Apps Script que usa nuestro código
 * (SpreadsheetApp, PropertiesService, Utilities, Session), respaldado por
 * estructuras en memoria de Node — para poder correr la lógica de
 * Repository/Auth/Permissions sin depender de un Sheet real.
 */
const crypto = require('crypto');

class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows || 1;
    this.numCols = numCols || 1;
  }

  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowData = this.sheet.data[this.row - 1 + r] || [];
      const rowOut = [];
      for (let c = 0; c < this.numCols; c++) {
        const value = rowData[this.col - 1 + c];
        rowOut.push(value === undefined ? '' : value);
      }
      out.push(rowOut);
    }
    return out;
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIndex = this.row - 1 + r;
      while (this.sheet.data.length <= rowIndex) this.sheet.data.push([]);
      for (let c = 0; c < values[r].length; c++) {
        this.sheet.data[rowIndex][this.col - 1 + c] = values[r][c];
      }
    }
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }

  getLastRow() {
    return this.data.length;
  }

  getLastColumn() {
    return this.data.length ? this.data[0].length : 0;
  }

  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }

  appendRow(rowArray) {
    this.data.push(rowArray.slice());
  }

  getName() {
    return this.name;
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input) {
  let str = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

/**
 * Crea un set fresco de mocks (spreadsheet, properties, sesión) — cada
 * llamada da un estado en memoria aislado, para que los tests no se
 * contaminen entre sí.
 */
function createGasMocks() {
  const spreadsheet = new MockSpreadsheet();
  const scriptProperties = new Map();
  let activeUserEmail = '';

  const PropertiesService = {
    getScriptProperties: function () {
      return {
        getProperty: function (key) {
          return scriptProperties.has(key) ? scriptProperties.get(key) : null;
        },
        setProperty: function (key, value) {
          scriptProperties.set(key, value);
        }
      };
    }
  };

  const SpreadsheetApp = {
    getActive: function () {
      return spreadsheet;
    },
    openById: function () {
      return spreadsheet;
    }
  };

  const Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },

    computeDigest: function (_algorithm, value) {
      const hash = crypto.createHash('sha256').update(value, 'utf8').digest();
      return Array.from(hash).map((b) => (b > 127 ? b - 256 : b));
    },

    computeHmacSha256Signature: function (value, key) {
      const hmac = crypto.createHmac('sha256', key).update(value, 'utf8').digest();
      return Array.from(hmac).map((b) => (b > 127 ? b - 256 : b));
    },

    base64EncodeWebSafe: function (input) {
      if (Array.isArray(input)) {
        return base64UrlEncode(Buffer.from(input.map((b) => (b < 0 ? b + 256 : b))));
      }
      return base64UrlEncode(input);
    },

    base64DecodeWebSafe: function (input) {
      const buf = base64UrlDecode(input);
      return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
    },

    newBlob: function (byteArray) {
      const buf = Buffer.from(byteArray.map((b) => (b < 0 ? b + 256 : b)));
      return {
        getDataAsString: function () {
          return buf.toString('utf8');
        }
      };
    },

    getUuid: function () {
      return crypto.randomUUID();
    }
  };

  const Session = {
    getActiveUser: function () {
      return { getEmail: () => activeUserEmail };
    }
  };

  return {
    PropertiesService,
    SpreadsheetApp,
    Utilities,
    Session,
    // Helper de test, no existe en Apps Script real.
    __setActiveUserEmail: function (email) {
      activeUserEmail = email;
    },
    __spreadsheet: spreadsheet
  };
}

module.exports = { createGasMocks, MockSpreadsheet, MockSheet };
