/**
 * SheetRepository — capa Repository/DAO genérica sobre una hoja de Sheets.
 *
 * Lee/escribe por nombre de columna (no por índice fijo), para que
 * reordenar columnas en el Sheet no rompa la lógica de negocio, y para que
 * el día que se migre a Postgres/Supabase (docs/00-arquitectura-general.md)
 * solo haga falta reemplazar esta clase por una que hable SQL, manteniendo
 * la misma interfaz (findAll/findById/findWhere/create/update/softDelete).
 */
var SheetRepository = class {
  constructor(sheetName, idColumn) {
    this.sheetName = sheetName;
    this.idColumn = idColumn;
  }

  _sheet() {
    var ss = Config.getSpreadsheet();
    var sheet = ss.getSheetByName(this.sheetName);
    if (!sheet) {
      throw new Error('Hoja no encontrada: ' + this.sheetName);
    }
    return sheet;
  }

  _headers(sheet) {
    var lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) return [];
    return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  }

  _rowToObject(headers, row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = row[i];
    });
    return obj;
  }

  _objectToRow(headers, obj) {
    return headers.map(function (header) {
      return obj[header] !== undefined ? obj[header] : '';
    });
  }

  findAll() {
    var sheet = this._sheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var headers = this._headers(sheet);
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var self = this;
    return values.map(function (row) {
      return self._rowToObject(headers, row);
    });
  }

  findWhere(predicate) {
    return this.findAll().filter(predicate);
  }

  findById(id) {
    var idColumn = this.idColumn;
    var match = this.findAll().filter(function (record) {
      return String(record[idColumn]) === String(id);
    });
    return match.length ? match[0] : null;
  }

  create(record) {
    var sheet = this._sheet();
    var headers = this._headers(sheet);
    sheet.appendRow(this._objectToRow(headers, record));
    return record;
  }

  update(id, patch) {
    var sheet = this._sheet();
    var headers = this._headers(sheet);
    var idIndex = headers.indexOf(this.idColumn);
    if (idIndex === -1) {
      throw new Error('La columna "' + this.idColumn + '" no existe en ' + this.sheetName);
    }
    var lastRow = sheet.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var rowValues = sheet.getRange(r, 1, 1, headers.length).getValues()[0];
      if (String(rowValues[idIndex]) === String(id)) {
        var merged = Object.assign(this._rowToObject(headers, rowValues), patch);
        sheet.getRange(r, 1, 1, headers.length).setValues([this._objectToRow(headers, merged)]);
        return merged;
      }
    }
    return null;
  }

  softDelete(id) {
    return this.update(id, { Activo: false });
  }

  // Genera IDs legibles tipo PREFIJO+consecutivo (ej. T00001, ADJ00001).
  // El consecutivo vive en Script Properties (una key por prefijo,
  // compartida por todos los usuarios del Web App) e incrementa dentro de
  // LockService.getScriptLock() para que dos usuarios creando una Task al
  // mismo tiempo nunca reciban el mismo ID — contar filas del Sheet
  // (la implementación anterior) no es atómico entre requests concurrentes.
  nextSequentialId(prefix, padLength) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var props = PropertiesService.getScriptProperties();
      var key = 'SEQ_' + prefix;
      var next = (parseInt(props.getProperty(key), 10) || 0) + 1;
      props.setProperty(key, String(next));

      var padded = String(next);
      var targetLength = padLength || 4;
      while (padded.length < targetLength) {
        padded = '0' + padded;
      }
      return prefix + padded;
    } finally {
      lock.releaseLock();
    }
  }
}
