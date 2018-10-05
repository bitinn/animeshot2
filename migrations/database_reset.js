
module.exports = function database_reset () {
  // delete in reverse oreder due to foreign key constraint
  this.removeTable('votes');
  this.removeTable('shots');
  this.removeTable('users');

  console.log('reset step: delete tables');
}
