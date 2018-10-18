
// app dependency

const telegraf = require('telegraf');
const openrecord = require('openrecord/store/sqlite3');
const pinyin = require('pinyin');
const hepburn = require('hepburn');

const defaultSettings = require(__dirname + '/animeshot-example.json');
const customSettings = require(__dirname + '/animeshot.json');
const settings = Object.assign({}, defaultSettings, customSettings);
const i18n = require(__dirname + '/i18n.json');
settings.site.i18n = i18n;

// create bot

const bot = new telegraf(settings.bot.telegram);

// define db models

const db = new openrecord({
  file: __dirname + '/database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

db.Model('users', function () {
  this.hasMany('shot', { model: 'shots', from: 'id', to: 'user_id' });
  this.hasMany('bookmark', { model: 'bookmarks', from: 'id', to: 'user_id' });
});

db.Model('shots', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
});

db.Model('bookmarks', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
  this.belongsTo('shot', { model: 'shots', from: 'shot_id', to: 'id' });
});

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

// search for shots by romanized text

async function searchShots (text, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ romanized_like: text }).order('created', true).limit(limit, offset);

  return shots;
}

async function findUserShots (user_id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ user_id: user_id }).order('created', true).limit(limit, offset);

  return shots;
}

async function findUserBookmarks (user_id, limit = 0, offset = 0) {
  const bookModel = db.Model('bookmarks');
  const books = await bookModel.where({ user_id: user_id }).order('created', true).limit(limit, offset).include('shot');

  return books;
}

async function findUserByTelegramId (id) {
  const userModel = db.Model('users');
  const user = await userModel.where({ telegram_id: id }).first();

  return user;
}

// bot logic

bot.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
  // query data
  const offset = parseInt(inlineQuery.offset) || 0;
  const search = inlineQuery.query;

  let tid;
  if (!inlineQuery.from || !inlineQuery.from.id) {
    tid = -1;
  } else {
    tid = parseInt(inlineQuery.from.id);
  }

  await db.ready();
  let shots;

  if (search == 'my') {
    // load user upload
    const user = await findUserByTelegramId(tid);
    if (user && user.id) {
      shots = await findUserShots(user.id, settings.bot.result_count, offset);
    }

  } else if (search == 'bm') {
    // load user bookmark
    const user = await findUserByTelegramId(tid);
    if (user && user.id) {
      const books = await findUserBookmarks(user.id, settings.bot.result_count, offset);

      // extract shot data from bookmark data
      shots = [];
      for (let i = 0; i < books.length; i++) {
        const bookFlatten = books[i].toJson();
        shots.push(bookFlatten.shot);
      }
    }

  } else {
    // search image by text
    const text = romanize(search);
    shots = await searchShots(text, settings.bot.result_count, offset);
  }

  // no result
  if (!shots || shots.length == 0) {
    return answerInlineQuery([], {
      next_offset: '',
      is_personal: settings.bot.is_personal,
      cache_time: settings.bot.cache_time
    });
  }

  // process data
  let shotArray;
  if (typeof shots.toJson == 'function') {
    shotArray = shots.toJson();
  } else {
    shotArray = shots;
  }

  const results = shotArray.map((shot) => {
    let output = {
      type: 'photo',
      id: shot.hash,
      caption: shot.text
    };

    // legacy file support
    if (!shot.legacy) {
      output.photo_url = settings.site.meta.base_url + '/uploads/' + shot.hash.substring(shot.hash.length - 2) + '/' + shot.hash + '.1080p.jpg';
      output.thumb_url = settings.site.meta.base_url + '/uploads/' + shot.hash.substring(shot.hash.length - 2) + '/' + shot.hash + '.720p.jpg';
      output.photo_width = 1920;
      output.photo_height = 1080;
    } else {
      output.photo_url = settings.site.meta.base_url + '/uploads/legacy/' + shot.hash.substring(shot.hash.length - 2) + '/' + shot.hash + '.1200.jpg';
      output.thumb_url = settings.site.meta.base_url + "/uploads/legacy/" + shot.hash.substring(shot.hash.length - 2) + '/' + shot.hash + '.1200.jpg';
      output.photo_width = 1200;
    }

    return output;
  });

  // result
  return answerInlineQuery(results, {
    next_offset: offset + settings.bot.result_count,
    is_personal: settings.bot.is_personal,
    cache_time: settings.bot.cache_time
  });
});

bot.startPolling();

bot.catch((err) => {
  console.error(err);
});
