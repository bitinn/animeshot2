
module.exports = function database_migration_r9 () {
  this.addColumn('users', function () {
    this.string('github_username');
    this.string('twitter_username');
  });

  console.log('migration step: add github and twitter username store');
}
