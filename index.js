
// app dependency

const koa = require('koa');

const koaViews = require('koa-views');
const koaLogger = require('koa-logger');
const koaStatic = require('koa-static');
const koaRouter = require('koa-trie-router');

const openrecord = require('openrecord/store/sqlite3');

// define database

const db = new openrecord({
  file: './database/animeshot.sqlite',
  autoLoad: true,
  autoConnect: true,
  autoAttributes: true
});

// define routing

const router = new koaRouter();

router.get('/', async function (ctx) {
  await db.ready();
  const userModel = db.Model('users');
  const user = await userModel.find(1);

  const data = {
    title: user.username
  };

  await ctx.render('index', data);
});

// define app

const app = new koa();

app.use(koaLogger());
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', {
  extension: 'pug'
}));
app.use(router.middleware());

app.listen(3000);
