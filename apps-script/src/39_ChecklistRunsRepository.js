var ChecklistRunsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.CHECKLIST_RUNS, 'Run ID');
  }
};
