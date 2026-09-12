var AuthCredentialsRepository = class extends SheetRepository {
  constructor() {
    super(Config.SHEET_TABS.AUTH_CREDENTIALS, 'User ID');
  }

  findByUserId(userId) {
    return this.findById(userId);
  }

  upsert(userId, pinHash, salt) {
    var existing = this.findByUserId(userId);
    var now = new Date();
    if (existing) {
      return this.update(userId, { 'PIN Hash': pinHash, Salt: salt, 'Updated At': now });
    }
    return this.create({ 'User ID': userId, 'PIN Hash': pinHash, Salt: salt, 'Updated At': now });
  }
}
