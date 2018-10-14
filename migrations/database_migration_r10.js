
module.exports = function database_migration_r10 () {
  this.addColumn('shots', function () {
    this.boolean('legacy');
  });

  console.log('migration step: add legacy flag for v1 import');
}
