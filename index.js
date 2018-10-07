
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

const setupRouter = require('./scripts/routes');

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

db.Model('User', function () {
  this.hasMany('shots', { to: 'user_id' });
  this.hasMany('votes', { to: 'user_id' });
});

db.Model('Shot', function () {
  this.belongsTo('user', { model: 'User', from: 'user_id', to: 'id' });
});

// define routing

const router = new koaRouter();
setupRouter(router, db, settings);

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
