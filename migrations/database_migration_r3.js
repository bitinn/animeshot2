
module.exports = function database_migration_r3 () {
  this.addColumn('users', function () {
    this.string('twitter_avatar');
    this.string('github_avatar');
  });

  console.log('migration step: add user avatar column');
}
