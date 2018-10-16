
// app dependency

const openrecord = require('openrecord/store/sqlite3');
const request = require('request');
const promise = Promise;
const purest = require('purest')({ request, promise });
const providers = require('@purest/providers');
const pinyin = require('pinyin');
const hepburn = require('hepburn');
const sharp = require('sharp');
const cuid = require('cuid');
const createDirectory = require('make-dir');
const delFiles = require('del');

const defaultSettings = require(__dirname + '/animeshot-example.json');
const customSettings = require(__dirname + '/animeshot.json');
const settings = Object.assign({}, defaultSettings, customSettings);
const i18n = require(__dirname + '/i18n.json');
settings.site.i18n = i18n;

// define models

const db = new openrecord({
  file: __dirname + '/database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

db.Model('users', function () {
  this.hasMany('shot', { model: 'shots', from: 'id', to: 'user_id' });
  this.hasMany('bookmark', { model: 'bookmarks', from: 'id', to: 'user_id' });
  this.hasMany('flag', { model: 'flags', from: 'id', to: 'user_id' });
});

db.Model('shots', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
  this.hasMany('bookmark', { model: 'bookmarks', from: 'id', to: 'shot_id' });
  this.hasMany('flag', { model: 'flags', from: 'id', to: 'shot_id' });
});

db.Model('bookmarks', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
  this.belongsTo('shot', { model: 'shots', from: 'shot_id', to: 'id' });
  this.belongsTo('bookmark', { through: 'shot', relation: 'bookmark' });
  this.belongsTo('flag', { through: 'shot', relation: 'flag' });
});

db.Model('flags', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
  this.belongsTo('shot', { model: 'shots', from: 'shot_id', to: 'id' });
  this.belongsTo('bookmark', { through: 'shot', relation: 'bookmark' });
  this.belongsTo('flag', { through: 'shot', relation: 'flag' });
  this.belongsTo('shot_user', { through: 'shot', relation: 'user' });
});

// define oauth sign-in

const githubAPI = purest({ provider: 'github', config: providers });
const twitterAPI = purest({ provider: 'twitter', config: providers, key: settings.oauth.twitter.key, secret: settings.oauth.twitter.secret });

// workaround: disable custom inspect function when using console log

const util = require('util');
util.inspect.defaultOptions.customInspect = false;

//
// helper functions
//

function renderData (ctx, customData) {
  // allow custom data to overwrite default data
  return Object.assign({
    meta: settings.site.meta,
    i18n: settings.site.i18n[settings.site.meta.lang],
    service: settings.site.service,
    csrf: ctx.csrf,
    page: {}
  }, customData);
}

function isValidPageNumber (current, max) {
  if (isNaN(current) || !Number.isInteger(current) || current < 2 || current > max + 1) {
    return false;
  }

  return true;
}

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

//
// database helper functions
//

async function findCurrentUser (ctx) {
  // no session data
  if (!ctx.session || !ctx.session.user || !ctx.session.user.id) {
    return null;
  }

  // find it in database
  const userModel = db.Model('users');
  const currentUser = await userModel.find(ctx.session.user.id);

  return currentUser;
}

async function findUserByName (username) {
  const userModel = db.Model('users');
  const user = await userModel.where({ username: username }).first();

  return user;
}

async function findShot (id) {
  const shotModel = db.Model('shots');
  const shot = await shotModel.find(id);

  return shot;
}

async function findShotByHash (hash, id) {
  const shotModel = db.Model('shots');
  const shot = await shotModel.where({ hash: hash }).first().include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shot;
}

async function findRecentShots (id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function findTopShots (id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ bookmark_count_gt: 0 }).order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function findFlagShots (id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ flag_count_gt: 0 }).order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function findUserShots (user_id, login_id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ user_id: user_id }).order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: login_id }, flag: { user_id: login_id } });

  return shots;
}

async function findUserBookmarks (user_id, login_id, limit = 0, offset = 0) {
  const bookModel = db.Model('bookmarks');
  const books = await bookModel.where({ user_id: user_id }).order('created', true).limit(limit, offset).include({ 'shot': ['bookmark', 'flag', 'user'] }).where({ bookmark: { user_id: login_id }, flag: { user_id: login_id } });

  return books;
}

async function findUserFlags (user_id, login_id, limit = 0, offset = 0) {
  const flagModel = db.Model('flags');
  const flags = await flagModel.where({ user_id: user_id }).order('created', true).limit(limit, offset).include({ 'shot': ['bookmark', 'flag', 'user'] }).where({ bookmark: { user_id: login_id }, flag: { user_id: login_id } });

  return flags;
}

