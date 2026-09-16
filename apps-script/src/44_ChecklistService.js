/**
 * ChecklistService — Checklist_Config (plantillas) + Checklist_Runs
 * (ejecuciones reales) y la conversión de una ejecución con problema en
 * una Task de seguimiento (System Origin = CHECKLIST, sección 38).
 */
var ChecklistService = {
  listActive: function (departmentId) {
    return new ChecklistConfigRepository().findByDepartment(departmentId).sort(function (a, b) {
      return (a.Orden || 0) - (b.Orden || 0);
    });
  },

  recordRun: function (checklistConfigId, actingUserId, resultado, valor, comentario) {
    var config = new ChecklistConfigRepository().findById(checklistConfigId);
    if (!config) throw new Error('Actividad de checklist no encontrada.');

    var runs = new ChecklistRunsRepository();
    var runId = runs.nextSequentialId('RUN', 6);
    runs.create({
      'Run ID': runId,
      'Checklist Config ID': checklistConfigId,
      Departamento: config.Departamento,
      Fecha: new Date(),
      'Ejecutado Por ID': actingUserId,
      Resultado: resultado,
      Valor: valor || '',
      Comentario: comentario || '',
      'Created At': new Date()
    });
    return runId;
  },

  // El Source Record ID de la Task creada es el ID de ESTA ejecución
  // (Checklist_Runs), no el ID de la plantilla en Checklist_Config
  // (docs/01-modelo-datos.md → Checklist_Runs).
  //
  // Visibility=SUPERVISION por defecto (antes OPERATIONAL): una Task nacida
  // de "+Convertir en Task" es, por definición, el seguimiento de un
  // problema de Checklist/Bitácora — la pestaña "Supervisión" del frontend
  // (docs/12-tabs-tasks-logout.md) agrupa exactamente las Tasks con
  // Visibility=SUPERVISION para que el Gerente/Supervisor las vea juntas
  // en vez de mezcladas con el resto de Tasks del departamento. Un caller
  // puede seguir pasando otra Visibility explícita si alguna vez hiciera
  // falta (el override ya existía, solo cambió el default).
  //
  // Restringido a Supervisor/Manager/Director/Admin (sección 36 del prompt
  // maestro: convertir es acción de Supervisor, no de Agent — ver
  // docs/14-checklist-convert-role.md). Antes de este chequeo, un Agent
  // podía convertir su propio reporte y quedar como Owner de una Task
  // Visibility=SUPERVISION que el enforcement de docs/13-visibility-
  // enforcement.md ya le impide ver a él mismo — quedaba huérfana hasta
  // que un Supervisor la encontrara por su cuenta. recordRun() (el reporte
  // en sí) sigue abierto a cualquier rol: el Agent reporta, el Supervisor
  // convierte.
  convertRunToTask: function (runId, actingUserId, taskOverrides) {
    if (!PermissionService.isSupervisorOrAbove(actingUserId)) {
      throw new Error('Solo un Supervisor o superior puede convertir una ejecución de Checklist en Task de seguimiento.');
    }
    var run = new ChecklistRunsRepository().findById(runId);
    if (!run) throw new Error('Ejecución de checklist no encontrada.');
    var config = new ChecklistConfigRepository().findById(run['Checklist Config ID']);
    var overrides = taskOverrides || {};

    var input = {
      title: overrides.title || 'Seguimiento: ' + (config ? config.Actividad : run['Checklist Config ID']),
      description: overrides.description || run.Comentario || '',
      type: overrides.type || 'Operativo',
      department: run.Departamento,
      ownerId: overrides.ownerId || actingUserId,
      priority: overrides.priority || (config ? config.Prioridad : 'P2'),
      dueDate: overrides.dueDate || '',
      visibility: overrides.visibility || Config.TASK_VISIBILITY.SUPERVISION,
      operationalScope: overrides.operationalScope || Config.TASK_SCOPE.DEPARTMENT,
      originDepartment: run.Departamento,
      systemOrigin: Config.SYSTEM_ORIGIN.CHECKLIST,
      sourceRecordId: runId
    };

    return TaskService.create(input, actingUserId);
  }
};
