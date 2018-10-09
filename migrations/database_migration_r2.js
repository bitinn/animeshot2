
module.exports = function database_migration_r2 () {
  this.createTable('flags', { id: false }, function () {
    this.integer('id', { unique: true, not_null: true, primary: true });
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('shot_id', { not_null: true, references: 'shots.id' });
    this.datetime('created', { not_null: true });
    this.datetime('updated', { not_null: true });
  });

  this.createIndex('flags', 'user_id');
  this.createIndex('flags', 'shot_id');
  this.createUniqueIndex('flags', [ 'user_id', 'shot_id' ]);

  console.log('migration step: add flags table');
}
