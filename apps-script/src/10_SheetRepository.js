/**
 * SheetRepository — capa Repository/DAO genérica sobre una hoja de Sheets.
 *
 * Lee/escribe por nombre de columna (no por índice fijo), para que
 * reordenar columnas en el Sheet no rompa la lógica de negocio, y para que
 * el día que se migre a Postgres/Supabase (docs/00-arquitectura-general.md)
 * solo haga falta reemplazar esta clase por una que hable SQL, manteniendo
 * la misma interfaz (findAll/findById/findWhere/create/update/softDelete).
 *
 * Cache por ejecución: `findAll()` cachea el resultado por nombre de hoja
 * (no por instancia — el código crea `new XRepository()` nuevo en casi
 * cada llamada, así que cachear en la instancia no serviría de nada).
 * Sin esto, una sola llamada a TaskService.get()/api_getTaskDetail podía
 * disparar docenas de lecturas completas de la misma hoja (ej.
 * TaskPermissionService.can() se llama ~12 veces al calcular las acciones
 * disponibles de una Task, cada una releyendo Task_Permissions —87 filas—
 * y User_Roles desde cero) — cada lectura de Sheets tiene latencia real en
 * Apps Script, y eso es lo que se sentía como "carga lenta". El cache se
 * invalida en create/update para ese sheetName específico; como Apps
 * Script arranca una ejecución nueva por request, nunca sirve datos
 * obsoletos entre usuarios ni entre llamadas al Web App separadas — como
 * mucho, dentro de la misma ejecución, y ahí sí se invalida correctamente.
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

  _invalidateCache() {
    delete SheetRepository._cache[this.sheetName];
  }

  findAll() {
    var cached = SheetRepository._cache[this.sheetName];
    if (cached) {
      return cached.map(function (row) {
        return Object.assign({}, row);
      });
    }

    var sheet = this._sheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      SheetRepository._cache[this.sheetName] = [];
      return [];
    }
    var headers = this._headers(sheet);
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var self = this;
    var rows = values.map(function (row) {
      return self._rowToObject(headers, row);
    });

    SheetRepository._cache[this.sheetName] = rows;
    return rows.map(function (row) {
      return Object.assign({}, row);
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
    this._invalidateCache();
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
    if (lastRow < 2) return null;

    // Una sola lectura del rango completo para ubicar la fila, en vez de
    // un getRange().getValues() por fila (O(N) llamadas a Sheets antes) —
    // igual de necesario que el cache de findAll() para no sentir "carga
    // lenta" a medida que las hojas crecen con uso real.
    var allValues = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < allValues.length; i++) {
      if (String(allValues[i][idIndex]) === String(id)) {
        var merged = Object.assign(this._rowToObject(headers, allValues[i]), patch);
        sheet.getRange(i + 2, 1, 1, headers.length).setValues([this._objectToRow(headers, merged)]);
        this._invalidateCache();
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

SheetRepository._cache = {};
