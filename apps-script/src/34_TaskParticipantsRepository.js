/**
 * Task_Participants no tiene una columna de ID propia en el modelo
 * original — se sintetiza 'Participant ID' = "<Task ID>::<User ID>" para
 * poder reutilizar el Repository genérico (create/update/softDelete) sin
 * un caso especial de clave compuesta.
 */
var TaskParticipantsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_PARTICIPANTS, 'Participant ID');
  }

  static buildId(taskId, userId) {
    return taskId + '::' + userId;
  }

  findByTask(taskId) {
    return this.findWhere(function (p) {
      return String(p['Task ID']) === String(taskId) && p.Activo !== false;
    });
  }
};
