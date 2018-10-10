
module.exports = function database_migration_r6 () {
  this.dropIndex('shots', 'user_id');
  this.dropIndex('bookmarks', 'user_id');
  this.dropIndex('flags', 'user_id');

  console.log('migration step: remove unused indexes');
}
