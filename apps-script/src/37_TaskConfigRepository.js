var TaskConfigRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASK_CONFIG, 'ID');
  }
};
