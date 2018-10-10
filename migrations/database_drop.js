
module.exports = function database_drop () {
  // delete in reverse oreder due to foreign key constraint
  this.removeTable('flags');
  this.removeTable('bookmarks');
  this.removeTable('shots');
  this.removeTable('users');

  console.log('reset step: drop tables');
}
