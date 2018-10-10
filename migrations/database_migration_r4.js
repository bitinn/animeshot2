
module.exports = function database_migration_r4 () {
  this.addColumn('shots', function () {
    this.string('image_url');
  });

  console.log('migration step: add full image url column');
}
