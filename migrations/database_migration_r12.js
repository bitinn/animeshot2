
module.exports = function database_migration_r12 () {
  this.addColumn('users', function () {
    this.boolean('can_upload', { default: true });
  });

  console.log('migration step: add can_upload column to users');
}
