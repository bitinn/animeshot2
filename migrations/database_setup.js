
module.exports = function database_setup () {
  this.createTable('users', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.string('username', { not_null: true, unique: true });
    this.string('name');
    this.integer('twitter_id', { unique: true });
    this.boolean('is_mod', { default: false });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createTable('shots', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.string('hash', { not_null: true, unique: true });
    this.string('text');
    this.string('text_romanized');
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('note_count', { default: 0 });
    this.integer('flag_count', { default: 0 });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createTable('notes', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('shot_id', { not_null: true, references: 'shots.id' });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createIndex('shots', 'user_id');

  this.createIndex('notes', 'user_id');
  this.createIndex('notes', 'shot_id');
  this.createUniqueIndex('notes', [ 'user_id', 'shot_id' ]);

  console.log('migration step: setup tables and indexes');
}
