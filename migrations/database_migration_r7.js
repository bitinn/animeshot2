
module.exports = function database_migration_r7 () {
  this.createIndex('bookmarks', ['shot_id', 'created']);
  this.createIndex('flags', ['shot_id', 'created']);

  console.log('migration step: add indexes for delete');
}