async function searchShots (text, id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ romanized_like: text }).order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function duplicateShots (text, id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ romanized: text, created_gt: new Date() - 86400 * 7 * 1000 }).order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function countRecentShots () {
  const shotModel = db.Model('shots');
  const count = await shotModel.count();

  return count;
}

async function countTopShots () {
  const shotModel = db.Model('shots');
  const count = await shotModel.where({ bookmark_count_gt: 0 }).count();

  return count;
}

async function countFlagShots () {
  const shotModel = db.Model('shots');
  const count = await shotModel.where({ flag_count_gt: 0 }).count();

  return count;
}

async function countUserShots (id = 0) {
  const shotModel = db.Model('shots');
  const count = await shotModel.where({ user_id: id }).count();

  return count;
}

async function countUserBookmarks (id = 0) {
  const bookModel = db.Model('bookmarks');
  const count = await bookModel.where({ user_id: id }).count();

  return count;
}

async function countUserFlags (id = 0) {
  const flagModel = db.Model('flags');
  const count = await flagModel.where({ user_id: id }).count();

  return count;
}

async function findBookmark (user, shot) {
  const bookModel = db.Model('bookmarks');
  const bookmark = await bookModel.where({ user_id: user.id, shot_id: shot.id }).first();

  return bookmark;
}

async function createBookmark (user, shot) {
  let bookmark = {
    user_id: user.id,
    shot_id: shot.id,
    created: new Date(),
    updated: new Date()
  };

  const bookModel = db.Model('bookmarks');
  bookmark = await bookModel.create(bookmark);

  shot.bookmark_count = shot.bookmark_count + 1;
  await shot.save();

  return bookmark;
}

async function deleteBookmark (bookmark, shot) {
  await bookmark.delete();

  shot.bookmark_count = shot.bookmark_count - 1;
  if (shot.bookmark_count < 0) {
    shot.bookmark_count = 0;
  }

  await shot.save();
}

async function deleteBookmarkByShot (shot) {
  const bookModel = db.Model('bookmarks');
  await bookModel.where({ shot_id: shot.id }).deleteAll();
}

async function findFlag (user, shot) {
  const flagModel = db.Model('flags');
  const flag = await flagModel.where({ user_id: user.id, shot_id: shot.id }).first();

  return flag;
}

async function createFlag (user, shot) {
  let flag = {
    user_id: user.id,
    shot_id: shot.id,
    created: new Date(),
    updated: new Date()
  };

  const flagModel = db.Model('flags');
  flag = await flagModel.create(flag);

  shot.flag_count = shot.flag_count + 1;
  await shot.save();

  return flag;
}

async function deleteFlag (flag, shot) {
  await flag.delete();

  shot.flag_count = shot.flag_count - 1;
  if (shot.flag_count < 0) {
    shot.flag_count = 0;
  }

  await shot.save();
}

async function deleteFlagByShot (shot) {
  const flagModel = db.Model('flags');
  await flagModel.where({ shot_id: shot.id }).deleteAll();
}

async function findOAuthUser (oauthResult, userProfile) {
  const userModel = db.Model('users');
  
  let localUser;
  if (oauthResult.provider == 'github') {
    localUser = await userModel.where({ 'github_id': userProfile.id }).first();
  } else if (oauthResult.provider == 'twitter') {
    localUser = await userModel.where({ 'twitter_id': userProfile.id }).first();
  }

  return localUser;
}

async function createUser (oauthResult, userProfile) {
  let newUser;
  const userModel = db.Model('users');

  if (oauthResult.provider == 'github') {
    newUser = {
      username: cuid(),
      name: userProfile.name,
      github_id: userProfile.id,
      github_avatar: userProfile.avatar_url,
      github_username: userProfile.login,
      created: new Date(),
      updated: new Date()
    };
  } else if (oauthResult.provider == 'twitter') {
    newUser = {
      username: cuid(),
      name: userProfile.name,
      twitter_id: userProfile.id,
      twitter_avatar: userProfile.profile_image_url_https,
      twitter_username: userProfile.screen_name,
      created: new Date(),
      updated: new Date()
    };
  }

  newUser = await userModel.create(newUser);
  return newUser;
}

async function createShot (shot) {
  const shotModel = db.Model('shots');
  shot = await shotModel.create(shot);

  return shot;
}

//
// define routes
//

