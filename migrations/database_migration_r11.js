
module.exports = function database_migration_r11 () {
  this.addColumn('users', function () {
    this.integer('telegram_id');
    this.string('telegram_username');
  });

  console.log('migration step: add telegram column to users');
}
