
module.exports = function database_migration_r8 () {
  this.addColumn('shots', function () {
    this.integer('image_width');
    this.integer('image_height');
  });

  console.log('migration step: add image width and height columns');
}