module.exports = function setupRouter (router) {
  //
  // index page
  //
  router.get('/', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findRecentShots(id, 4, 0);

    const loginSuccess = ctx.flash('login-success');
    const loginError = ctx.flash('login-error');
    const uploadSuccess = ctx.flash('upload-success');
    const uploadError = ctx.flash('upload-error');

    // flash message handling
    let flash = null;
    if (loginSuccess.length > 0) {
      flash = {
        type: 'login-success',
        message: loginSuccess[0]
      }
    } else if (loginError.length > 0) {
      flash = {
        type: 'login-error',
        message: loginError[0]
      }
    } else if (uploadSuccess.length > 0) {
      flash = {
        type: 'upload-success',
        message: uploadSuccess[0]
      }
    } else if (uploadError.length > 0) {
      flash = {
        type: 'upload-error',
        message: uploadError[0]
      }
    }

    // toJson flatten db result into plain object
    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      flash: flash,
      page: {
        path: '/index'
      }
    });

    // generate route specific page title
    data.page.name = data.meta.tagline;

    await ctx.render('page-index', data);
  });

  //
  // shot page
  //
  router.get('/shot/:hash', async (ctx) => {
    const hash = ctx.request.params.hash;

    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shot = await findShotByHash(hash, id);

    if (!shot) {
      ctx.redirect('/');
      return;
    }

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shot: shot.toJson(),
      page: {
        path: '/shot/' + hash
      }
    });

    data.page.name = data.shot.text;

    await ctx.render('page-shot', data);
  });

  //
  // recent shots
  //
  router.get('/recent', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findRecentShots(id, 10, 0);
    const count = await countRecentShots();

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/recent',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.recent;
  
    await ctx.render('page-recent', data);
  });

  //
  // recent shots paging
  //
  router.get('/recent/:page', async (ctx) => {
    await db.ready();
    const count = await countRecentShots();
    const max = Math.ceil(count / 10);

    // validate page number
    const page = parseInt(ctx.request.params.page);
    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/recent');
      return;
    }

    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findRecentShots(id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/recent',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.recent;

    await ctx.render('page-recent', data);
  });

  //
  // top shots
  //
  router.get('/top', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findTopShots(id, 10, 0);
    const count = await countTopShots();

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/top',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.top;

    await ctx.render('page-recent', data);
  });

  //
  // top shots paging
  //
  router.get('/top/:page', async (ctx) => {
    await db.ready();
    const count = await countTopShots();
    const max = Math.ceil(count / 10);

    const page = parseInt(ctx.request.params.page);
    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/top');
      return;
    }

    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findTopShots(id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/top',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.top;

    await ctx.render('page-recent', data);
  });

  //
  // manage shots
  //
  router.get('/management', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    // must be a moderator to see this page
    if (!user || !user.is_mod) {
      ctx.redirect('/');
      return;
    }

    const id = user ? user.id : -1;
    const shots = await findFlagShots(id, 10, 0);
    const count = await countFlagShots();

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/management',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.manage;

    await ctx.render('page-recent', data);
  });

  //
  // manage shots paging
  //
  router.get('/management/:page', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user || !user.is_mod) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    const count = await countFlagShots();
    const max = Math.ceil(count / 10);

    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/management');
      return;
    }

    const id = user ? user.id : -1;
    const shots = await findFlagShots(id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/management',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.manage;

    await ctx.render('page-recent', data);
  });

  //
  // user profile
  //
  router.get('/user/:username', async (ctx) => {
    const username = ctx.request.params.username;

    await db.ready();
    const profile = await findUserByName(username);

    if (!profile) {
      ctx.redirect('/');
      return;
    }

    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findUserShots(profile.id, id, 10, 0);
    const count = await countUserShots(profile.id);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/user/' + username,
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = profile.name;

    await ctx.render('page-recent', data);
  });

  //
  // user profile paging
  //
  router.get('/user/:username/:page', async (ctx) => {
    const username = ctx.request.params.username;

    await db.ready();
    const profile = await findUserByName(username);

    if (!profile) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    const count = await countUserShots(profile.id);
    const max = Math.ceil(count / 10);

    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/user/' + username);
      return;
    }

    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await findUserShots(profile.id, id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/user/' + username,
        current: page,
        max: max
      }
    });

    data.page.name = profile.name;
  
    await ctx.render('page-recent', data);
  });

  //
  // my profile
  //
  router.get('/my', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const shots = await findUserShots(user.id, user.id, 10, 0);
    const count = await countUserShots(user.id);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/my',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.my;

    await ctx.render('page-recent', data);
  });

  //
  // my profile paging
  //
  router.get('/my/:page', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    const count = await countUserShots(user.id);
    const max = Math.ceil(count / 10);

    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/my');
      return;
    }

    const shots = await findUserShots(user.id, user.id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      page: {
        path: '/my',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.my;

    await ctx.render('page-recent', data);
  });

  //
  // my bookmark
  //
  router.get('/my/bookmarks', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const books = await findUserBookmarks(user.id, user.id, 10, 0);
    const count = await countUserBookmarks(user.id);

    // extract shot data from bookmark data
    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    // since shot data is flatten already, just use it
    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots,
      page: {
        path: '/my/bookmarks',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.bookmarks;

    await ctx.render('page-recent', data);
  });

  //
  // my bookmark paging
  //
  router.get('/my/bookmarks/:page', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    const count = await countUserBookmarks(user.id);
    const max = Math.ceil(count / 10);

    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/my/bookmarks');
      return;
    }

    const books = await findUserBookmarks(user.id, user.id, 10, 10 * (page - 1));

    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots,
      page: {
        path: '/my/bookmarks',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.bookmarks;

    await ctx.render('page-recent', data);
  });

  //
  // my flag
  //
  router.get('/my/flags', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const flags = await findUserFlags(user.id, user.id, 10, 0);
    const count = await countUserFlags(user.id);

    // extract shot data from flag data
    const shots = [];
    for (let i = 0; i < flags.length; i++) {
      const bookFlatten = flags[i].toJson();
      shots.push(bookFlatten.shot);
    }

    // since shot data is flatten already, just use it
    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots,
      page: {
        path: '/my/flags',
        current: 1,
        max: Math.ceil(count / 10)
      }
    });

    data.page.name = data.i18n.flags;

    await ctx.render('page-recent', data);
  });

  //
  // my flag paging
  //
  router.get('/my/flags/:page', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    const count = await countUserFlags(user.id);
    const max = Math.ceil(count / 10);

    if (!isValidPageNumber(page, max)) {
      ctx.redirect('/my/flags');
      return;
    }

    const flags = await findUserFlags(user.id, user.id, 10, 10 * (page - 1));

    const shots = [];
    for (let i = 0; i < flags.length; i++) {
      const bookFlatten = flags[i].toJson();
      shots.push(bookFlatten.shot);
    }

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots,
      page: {
        path: '/my/flags',
        current: page,
        max: max
      }
    });

    data.page.name = data.i18n.flags;

    await ctx.render('page-recent', data);
  });

  //
  // login page
  //
  router.get('/login', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    // already login
    if (user != null) {
      ctx.redirect('/');
      return;
    }

    const data = renderData(ctx, {});
    data.page.name = data.i18n.login;

    await ctx.render('page-login', data);
  });

  //
  // logout page
  //
  router.get('/logout', async (ctx) => {
    ctx.session = null;
    ctx.redirect('/');
  });

  //
  // search redirect
  //
  router.get('/search', async (ctx) => {
    const query = ctx.request.query.q;

    if (!query) {
      ctx.redirect('/');
      return;
    }

    ctx.redirect('/search/' + encodeURIComponent(query));
  });

  //
  // search page
  //
  router.get('/search/:keyword', async (ctx) => {
    const search = ctx.request.params.keyword;

    if (!search) {
      ctx.redirect('/');
      return;
    }

    // romanize search string
    const text = romanize(search);

    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await searchShots(text, id, 10, 0);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      search: search,
      page: {
        path: '/search/' + search,
        current: 1
      }
    });

    data.page.name = data.i18n.search;

    await ctx.render('page-search', data);
  });

  //
  // search paging
  //
  router.get('/search/:keyword/:page', async (ctx) => {
    const search = ctx.request.params.keyword;

    if (!search) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);

    if (!isValidPageNumber(page, 1000000)) {
      ctx.redirect('/search/' + search);
      return;
    }

    const text = romanize(search);

    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await searchShots(text, id, 10, 10 * (page - 1));

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      search: search,
      page: {
        path: '/search/' + search,
        current: page
      }
    });

    data.page.name = data.i18n.search;

    await ctx.render('page-search', data);
  });

  //
  // duplicate page
  //
  router.get('/duplicate/:keyword', async (ctx) => {
    const search = ctx.request.params.keyword;
    const uploadError = ctx.flash('upload-error');

    if (!search) {
      ctx.redirect('/');
      return;
    }

    let flash;
    if (uploadError.length > 0) {
      flash = {
        type: 'upload-error',
        message: uploadError[0]
      };
    }

    // romanize search string
    const text = romanize(search);

    await db.ready();
    const user = await findCurrentUser(ctx);
    const id = user ? user.id : -1;
    const shots = await duplicateShots(text, id, 4, 0);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      flash: flash,
      page: {
        path: '/duplicate/' + search
      }
    });

    await ctx.render('page-index', data);
  });

  //
  // create bookmark
  //
  router.post('/action/bookmark', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    // not login
    if (!user) {
      ctx.redirect('/login');
      return;
    }

    // find shot
    const id = ctx.request.body.bookmark;
    const shot = await findShot(id);

    // shot not found
    if (!shot) {
      ctx.redirect('/');
      return;
    }

    // find bookmark
    const bookmark = await findBookmark(user, shot);

    // catch potential write error
    try {
      // delete if found
      if (bookmark != null) {
        await deleteBookmark(bookmark, shot);

      // create if none
      } else {
        await createBookmark(user, shot);
      }
    } catch (err) {
      console.error(err);
    }

    ctx.redirect('back');
  });

  //
  // create flag
  //
  router.post('/action/flag', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/login');
      return;
    }

    const id = ctx.request.body.flag;
    const shot = await findShot(id);

    if (!shot) {
      ctx.redirect('/');
      return;
    }

    // find flag
    const flag = await findFlag(user, shot);

    // catch potential write error
    try {
      // delete if found
      if (flag != null) {
        await deleteFlag(flag, shot);

      // create if none
      } else {
        await createFlag(user, shot);
      }
    } catch (err) {
      console.error(err);
    }

    ctx.redirect('back');
  });

  //
  // delete shot
  //
  router.post('/action/shot', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.redirect('/login');
      return;
    }

    const id = ctx.request.body.shot;
    const shot = await findShot(id);

    if (!shot) {
      ctx.redirect('/');
      return;
    }

    // must be a moderator or image owner to perform this
    if (!user.is_mod && shot.user_id != user.id) {
      ctx.redirect('/');
      return;
    }

    // catch potential write error
    try {
      // delete related bookmarks and flags
      await deleteFlagByShot(shot);
      await deleteBookmarkByShot(shot);

      // delete files
      const folder = shot.hash.substring(shot.hash.length - 2);

      if (!shot.legacy) {
        await delFiles([
          __dirname + '/public/uploads/' + folder + '/' + shot.hash + '.720p.jpg',
          __dirname + '/public/uploads/' + folder + '/' + shot.hash + '.1080p.jpg',
          __dirname + '/public/uploads/' + folder + '/' + shot.hash + '.1440p.jpg',
          __dirname + '/public/uploads/' + folder + '/' + shot.hash + '.2160p.jpg'
        ]);
      } else {
        await delFiles([
          __dirname + '/public/uploads/legacy/' + folder + '/' + shot.hash + '.1200.jpg'
        ]);
      }

      // delete actual shot
      await shot.delete();
    } catch (err) {
      console.error(err);
    }

    ctx.redirect('back');
  });

  //
  // upload shot
  //
  router.post('/action/upload', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    if (!user) {
      ctx.flash('upload-error', 'you must login first');
      ctx.redirect('/');
      return;
    }

    const shot = ctx.request.files.shot;
    const text = ctx.request.body.text;

    // both image and text must be available, text must have reasonable length
    if (!shot || shot.size < 100 || !text || text.length > 255) {
      ctx.flash('upload-error', 'image or text missing, or image size too small, or text length too long');
      ctx.redirect('/');
      return;
    }

    // check for duplicate text
    if (text.length > 4) {
      const search = romanize(text);
      const shots = await duplicateShots(search, user.id, 4, 0);

      if (shots.length > 1) {
        ctx.flash('upload-error', 'found duplicate images');
        ctx.redirect('/duplicate/' + encodeURIComponent(text));
        return;
      }
    }

    // create image hash
    const hash = cuid();
    const folder = hash.substring(hash.length - 2);

    // catch potential image processing error
    let data;
    try {
      await createDirectory(__dirname + '/public/uploads/' + folder);

      data = await sharp(shot.path).metadata();

      // size check
      if (data.width < 1280 || data.width > 5120 || data.height < 720 || data.height > 2880) {
        ctx.flash('upload-error', 'image size: ' + data.width + 'x' + data.height + ' out of range');
        ctx.redirect('/');
        return;
      }

      // generate images
      await sharp(shot.path).limitInputPixels(5120 * 2880).resize(1280, 720, {
        fit: 'outside'
      }).jpeg({
        quality: 95
      }).toFile(__dirname + '/public/uploads/' + folder + '/' + hash + '.720p.jpg');

      await sharp(shot.path).limitInputPixels(5120 * 2880).resize(1920, 1080, {
        fit: 'outside'
      }).jpeg({
        quality: 95
      }).toFile(__dirname + '/public/uploads/' + folder + '/' + hash + '.1080p.jpg');

      await sharp(shot.path).limitInputPixels(5120 * 2880).resize(2560, 1440, {
        fit: 'outside'
      }).jpeg({
        quality: 95
      }).toFile(__dirname + '/public/uploads/' + folder + '/' + hash + '.1440p.jpg');

      await sharp(shot.path).limitInputPixels(5120 * 2880).resize(3840, 2160, {
        fit: 'outside'
      }).jpeg({
        quality: 95
      }).toFile(__dirname + '/public/uploads/' + folder + '/' + hash + '.2160p.jpg');
    } catch (err) {
      console.error(err);
      ctx.flash('upload-error', 'image processing issue');
      ctx.redirect('/');
      return;
    }

    // now create the entry
    let shotEntry;
    try {
      shotEntry = {
        hash: hash,
        text: text,
        romanized: romanize(text),
        user_id: user.id,
        bookmark_count: 0,
        flag_count: 0,
        image_width: data.width,
        image_height: data.height,
        created: new Date(),
        updated: new Date()
      }

      shotEntry = await createShot(shotEntry);
    } catch (err) {
      console.error(err);
      ctx.flash('upload-error', 'database issue');
      ctx.redirect('/');
      return;
    }

    ctx.flash('upload-success', shotEntry.hash);
    ctx.redirect('/');
  });

  //
  // oauth callback
  //
  router.get(settings.oauth.server.callback, async (ctx) => {
    // no session data
    if (!ctx.session || !ctx.session.grant) {
      ctx.flash('login-error', 'missing session');
      ctx.redirect('/');
      return;
    }

    // missing token, no response or unsupported provider
    const oauthResult = ctx.session.grant;
    if (!settings.oauth[oauthResult.provider] || !oauthResult.response || !oauthResult.response.access_token) {
      ctx.flash('login-error', 'missing token or remote server issue');
      ctx.redirect('/');
      return;
    }

    // grant auth, then fetch remote user profile
    const requestOptions = {
      headers: { 'User-Agent': 'animeshot/2.0' }
    };

    let fetchProfile;
    try {
      if (oauthResult.provider == 'github') {
        fetchProfile = await githubAPI.get('user').auth(oauthResult.response.access_token).options(requestOptions).request();

      } else if (oauthResult.provider == 'twitter') {
        fetchProfile = await twitterAPI.get('account/verify_credentials').auth(oauthResult.response.access_token, oauthResult.response.access_secret).options(requestOptions).request();
      }
    } catch (err) {
      console.error(err);
    }

    if (!fetchProfile || fetchProfile.length != 2) {
      ctx.flash('login-error', 'fetch profile network error');
      ctx.redirect('/');
      return;
    }

    // [0] is full response, [1] is response body
    const userProfile = fetchProfile[1];

    if (!userProfile.id) {
      ctx.flash('login-error', 'remote profile id missing');
      ctx.redirect('/');
      return;
    }

    // find or create it in database
    await db.ready();
    let localUser = await findOAuthUser(oauthResult, userProfile);

    if (localUser) {
      // update session cookie
      ctx.session = { user: { id: localUser.id } };

      // update flash message
      ctx.flash('login-success', localUser.name);
      ctx.redirect('/');
      return;
    }

    try {
      localUser = await createUser(oauthResult, userProfile);
    } catch (err) {
      console.error(err);
      ctx.flash('login-error', 'username alraedy taken or database error');
      ctx.redirect('/');
      return;
    }

    ctx.session = { user: { id: localUser.id } };
    ctx.flash('login-success', localUser.name);
    ctx.redirect('/');
  });

  //
  // guides
  //
  router.get('/guide/content', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      page: {
        path: '/guide/content'
      }
    });

    await ctx.render('page-guide', data);
  });

  router.get('/guide/usage', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    const data = renderData(ctx, {
      user: user ? user.toJson() : null,
      page: {
        path: '/guide/usage'
      }
    });
  
    await ctx.render('page-guide', data);
  });

  //
  // done
  //
  return router;
}
