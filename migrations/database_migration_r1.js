
module.exports = function database_migration_r1 () {
  this.addColumn('users', function () {
    this.integer('github_id', { unique: true });
  });

  console.log('migration step: add github login support');
}
