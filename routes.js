
// app dependency

const openrecord = require('openrecord/store/sqlite3');
const request = require('request');
const promise = Promise;
const purest = require('purest')({ request, promise });
const providers = require('@purest/providers');

// define database

const db = new openrecord({
  file: './database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

db.Model('users', function () {
  this.hasMany('shot', { to: 'user_id' });
  this.hasMany('note', { to: 'user_id' });
  this.hasMany('flag', { to: 'user_id' });
});

db.Model('shots', function () {
  this.belongsTo('user', { model: 'users', from: 'user_id', to: 'id' });
});

db.Model('notes', function () {
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

async function findRecentShots (limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function findTopShots (limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ note_count_gt: 0 }).order('note_count', true).order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function findUserShots (id = 0, limit = 0, offset = 0) {
  const shotModel = db.Model('shots');
  const shots = await shotModel.where({ user_id: id }).order('created', true).limit(limit, offset).include('user');

  return shots;
}

async function countShots () {
  const shotModel = db.Model('shots');
  const count = await shotModel.count();

  return count;
}

async function countUserShots (id = 0) {
  const shotModel = db.Model('shots');
  const count = await shotModel.where({ user_id: id }).count();

  return count;
}

async function countTopShots () {
  const shotModel = db.Model('shots');
  const count = await shotModel.where({ note_count_gt: 0 }).count();

  return count;
}

//
// define routes
//

module.exports = function setupRouter (router, settings) {
  ////// index page
  router.get('/', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(4, 0);

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

  ////// recent shots
  router.get('/recent', async (ctx) => {
    await db.ready();
    const page = 1;
    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(10, 10 * (page - 1));
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

  ////// recent shots paging
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
    const shots = await findRecentShots(10, 10 * (page - 1));

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

  ////// top shots
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

  ////// top shots paging
  router.get('/top/:page', async (ctx) => {
    // validate page number
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

  ////// my profile
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

    // toJson flatten db result into plain object
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

  ////// my profile paging
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

    // toJson flatten db result into plain object
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

  ////// user profile
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

    // toJson flatten db result into plain object
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

  ////// user profile paging
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

    // toJson flatten db result into plain object
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

  ////// login page
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

  ////// logout page
  router.get('/logout', async (ctx) => {
    ctx.session = null;
    ctx.redirect('/');
  });

  ////// oauth callback
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
          nickname: userProfile.name,
          twitter_id: null,
          github_id: userProfile.id,
          is_mod: false,
          created: new Date(),
          updated: new Date()
        };
      } else if (oauthResult.provider == 'twitter') {
        newUser = {
          username: userProfile.screen_name,
          nickname: userProfile.name,
          twitter_id: userProfile.id,
          github_id: null,
          is_mod: false,
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
