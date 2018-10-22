
# animeshot2

[![release badge](https://img.shields.io/github/release/bitinn/animeshot2.svg?style=flat-square)](https://github.com/bitinn/animeshot2/releases)

An open, portable, searchable image repository with twitter card and telegram bot integration.

(using nodejs + sqlite)

## What's New in V2

- Better image resize (and up to 4K screenshot support)
- OAuth login so users can manage their own content
- Moderator support
- User bookmarks and flags
- Telegram bot built-in support

(v2 however isn't compatible with v1, due to image quality difference and database backend change)

## First Time Setup

1. Have [nodejs](https://nodejs.org/en/download/current/) installed.
2. Download [latest release](https://github.com/bitinn/animeshot2/releases)
  - Alternatively, `git clone https://github.com/bitinn/animeshot2`
  - Then `git checkout tags/<version>`
3. Unzip and `cd` into your folder
4. Run these commands in order:
  - `npm install`
  - `npm run db:migrate`
5. Edit the config **(see guide below)**
6. Run these commands to start the server
  - `npm start`
  - you may need `sudo` due to restriction on port 80/443
  - but don't run your public server with `sudo`, instead, do [this](https://stackoverflow.com/questions/16573668/best-practices-when-running-node-js-with-port-80-ubuntu-linode)
7. Access `localhost` or your domain
8. To actually login and upload images: you need to create a [GitHub](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/) or [Twitter](https://developer.twitter.com/) app for OAuth authentication. We recommend starting with GitHub as it's faster.

(we might add a local password login in future, but for now, you need an OAuth provider)

## Updating to Latest

1. Download [latest release](https://github.com/bitinn/animeshot2/releases), and replace all files
  - If you use git repo: `git pull` then `git checkout tags/<version>`
2. `npm install`
3. `npm run db:migrate`
4. Your site is now up-to-date.

## Telegram Bot

1. Make sure your site is up and running
2. Apply for a bot with [BotFather](https://telegram.me/BotFather)
3. Edit the config **(see guide below)**
4. `npm run bot`
5. Now you should be able to type `@yourbot some-text` to search the animeshot database
6. You can also register your domain with BotFather, and use the optional Telegram web login

## Other Commands

- `npm run db:mod -- username` will prompt `username` into moderator
- `npm run db:import -- v1.json` will import json data extracted from v1 animeshot database (`mongodump` then `bsondump`), and import image data from `/public/legacy/`.
- `npm run db:seed` will seed database with some test data
- `npm run db:reset` clean up the database
- `npm run db:drop` drop all tables
- `npm run dev` launch auto-reload dev server for development

## Site Config

This is the full config with explanation, but since it's just a JSON file, you shouldn't copy this one, instead: `cp animeshot-example.json animeshot.json`.

```javascript
{
  "site": {
    "meta": {
      "title": "AnimeShot", // site name
      "owner": "your twitter handle", // twitter handler for twitter card
      "tagline": "your site description", // site description
      "logo": "/images/logo.jpg", // site logo for twitter card
      "lang": "en", // language hint and translations, see i18n.json
      "base_url": "https://your.site.domain", // site domain name
      "version": "r20181016" // only used in static asset cache bursting
    },
    "service": {
      "source": "https://whatanime.ga/?url=", // finding out image origin
      "twitter": "https://twitter.com/intent/tweet?url=" // sharing image
    },
    "server": {
      "ssl_certificate": "/ssl/localhost.crt", // cert file location, see https guide below
      "ssl_key": "/ssl/localhost.key", // key file location, see https guide below
      "http_port": 80, // always redirect to https port, unless has_proxy is true
      "https_port": 443,
      "server_port": 3000, // only used when you set has_proxy to true
      "has_proxy": true // indicate whether server has a reverse proxy
    }
  },
  "cookie": {
    "keys": ["keep this string secret"], // cookie key for signature verification
    "session": {
      "signed": true, // check cookie signature
      "maxAge": 86400000, // cookie expire time
      "key": "animeshot:login" // cookie name
    }
  },
  "oauth": {
    "server": {
      "protocol": "https", // oauth callback protocol
      "host": "your.site.domain", // oauth callback domain
      "callback": "/oauth/callback", // oauth callback route, defined in routes.js
      "transport": "session", // use session for token transport
      "state": true // a random state for added security check
    },
    "twitter": {
      "key": "...apply for a twitter app...", // https://developer.twitter.com/
      "secret": "...apply for a twitter app..."
    },
    "github": {
      "key": "...apply for a github app...", // https://developer.github.com/
      "secret": "...apply for a github app..."
    }
  },
  "bot": {
    "telegram": "...apply for a telegram bot..." // https://telegram.me/BotFather
    "result_count": 10, // how many result to return per search
    "cache_time": 0, // how long to cache response (used by telegram)
    "is_personal": false, // whether to cache response by user (used by telegram)
    "callback": "/bot/callback" // callback route for telegram login
  }
}
```

## OAuth Callback

When you are creating a GitHub or Twitter App for OAuth login, remember to fill in the callback or redirect url as following:

- `https://your.domain/connect/github/callback`
- `https://your.domain/connect/twitter/callback`

This is **not** the oauth callback route defined in your site config, and the redirect is actually handled internally by [grant](https://github.com/simov/grant).

## HTTPS Certificate

- For localhost, you want to [read this guide](https://letsencrypt.org/docs/certificates-for-localhost/) to generate test cert/key files and put them in the `ssl` folder.
- For public server, you want to [use certbot](https://certbot.eff.org/) to generate valid cert/key and then [chmod](https://github.com/certbot/certbot/issues/5257) permission and `ln` certificate/key files to the `ssl` folder.
- Then you can modify `ssl_certificate` and `ssl_key` in above config to use these cert and key files.

## Continuous Service

### forever

- Install `forever` with `sudo npm install -g forever`
- Launch service with `forever start index.js` and `foerver start bot.js`
- If you are using `certbot` for certificate without a reverse proxy (web server) like `nginx`, you can config `certbot` to auto restart animeshot service (so that port 80/443 is available for renewal).
- `sudo nano /etc/letsencrypt/renewal/your.domain.conf` and add these lines:

```
pre_hook = forever stop /full-path/index.js
post_hook = forever start /full-path/index.js
```

### pm2

- Install `pm2` with `sudo npm install -g pm2`
- Launch service with `pm2 start index.js` and `pm2 start bot.js`
- `pm2 startup` can setup startup service for you on major linux distributions (like Ubuntu 18's `systemd`)
- If you are using `certbot` for certificate without a reverse proxy (web server) like `nginx`, you can config `certbot` to auto restart animeshot service (so that port 80/443 is available for renewal).
- `sudo nano /etc/letsencrypt/renewal/your.domain.conf` and add these lines:

```
pre_hook = pm2 stop /full-path/index.js
post_hook = pm2 start /full-path/index.js
```

## License

[AGPL-3.0](https://github.com/bitinn/animeshot2/blob/master/LICENSE)
