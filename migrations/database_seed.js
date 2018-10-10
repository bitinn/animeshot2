
const faker = require('faker');

module.exports = function database_seed () {
  this.seed(async (db) => {
    const userModel = db.Model('users');
    const shotModel = db.Model('shots');
    const bookModel = db.Model('bookmarks');
    const flagModel = db.Model('flags');

    const userIDList = [];
    const shotIDList = [];

    let i = 0;
    while (i < 10) {
      let user = {
        username: faker.internet.userName().replace(/\.+/g, '').toLowerCase(),
        name: faker.name.findName(),
        twitter_id: faker.random.number(),
        github_id: faker.random.number(),
        twitter_avatar: null,
        github_avatar: null,
        is_mod: false,
        created: faker.date.recent(),
        updated: faker.date.recent()
      };

      user = await userModel.create(user);
      userIDList.push(user.id);

      i++;
    }

    console.log('seed step: generate user data and insert');

    i = 0;
    while (i < 2000) {
      let text = faker.lorem.words();

      let shot = {
        hash: faker.internet.password().replace(/\s+/g, ''),
        text: text,
        text_romanized: text,
        user_id: userIDList[Math.floor(Math.random() * userIDList.length)],
        bookmark_count: 0,
        flag_count: 0,
        created: faker.date.recent(),
        updated: faker.date.recent()
      }

      shot = await shotModel.create(shot);
      shotIDList.push(shot.id);

      i++;
    }

    console.log('seed step: generate shot data and insert');

    i = 0;
    while (i < 200) {
      let bookmark = {
        user_id: userIDList[Math.floor(Math.random() * userIDList.length)],
        shot_id: shotIDList[Math.floor(Math.random() * shotIDList.length)],
        created: faker.date.recent(),
        updated: faker.date.recent()
      }

      const bookCount = await bookModel.where({ user_id: bookmark.user_id, shot_id: bookmark.shot_id }).count();

      if (bookCount != 0) {
        continue;
      }

      bookmark = await bookModel.create(bookmark);

      let shot = await shotModel.find(bookmark.shot_id);
      shot.bookmark_count = shot.bookmark_count + 1;
      await shot.save();

      i++;
    }

    console.log('seed step: generate bookmark data and insert');

    i = 0;
    while (i < 20) {
      let flag = {
        user_id: userIDList[Math.floor(Math.random() * userIDList.length)],
        shot_id: shotIDList[Math.floor(Math.random() * shotIDList.length)],
        created: faker.date.recent(),
        updated: faker.date.recent()
      }

      const flagCount = await flagModel.where({ user_id: flag.user_id, shot_id: flag.shot_id }).count();

      if (flagCount != 0) {
        continue;
      }

      flag = await flagModel.create(flag);

      let shot = await shotModel.find(flag.shot_id);
      shot.flag_count = shot.flag_count + 1;
      await shot.save();

      i++;
    }

    console.log('seed step: generate flag data and insert');
  });
}
