
// import data from v1 animeshot

const prompt = require('promptly');
const openrecord = require('openrecord/store/sqlite3');
const readlines = require('n-readlines');
const pinyin = require('pinyin');
const hepburn = require('hepburn');
const createDirectory = require('make-dir');
const delFiles = require('del');
const moveFile = require('move-file');

// helper function to romanize search input

function romanize (text) {
  // romanize hanzi into phonetic notation
  const textArray = pinyin(text, {
    style: pinyin.STYLE_TONE2
  });

  // flatten array
  // trim whitespace
  // lowercase letters
  // split non-han words
  // convert kana into romaji
  const textArrayFlatten = [];
  textArray.forEach(a => {
    if (a.length < 1) {
      return;
    }

    let words = a[0].trim().split(' ');
    words.forEach(s => {
      if (s.length < 1) {
        return;
      }

      if (!hepburn.containsKana(s)) {
        textArrayFlatten.push(s.toLowerCase());
        return;
      }

      textArrayFlatten.push(hepburn.fromKana(s).toLowerCase());
    });
  });

  // join array into a string
  const textRomanized = textArrayFlatten.join(' ');

  return textRomanized;
}

async function importDatabase () {
  const answer = await prompt.confirm('This will TRANSFORM AND INSERT LEGACY DATA into the animeshot database, only do this if you have backed up properly, PROCEED? (y/n)');

  if (!answer) {
    console.log('database import aborted');
    return;
  }

  if (process.argv.length != 3) {
    console.log('unsupported parameter, run it like this: npm run db:import -- file.json');
    return;
  }

  // load legacy data
  const filename = process.argv[2];
  const reader = new readlines(__dirname + '/../database/' + filename);
  const data = [];

  // parse data
  let line;
  while (line = reader.next()) {
    data.push(JSON.parse(line.toString('utf-8')));
  }

  console.log('found entries: ' + data.length);

  // connect to database
  const db = new openrecord({
    file: './database/animeshot.sqlite',
    autoLoad: true,
  });

  await db.ready();

  const userModel = db.Model('users');
  const shotModel = db.Model('shots');

  // create legacy user
  let user = await userModel.where({ username: 'legacy' }).first();

  if (!user) {
    user = await userModel.create({
      username: 'legacy',
      name: 'Legacy Import',
      created: new Date(),
      updated: new Date()
    });
  }

  // import legacy data, clean up legacy files
  let i = 0;
  while (i < data.length) {
    // insert into database
    let shot = {
      hash: data[i].sid,
      text: data[i].text,
      romanized: romanize(data[i].text),
      user_id: user.id,
      bookmark_count: 0,
      flag_count: 0,
      image_width: 1200,
      image_height: 0,
      created: Date.parse(data[i].created['$date']),
      updated: Date.parse(data[i].created['$date']),
      legacy: true
    };

    shot = await shotModel.create(shot);

    // create new folder for legacy files
    const folder = shot.hash.substring(shot.hash.length - 2);
    await createDirectory(__dirname + '/../public/uploads/legacy/' + folder);

    // process legacy files
    await moveFile(
      __dirname + '/../public/legacy/' + shot.hash + '.1200.jpg',
      __dirname + '/../public/uploads/legacy/' + folder + '/' + shot.hash + '.1200.jpg'
    );

    // clean up legacy files
    await delFiles([
      __dirname + '/../public/legacy/' + shot.hash + '.300.jpg',
      __dirname + '/../public/legacy/' + shot.hash + '.600.jpg',
      __dirname + '/../public/legacy/' + shot.hash + '.1200.jpg'
    ]);

    i++;

    if (i % 1000 == 0) {
      console.log('processing entry count: ' + i);
    }
  }

  console.log('database import done');
  db.close();
}

importDatabase().catch((err) => {
  console.log(err);
});
