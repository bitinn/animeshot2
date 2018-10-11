
// app dependency

const openrecord = require('openrecord/store/sqlite3');
const request = require('request');
const promise = Promise;
const purest = require('purest')({ request, promise });
const providers = require('@purest/providers');
const pinyin = require('pinyin');
const hepburn = require('hepburn');

// define database

const db = new openrecord({
  file: './database/animeshot.sqlite',
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
});

db.Model('flags', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
  this.belongsTo('shot', { model: 'shots', from: 'shot_id', to: 'id' });
});

// define oauth sign-in

const githubAPI = purest({ provider: 'github', config: providers });
const twitterAPI = purest({ provider: 'twitter', config: providers });

// workaround: disable custom inspect function when using console.log()

const util = require('util');
util.inspect.defaultOptions.customInspect = false;

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
  // find it in database
  const userModel = db.Model('users');
  const user = await userModel.where({ username: username }).first();

  return user;
}

async function findShot (id) {
  const shotModel = db.Model('shots');
  const shot = await shotModel.find(id);

  return shot;
}

async function findRecentShots (id, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.order('created', true).limit(limit, offset).include(['user', 'bookmark', 'flag']).where({ bookmark: { user_id: id }, flag: { user_id: id } });

  return shots;
}

async function findTopShots (limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ bookmark_count_gt: 0 }).order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function findFlagShots (limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ flag_count_gt: 0 }).order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function findUserShots (id = 0, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ user_id: id }).order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function findUserBookmarks (id = 0, limit = 0, offset = 0) {
  const bookModel = db.Model('bookmarks');
  const books = await bookModel.where({ user_id: id }).order('created', true).limit(limit, offset).include('shot');

  return books;
}

async function findUserFlags (id = 0, limit = 0, offset = 0) {
  const flagModel = db.Model('flags');
  const flags = await flagModel.where({ user_id: id }).order('created', true).limit(limit, offset).include('shot');

  return flags;
}

async function countShots () {
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

async function searchShots (text, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ romanized_like: text }).order('created', true).limit(limit, offset).include('user');

  return shots;
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

//
// define routes
//

