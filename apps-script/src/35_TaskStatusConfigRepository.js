var TaskStatusConfigRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_STATUS_CONFIG, 'ID');
  }
};
