var DepartmentsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.DEPARTMENTS, 'Department ID');
  }
}
