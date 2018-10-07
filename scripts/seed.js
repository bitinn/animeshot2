
// generate seed data on sqlite database (you can run it multiple times)

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');

async function seedDatabase () {
  const answer = await prompt.confirm('This will GENERATE SEED DATA AND INSERT into the animeshot database, only do this if you are testing locally, PROCEED? (y/n)');

  if (!answer) {
    console.log('database seeding aborted');
    return;
  }

  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true,
    migrations: [
      require('../migrations/database_seed')
    ]
  });

  await db.ready();

  // clean up seed filename cache too
  const migrationCache = db.Model('openrecord_migrations');
  await migrationCache.where({ name: 'database_seed' }).deleteAll();

  console.log('database seeding done');
  db.close();
}

seedDatabase().catch((err) => {
  console.log(err);
});
