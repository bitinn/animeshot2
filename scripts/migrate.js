
// setup sqlite database (each migration step will only run once)

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');

async function migrateDatabase () {
  const answer = await prompt.confirm('This will SETUP AND ALTER TABLES in the animeshot database to current version, make sure you have backed up the sqlite file, PROCEED? (y/n)');

  if (!answer) {
    console.log('database setup and migration aborted');
    return;
  }

  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true,
    migrations: [
      require('../migrations/database_migration_r0'),
      require('../migrations/database_migration_r1'),
      require('../migrations/database_migration_r2'),
      require('../migrations/database_migration_r3'),
      require('../migrations/database_migration_r4'),
      require('../migrations/database_migration_r5'),
      require('../migrations/database_migration_r6'),
      require('../migrations/database_migration_r7'),
      require('../migrations/database_migration_r8'),
    ]
  });

  await db.ready();

  console.log('database setup and migration done');
  db.close();
}

migrateDatabase().catch((err) => {
  console.log(err);
});
