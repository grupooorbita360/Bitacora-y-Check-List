var ChecklistConfigRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.CHECKLIST_CONFIG, 'ID');
  }

  findByDepartment(departmentId) {
    return this.findWhere(function (c) {
      return c.Activo !== false && String(c.Departamento) === String(departmentId);
    });
  }
};
