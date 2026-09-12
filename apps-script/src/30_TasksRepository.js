var TasksRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.TASKS, 'Task ID');
  }

  findByDepartment(departmentId) {
    return this.findWhere(function (task) {
      return task.Active !== false && String(task.Department) === String(departmentId);
    });
  }

  findByOwner(ownerId) {
    return this.findWhere(function (task) {
      return task.Active !== false && String(task['Owner ID']) === String(ownerId);
    });
  }
};
