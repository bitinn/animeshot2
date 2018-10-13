
// app dependency

const koa = require('koa');

const koaViews = require('koa-views');
const koaLogger = require('koa-logger');
const koaStatic = require('koa-static');
const koaRouter = require('koa-trie-router');
const koaSession = require('koa-session');
const koaMount = require('koa-mount');
const koaBody = require('koa-body');
const koaCSRF = require('koa-csrf');

const grant = require('grant-koa');

const setupRouter = require('./routes');
const settings = require('./animeshot.json');

// define routing

const router = new koaRouter();
setupRouter(router, settings);

// define app

const app = new koa();

app.use(koaLogger());
app.use(koaStatic(__dirname + '/public'));
app.use(koaViews(__dirname + '/views', {
  extension: 'pug'
}));
app.use(koaBody({
  multipart: true,
  urlencoded: false,
  text: false,
  json: false,
  strict: true,
  formidable: {
    maxFileSize: 20 * 1024 * 1024
  }
}));
app.use(new koaCSRF());

app.keys = settings.cookie.keys;
app.use(koaSession(settings.cookie.session, app));

app.use(koaMount(grant(settings.oauth)));
app.use(router.middleware());

app.listen(settings.site.server.port);
