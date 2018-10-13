
module.exports = function database_migration_r5 () {
  this.createIndex('shots', ['user_id', 'created']);
  this.createIndex('bookmarks', ['user_id', 'created']);
  this.createIndex('flags', ['user_id', 'created']);

  this.createIndex('shots', 'bookmark_count');
  this.createIndex('shots', 'flag_count');

  console.log('migration step: add indexes for query performance');
}
