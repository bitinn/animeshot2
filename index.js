
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

const settings = require('./animeshot.json');

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
  const user = await userModel.find(1);

  const data = {
    title: user.username
  };

  await ctx.render('index', data);
});

router.get(settings.oauth.server.callback, async (ctx) => {
  ctx.body = ctx.session;
});

// define app

const app = new koa();

app.use(koaLogger());
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', {
  extension: 'pug'
}));

app.keys = settings.cookie.keys;
app.use(koaSession({
  key: settings.cookie.name,
  maxAge: settings.cookie.maxAge,
  signed: settings.cookie.signed
}, app));

app.use(koaMount(grant(settings.oauth)));
app.use(router.middleware());

app.listen(settings.site.port);
