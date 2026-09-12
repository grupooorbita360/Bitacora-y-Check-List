var TaskAdjustmentsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_ADJUSTMENTS, 'Adjustment ID');
  }

  findByTask(taskId) {
    return this.findWhere(function (a) {
      return String(a['Task ID']) === String(taskId);
    });
  }

  findPendingByTask(taskId) {
    return this.findByTask(taskId).filter(function (a) {
      return a.Status === 'PENDING';
    });
  }
};
