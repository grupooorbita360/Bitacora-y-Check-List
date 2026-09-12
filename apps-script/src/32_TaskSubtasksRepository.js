var TaskSubtasksRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_SUBTASKS, 'Subtask ID');
  }

  findByTask(taskId) {
    return this.findWhere(function (s) {
      return String(s['Task ID']) === String(taskId) && s.Activo !== false;
    });
  }
};
