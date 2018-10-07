
// disable custom inspect function when console.log openrecord results
const util = require('util');
util.inspect.defaultOptions.customInspect = false;

module.exports = function setupRouter (router, db, settings) {

  //
  // helper functions
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

  async function findRecentShots (limit = 0, offset = 0) {
    // find them in database
    const shotModel = db.Model('shots');
    const shots = await shotModel.order('created', true).limit(limit, offset).include('user');

    return shots;
  }

  //
  // define routes
  //

  // index page
  router.get('/', async (ctx) => {
    await db.ready();
    const user = await findCurrentUser(ctx);
    const shots = await findRecentShots(4, 0);

    // toJson flatten db result into plain object
    const data = {
      meta: settings.site.meta,
      i18n: settings.site.i18n[settings.site.meta.lang],
      user: user ? user.toJson() : null,
      shots: shots ? shots.toJson() : []
    };
  
    await ctx.render('page-index', data);
  });

  // login page
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

  // oauth callback
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
          twitter_token: null,
          github_id: userProfile.id,
          github_token: oauthResult.response.access_token,
          is_mod: false,
          created: new Date(),
          updated: new Date()
        };
      } else if (oauthResult.provider == 'twitter') {
        newUser = {
          username: userProfile.screen_name,
          nickname: userProfile.name,
          twitter_id: userProfile.id,
          twitter_token: oauthResult.response.access_token + "::" + oauthResult.response.access_secret,
          github_id: null,
          github_token: null,
          is_mod: false,
          created: new Date(),
          updated: new Date()
        };
      }
  
      localUser = await userModel.create(newUser);
    }
  
    // update session cookie
    ctx.session = { user: { id: localUser.id } };
    ctx.redirect('/profile');
  });
  
  // profile page
  router.get('/profile', async (ctx) => {
    // no session data
    if (!ctx.session || !ctx.session.user) {
      ctx.redirect('/');
      return;
    }
  
    // match it in database
    await db.ready();
    const userModel = db.Model('users');
    const localUser = await userModel.find(ctx.session.user.id);
  
    ctx.body = localUser;
  });

  return router;

}
