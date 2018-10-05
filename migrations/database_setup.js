
module.exports = function database_setup () {
  this.createTable('shots', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.string('hash', { not_null: true, unique: true });
    this.string('text');
    this.string('text_romanized');
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('up_votes', { default: 0 });
    this.integer('down_votes', { default: 0 });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createTable('users', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.string('username', { not_null: true, unique: true });
    this.string('nickname');
    this.integer('twitter_id', { not_null: true, unique: true });
    this.string('twitter_token');
    this.boolean('is_mod', { default: false });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createTable('votes', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('shot_id', { not_null: true, references: 'shots.id' });
    this.boolean('is_up_vote');
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createIndex('shots', 'user_id');
  this.createIndex('votes', 'user_id');
  this.createIndex('votes', 'shot_id');
  this.createUniqueIndex('votes', [ 'user_id', 'shot_id' ]);

  console.log('migration step: setup tables and indexes');
}