
// generate seed data on sqlite database (you can run it multiple times)

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');

async function toggleMod () {
  const answer = await prompt.confirm('This will TOGGLE MOD FLAG for the username specified, PROCEED? (y/n)');

  if (!answer) {
    console.log('toggle mod aborted');
    return;
  }

  if (process.argv.length != 3) {
    console.log('unsupported parameter, run it like this: npm run db:mod -- username');
    return;
  }

  const username = process.argv[2];

  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true
  });

  await db.ready();

  // toggle a user's mod flag
  const userModel = db.Model('users');
  const user = await userModel.where({ username: username }).first();

  if (!user) {
    console.log('user not found');
    return;
  }

  user.is_mod = !user.is_mod;
  await user.save();

  console.log('toggle mod done: ' + username + (user.is_mod ? ' is now a mod' : ' is no longer a mod'));
  db.close();
}

toggleMod().catch((err) => {
  console.log(err);
});
