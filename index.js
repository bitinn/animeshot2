
// app dependency

const koa = require('koa');

const koaViews = require('koa-views');
const koaLogger = require('koa-logger');
const koaStatic = require('koa-static');
const koaRouter = require('koa-trie-router');
const koaSession = require('koa-session');
const koaMount = require('koa-mount');

const openrecord = require('openrecord/store/sqlite3');

const grant = require('grant-koa');
const request = require('request');
const promise = Promise;
const purest = require('purest')({ request, promise });
const providers = require('@purest/providers');

const settings = require('./animeshot.json');

// define oauth sign-in

const githubAPI = purest({ provider: 'github', config: providers });
const twitterAPI = purest({ provider: 'twitter', config: providers });

// define database

const db = new openrecord({
  file: './database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

// define routing

const router = new koaRouter();

router.get('/', async (ctx) => {
  await db.ready();
  const userModel = db.Model('users');

  const data = {
    meta: settings.site.meta
  };

  await ctx.render('index', data);
});

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

  // fetch user profile
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

  // clean up session cookie
  ctx.session = { user: { id: localUser.id } };
  ctx.redirect('/profile');
});

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

// define app

const app = new koa();

app.use(koaLogger());
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', {
  extension: 'pug'
}));

app.keys = settings.cookie.keys;
app.use(koaSession(settings.cookie.session, app));

app.use(koaMount(grant(settings.oauth)));
app.use(router.middleware());

app.listen(settings.site.port);
