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
  convertRunToTask: function (runId, actingUserId, taskOverrides) {
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
      visibility: overrides.visibility || Config.TASK_VISIBILITY.OPERATIONAL,
      operationalScope: overrides.operationalScope || Config.TASK_SCOPE.DEPARTMENT,
      originDepartment: run.Departamento,
      systemOrigin: Config.SYSTEM_ORIGIN.CHECKLIST,
      sourceRecordId: runId
    };

    return TaskService.create(input, actingUserId);
  }
};
