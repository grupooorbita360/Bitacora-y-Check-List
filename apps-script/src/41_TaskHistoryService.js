var TaskHistoryService = {
  record: function (taskId, eventType, performedById, comment, details) {
    var history = new TaskHistoryRepository();
    var performedBy = new UsersRepository().findById(performedById);
    var id = history.nextSequentialId('H', 6);
    history.create({
      'History ID': id,
      'Task ID': taskId,
      'Event Type': eventType,
      'Performed By ID': performedById,
      'Performed By': performedBy ? performedBy.Nombre : performedById,
      Comment: comment || '',
      Details: JSON.stringify(details || {}),
      'Created At': new Date()
    });
    return id;
  },

  listForTask: function (taskId) {
    return new TaskHistoryRepository().findByTask(taskId);
  }
};
