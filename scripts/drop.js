
// reset sqlite database (only run this in development environment)

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');

async function dropDatabase () {
  const answer = await prompt.confirm('This will DELETE ALL TABLES from the animeshot database, only proceed if you are testing locally or have backed up the sqlite file, PROCEED? (y/n)');

  if (!answer) {
    console.log('database drop aborted');
    return;
  }

  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true,
    migrations: [
      require('../migrations/database_drop')
    ]
  });
  
  await db.ready();

  // clean up migration filename cache too
  const migrationCache = db.Model('openrecord_migrations');
  await migrationCache.deleteAll();

  console.log('database reset done, to setup again - npm run db:setup');
  db.close();
}

dropDatabase().catch((err) => {
  console.log(err);
});
