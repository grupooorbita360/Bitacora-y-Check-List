/**
 * Api (Checklist) — listar actividades, registrar una ejecución y
 * convertirla en Task de seguimiento. Ver la cabecera de 98_Api.js para
 * la convención de este split.
 */

function api_listChecklist(token, departmentId) {
  _resolveActingUserId(token);
  return _toPlain(ChecklistService.listActive(departmentId));
}

function api_recordChecklistRun(token, checklistConfigId, resultado, valor, comentario) {
  var userId = _resolveActingUserId(token);
  return _toPlain(ChecklistService.recordRun(checklistConfigId, userId, resultado, valor, comentario));
}

function api_convertChecklistRunToTask(token, runId, overrides) {
  var userId = _resolveActingUserId(token);
  return _toPlain(ChecklistService.convertRunToTask(runId, userId, overrides));
}
