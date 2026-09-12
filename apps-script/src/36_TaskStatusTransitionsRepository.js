var TaskStatusTransitionsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_STATUS_TRANSITIONS, 'ID');
  }

  findTransition(fromStatus, action) {
    var match = this.findWhere(function (row) {
      return row['From Status'] === fromStatus && row.Action === action;
    });
    return match.length ? match[0] : null;
  }
};
