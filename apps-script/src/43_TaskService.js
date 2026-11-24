/**
 * TaskService — CRUD, lifecycle, comments, participants, subtasks,
 * adjustments y bulk reassignment. Orquesta TasksRepository +
 * TaskHistoryService + TaskPermissionService; nunca toca SpreadsheetApp
 * directamente (docs/00-arquitectura-general.md).
 *
 * Este archivo es el "core" (create/get) — el resto de los métodos vive
 * en 43_TaskService<Grupo>.js (Lifecycle/Ownership/Comments/Participants/
 * Subtasks/Adjustments, ver docs/16-file-split-map.md), cada uno sumando
 * sus métodos con `Object.assign(TaskService, {...})`. Apps Script (y
 * test/loadGas.js) carga los .js de un proyecto en orden alfabético de
 * nombre de archivo — por eso el nombre de este archivo (con el "." de
 * ".js" pegado justo después de "TaskService") ordena antes que cualquier
 * "43_TaskService<Letra>...js": tiene que existir `var TaskService` antes
 * de que ningún archivo extensión pueda hacerle Object.assign.
 */
var TaskService = {
  create: function (input, actingUserId) {
    var actingUser = new UsersRepository().findById(actingUserId);
    if (!actingUser) throw new Error('El usuario que crea la Task no existe.');
    if (!input || !input.title) throw new Error('La Task requiere un título.');
    if (!input.department) throw new Error('La Task requiere un departamento.');
    if (!input.type) throw new Error('La Task requiere un Task Type.');

    var allowedTypes = TaskConfigService.getAllowedTypes(actingUserId, input.department);
    if (allowedTypes.indexOf(input.type) === -1) {
      throw new Error('Task Type "' + input.type + '" no permitido para este rol/departamento.');
    }

    var ownerId = input.ownerId || actingUserId;
    var owner = new UsersRepository().findById(ownerId);
    if (!owner) throw new Error('El Owner indicado no existe.');
    var isExplicitAssignment = ownerId !== actingUserId;

    var tasks = new TasksRepository();
    var taskId = tasks.nextSequentialId('T', 5);
    var now = new Date();

    var task = {
      'Task ID': taskId,
      'Task Title': input.title,
      Description: input.description || '',
      Type: input.type,
      Department: input.department,
      'Created By ID': actingUserId,
      'Created By': actingUser.Nombre,
      'Owner ID': owner['User ID'],
      Owner: owner.Nombre,
      Priority: input.priority || 'P3',
      'Due Date': input.dueDate || '',
      'Review Date': '',
      Status: Config.TASK_STATUS.PENDING,
      Visibility: input.visibility || Config.TASK_VISIBILITY.OPERATIONAL,
      'Operational Scope': input.operationalScope || Config.TASK_SCOPE.OWN,
      'Reference Type': input.referenceType || '',
      'Reference ID': input.referenceId || '',
      'Origin Department': input.originDepartment || input.department,
      'System Origin': input.systemOrigin || Config.SYSTEM_ORIGIN.MANUAL,
      'Source Record ID': input.sourceRecordId || '',
      'Created At': now,
      'Updated At': now,
      'Completed At': '',
      'Cancelled At': '',
      'Cancelled By ID': '',
      'Cancellation Reason': '',
      Active: true
    };

    tasks.create(task);
    TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.CREATED, actingUserId, '', { type: input.type });
    // ASSIGNED es un evento distinto de CREATED cuando el creador asigna la
    // Task a otra persona (no se registra si uno se crea la Task a sí mismo).
    if (isExplicitAssignment) {
      TaskHistoryService.record(taskId, Config.HISTORY_EVENTS.ASSIGNED, actingUserId, '', { ownerId: ownerId });
    }
    return task;
  },

  get: function (taskId, actingUserId) {
    var task = new TasksRepository().findById(taskId);
    if (!task) return null;
    if (!TaskPermissionService.canView(actingUserId, task)) {
      throw new Error('No tienes permiso para ver esta Task.');
    }
    return task;
  }
};
