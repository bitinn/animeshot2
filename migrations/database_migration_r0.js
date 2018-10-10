
module.exports = function database_migration_r0 () {
  this.createTable('users', { id: false }, function () {
    this.integer('id', { primary: true, not_null: true });
    this.string('username', { unique: true, not_null: true });
    this.string('name');
    this.integer('twitter_id', { unique: true });
    this.boolean('is_mod', { default: false });
    this.datetime('created');
    this.datetime('updated');
  });

  this.createTable('shots', { id: false }, function () {
    this.integer('id', { primary: true, not_null: true });
    this.string('hash', { unique: true, not_null: true });
    this.string('text');
    this.string('text_romanized');
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('bookmark_count', { default: 0 });
    this.integer('flag_count', { default: 0 });
    this.datetime('created');
    this.datetime('updated');
  });

  this.createTable('bookmarks', { id: false }, function () {
    this.integer('id', { primary: true, not_null: true });
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('shot_id', { not_null: true, references: 'shots.id' });
    this.datetime('created');
    this.datetime('updated');
  });

  this.createIndex('shots', 'user_id');
  this.createIndex('shots', 'created');

  this.createIndex('bookmarks', 'user_id');

  this.createUniqueIndex('bookmarks', [ 'user_id', 'shot_id' ]);

  console.log('migration step: setup basic tables and indexes');
}
