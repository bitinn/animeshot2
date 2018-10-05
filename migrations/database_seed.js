
const faker = require('faker');

module.exports = function database_seed () {
  this.seed(async (db) => {
    const userModel = db.Model('users');
    const shotModel = db.Model('shots');
    const voteModel = db.Model('votes');

    const userIDList = [];
    const shotIDList = [];

    let i = 0;
    while (i < 5) {
      let user = {
        username: faker.internet.userName().replace(/\.+/g, ''),
        nickname: faker.name.findName(),
        twitter_id: faker.random.number(),
        twitter_token: faker.internet.password().replace(/\s+/g, ''),
        is_mod: faker.random.boolean(),
        created: faker.date.recent(),
        updated: faker.date.recent()
      };

      user = await userModel.create(user);
      userIDList.push(user.id);

      i++;
    }

    i = 0;
    while (i < 10) {
      let text = faker.lorem.words();

      let shot = {
        hash: faker.internet.password().replace(/\s+/g, ''),
        text: text,
        text_romanized: text,
        user_id: userIDList[Math.floor(i / 2)],
        up_votes: faker.random.number({ max: 5 }),
        down_votes: faker.random.number({ max: 5 }),
        created: faker.date.recent(),
        updated: faker.date.recent()
      }

      shot = await shotModel.create(shot);
      shotIDList.push(shot.id);

      i++;
    }

    i = 0;
    while (i < 10) {
      let vote = {
        user_id: userIDList[Math.floor(i / 2)],
        shot_id: shotIDList[i],
        is_up_vote: faker.random.boolean(),
        created: faker.date.recent(),
        updated: faker.date.recent()
      }

      vote = await voteModel.create(vote);

      i++;
    }
  });

  console.log('seed step: generate data and insert');
}