module.exports = function setupRouter (router, settings) {
  //
  // index page
  //
  router.get('/', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(user.id, 4, 0);

    // toJson flatten db result into plain object
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/index',
      }
    };
  
    await ctx.render('page-index', data);
  });

  //
  // recent shots
  //
  router.get('/recent', async (ctx) => {
    await db.ready();
    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(user.id, 10, 10 * (page - 1));
    const count = await countShots();

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/recent',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // recent shots paging
  //
  router.get('/recent/:page', async (ctx) => {
    // validate page number
    const page = parseInt(ctx.request.params.page);
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/recent');
      return;
    }

    await db.ready();
    const count = await countShots();

    if ((page - 1) * 10 > count) {
      ctx.redirect('/recent');
      return;
    }

    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(user.id, 10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/recent',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // top shots
  //
  router.get('/top', async (ctx) => {
    await db.ready();
    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await findTopShots(10, 10 * (page - 1));
    const count = await countTopShots();

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/top',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // top shots paging
  //
  router.get('/top/:page', async (ctx) => {
    const page = parseInt(ctx.request.params.page);
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/top');
      return;
    }

    await db.ready();
    const count = await countTopShots();

    if ((page - 1) * 10 > count) {
      ctx.redirect('/top');
      return;
    }

    const user = await findCurrentUser(ctx);
    const shots = await findTopShots(10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/top',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // manage shots
  //
  router.get('/management', async (ctx) => {
    await db.ready();
    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await findFlagShots(10, 10 * (page - 1));
    const count = await countFlagShots();

    console.log(user.is_mod);

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/management',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // manage shots paging
  //
  router.get('/management/:page', async (ctx) => {
    const page = parseInt(ctx.request.params.page);
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/management');
      return;
    }

    await db.ready();
    const count = await countFlagShots();

    if ((page - 1) * 10 > count) {
      ctx.redirect('/management');
      return;
    }

    const user = await findCurrentUser(ctx);
    const shots = await findFlagShots(10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/management',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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

    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await findUserShots(profile.id, 10, 10 * (page - 1));
    const count = await countUserShots(profile.id);

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/user/' + username,
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/user/' + username);
      return;
    }

    const count = await countUserShots(profile.id);
    if ((page - 1) * 10 > count) {
      ctx.redirect('/user/' + username);
      return;
    }

    const user = await findCurrentUser(ctx);
    const shots = await findUserShots(profile.id, 10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/user/' + username,
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });

  //
  // user bookmarks (not used)
  //
  /*
  router.get('/user/:username/bookmarks', async (ctx) => {
    const username = ctx.request.params.username;

    await db.ready();
    const profile = await findUserByName(username);

    if (!profile) {
      ctx.redirect('/');
      return;
    }

    const page = 1;
    const user = await findCurrentUser(ctx);
    const books = await findUserBookmarks(profile.id, 10, 10 * (page - 1));
    const count = await countUserBookmarks(profile.id);

    // extract shot data from bookmark data
    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    // since shot data is flatten already, just use it
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/user/' + username + '/bookmarks',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });
  */

  //
  // user bookmarks paging (not used)
  //
  /*
  router.get('/user/:username/bookmarks/:page', async (ctx) => {
    const username = ctx.request.params.username;

    await db.ready();
    const profile = await findUserByName(username);

    if (!profile) {
      ctx.redirect('/');
      return;
    }

    const page = parseInt(ctx.request.params.page);
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/user/' + username + '/bookmarks');
      return;
    }

    const count = await countUserBookmarks(profile.id);
    if ((page - 1) * 10 > count) {
      ctx.redirect('/user/' + username + '/bookmarks');
      return;
    }

    const user = await findCurrentUser(ctx);
    const books = await findUserBookmarks(profile.id, 10, 10 * (page - 1));

    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/user/' + username + '/bookmarks',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
    await ctx.render('page-recent', data);
  });
  */

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

    const page = 1;
    const shots = await findUserShots(user.id, 10, 10 * (page - 1));
    const count = await countUserShots(user.id);

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/my',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/my');
      return;
    }

    const count = await countUserShots(user.id);
    if ((page - 1) * 10 > count) {
      ctx.redirect('/my');
      return;
    }

    const shots = await findUserShots(user.id, 10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/my',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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

    const page = 1;
    const books = await findUserBookmarks(user.id, 10, 10 * (page - 1));
    const count = await countUserBookmarks(user.id);

    // extract shot data from bookmark data
    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    // since shot data is flatten already, just use it
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/my/bookmarks',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/my/bookmarks');
      return;
    }

    const count = await countUserBookmarks(user.id);
    if ((page - 1) * 10 > count) {
      ctx.redirect('/my/bookmarks');
      return;
    }

    const books = await findUserBookmarks(user.id, 10, 10 * (page - 1));

    const shots = [];
    for (let i = 0; i < books.length; i++) {
      const bookFlatten = books[i].toJson();
      shots.push(bookFlatten.shot);
    }

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/my/bookmarks',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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

    const page = 1;
    const flags = await findUserFlags(user.id, 10, 10 * (page - 1));
    const count = await countUserFlags(user.id);

    // extract shot data from flag data
    const shots = [];
    for (let i = 0; i < flags.length; i++) {
      const bookFlatten = flags[i].toJson();
      shots.push(bookFlatten.shot);
    }

    // since shot data is flatten already, just use it
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/my/flags',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/my/flags');
      return;
    }

    const count = await countUserFlags(user.id);
    if ((page - 1) * 10 > count) {
      ctx.redirect('/my/flags');
      return;
    }

    const flags = await findUserFlags(user.id, 10, 10 * (page - 1));

    const shots = [];
    for (let i = 0; i < flags.length; i++) {
      const bookFlatten = flags[i].toJson();
      shots.push(bookFlatten.shot);
    }

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots,
      paging: {
        name: '/my/flags',
        current: page,
        max: Math.ceil(count / 10)
      }
    };
  
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
  
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang]
    };
  
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

    ctx.redirect('/search/' + query);
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

    // romanize hanzi into phonetic notation
    const searchArray = pinyin(search, {
      style: pinyin.STYLE_TONE2,
      segment: true
    });

    // flatten array, trim whitespace, split non-han words, convert kana into romaji
    const searchWords = [];
    searchArray.forEach(a => {
      if (a.length < 1) {
        return;
      }

      let words = a[0].trim().split(' ');
      words.forEach(s => {
        if (s.length < 1) {
          return;
        }

        if (!hepburn.containsKana(s)) {
          searchWords.push(s.toLowerCase());
          return;
        }

        searchWords.push(hepburn.fromKana(s).toLowerCase());
      });
    });

    // join into a search string
    const text = searchWords.join(' ');

    await db.ready();
    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await searchShots(text, 10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/search/' + search,
        current: page
      },
      search: search
    };
  
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
    if (isNaN(page) || page < 2 || page != ctx.request.params.page) {
      ctx.redirect('/search/' + search);
      return;
    }

    const searchArray = pinyin(search, {
      style: pinyin.STYLE_TONE2,
      segment: true
    });

    const searchWords = [];
    searchArray.forEach(a => {
      if (a.length < 1) {
        return;
      }

      let words = a[0].trim().split(' ');
      words.forEach(s => {
        if (s.length < 1) {
          return;
        }

        if (!hepburn.containsKana(s)) {
          searchWords.push(s.toLowerCase());
          return;
        }

        searchWords.push(hepburn.fromKana(s).toLowerCase());
      });
    });

    const text = searchWords.join(' ');

    await db.ready();
    const user = await findCurrentUser(ctx);
    const shots = await searchShots(text, 10, 10 * (page - 1));

    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : [],
      paging: {
        name: '/search/' + search,
        current: page
      }
    };
  
    await ctx.render('page-search', data);
  });

  //
  // create bookmark
  //
  router.post('/action/bookmark', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);

    // not login, go there
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

    // delete if found
    if (bookmark != null) {
      await deleteBookmark(bookmark, shot);

    // create if none
    } else {
      await createBookmark(user, shot);
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

    // delete if found
    if (flag != null) {
      await deleteFlag(flag, shot);

    // create if none
    } else {
      await createFlag(user, shot);
    }

    ctx.redirect('back');
  });

  //
  // oauth callback
  //
  router.get(settings.oauth.server.callback, async (ctx) => {
    // no session data
    if (!ctx.session || !ctx.session.grant) {
      ctx.redirect('/');
      return;
    }
  
    // missing token, no response or unsupported provider
    const oauthResult = ctx.session.grant;
    if (!settings.oauth[oauthResult.provider] || !oauthResult.response || !oauthResult.response.access_token) {
      ctx.redirect('/');
      return;
    }
  
    // fetch remote user profile
    const requestOptions = {
      headers: { 'User-Agent': 'animeshot/1.0' }
    };
  
    let fetchProfile;
    if (oauthResult.provider == 'github') {
      fetchProfile = githubAPI.get('user').auth(oauthResult.response.access_token).options(requestOptions).request();
  
    } else if (oauthResult.provider == 'twitter') {
      fetchProfile = await twitterAPI.get('account/verify_credentials').auth(oauthResult.response.access_token, oauthResult.response.access_secret).options(requestOptions).request();
    }
  
    const userProfile = await fetchProfile.then((result) => {
      return result[1];
    });
  
    // find or create it in database
    await db.ready();
    const userModel = db.Model('users');
  
    let localUser;
    if (oauthResult.provider == 'github') {
      localUser = await userModel.where({ 'github_id': userProfile.id }).first();
    } else if (oauthResult.provider == 'twitter') {
      localUser = await userModel.where({ 'twitter_id': userProfile.id }).first();
    }
  
    if (!localUser) {
      let newUser;
      if (oauthResult.provider == 'github') {
        newUser = {
          username: userProfile.login,
          name: userProfile.name,
          github_id: userProfile.id,
          github_avatar: userProfile.avatar_url,
          created: new Date(),
          updated: new Date()
        };
      } else if (oauthResult.provider == 'twitter') {
        newUser = {
          username: userProfile.screen_name,
          name: userProfile.name,
          twitter_id: userProfile.id,
          twitter_avatar: userProfile.profile_image_url_https,
          created: new Date(),
          updated: new Date()
        };
      }
  
      localUser = await userModel.create(newUser);
    }
  
    // update session cookie
    ctx.session = { user: { id: localUser.id } };
    ctx.redirect('/');
  });

  return router;

}
