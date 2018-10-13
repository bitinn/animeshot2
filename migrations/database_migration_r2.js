
module.exports = function database_migration_r2 () {
  this.createTable('flags', { id: false }, function () {
    this.integer('id', { primary: true, not_null: true });
    this.integer('user_id', { not_null: true, references: 'users.id' });
    this.integer('shot_id', { not_null: true, references: 'shots.id' });
    this.datetime('created');
    this.datetime('updated');
  });

  this.createIndex('flags', 'user_id');

  this.createUniqueIndex('flags', [ 'user_id', 'shot_id' ]);

  console.log('migration step: add flags table');
}
