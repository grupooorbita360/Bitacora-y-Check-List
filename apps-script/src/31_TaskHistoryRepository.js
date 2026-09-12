var TaskHistoryRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_HISTORY, 'History ID');
  }

  findByTask(taskId) {
    return this.findWhere(function (h) {
      return String(h['Task ID']) === String(taskId);
    });
  }
};
