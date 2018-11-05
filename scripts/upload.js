
// toggle user upload capability

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');

async function toggleUpload () {
  const answer = await prompt.confirm('This will TOGGLE UPLOAD FLAG for the username specified, PROCEED? (y/n)');

  if (!answer) {
    console.log('toggle upload aborted');
    return;
  }

  if (process.argv.length != 3) {
    console.log('unsupported parameter, run it like this: npm run db:upload -- username');
    return;
  }

  const username = process.argv[2];

  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true
  });

  await db.ready();

  // toggle a user's upload flag
  const userModel = db.Model('users');
  const user = await userModel.where({ username: username }).first();

  if (!user) {
    console.log('user not found');
    return;
  }

  user.can_upload = !user.can_upload;
  await user.save();

  console.log('toggle upload flag done: ' + username + (user.can_upload ? ' can now upload new shots' : ' can no longer upload new shots'));
  db.close();
}

toggleUpload().catch((err) => {
  console.log(err);
});
