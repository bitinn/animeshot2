
module.exports = function database_reset () {
  this.seed(async (db) => {
    const userModel = db.Model('users');
    const shotModel = db.Model('shots');
    const bookModel = db.Model('bookmarks');
    const flagModel = db.Model('flags');

    await flagModel.deleteAll();
    await bookModel.deleteAll();
    await shotModel.deleteAll();
    await userModel.deleteAll();

    console.log('reset step: delete all data');
  });
}
