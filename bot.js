
// app dependency

const telegraf = require('telegraf');
const openrecord = require('openrecord/store/sqlite3');
const pinyin = require('pinyin');
const hepburn = require('hepburn');

const settings = require('./animeshot.json');

// create bot

const bot = new telegraf(settings.bot.telegram);

// define db models

const db = new openrecord({
  file: './database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

db.Model('users', function () {
  this.hasMany('shot', { model: 'shots', from: 'id', to: 'user_id' });
});

db.Model('shots', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
});

// helper function to romanize search input

function romanize (text) {
  // romanize hanzi into phonetic notation
  const textArray = pinyin(text, {
    style: pinyin.STYLE_TONE2,
    segment: true
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

// bot logic

bot.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
  const offset = parseInt(inlineQuery.offset) || 0;
  const search = inlineQuery.query;
  const text = romanize(search);
  const shots = await searchShots(text, 20, offset);

  if (!shots) {
    return answerInlineQuery([], { next_offset: '' });
  }

  const shotArray = shots.toJson();
  const results = shotArray.map((shot) => {
    return {
      type: 'photo',
      id: shot.hash,
      photo_url: meta.base_url + "/uploads/" + shot.hash.substring(shot.hash.length - 2) + "/" + shot.hash + ".1080p.jpg",
      thumb_url: meta.base_url + "/uploads/" + shot.hash.substring(shot.hash.length - 2) + "/" + shot.hash + ".720p.jpg",
      photo_width: shot.image_width,
      photo_height: shot.image_height,
      caption: shot.text + "\r\n[" + meta.base_url + "/shot/" + shot.hash + "](source)",
      parse_mode: 'Markdown'
    }
  });

  return answerInlineQuery(results, { next_offset: offset + 20 });
});

bot.startPolling();

bot.catch((err) => {
  console.error(err);
});
