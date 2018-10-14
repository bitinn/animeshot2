
# animeshot2

An open and searchable image repository with telegram bot integration

(using nodejs + sqlite)

## Usage

1. Have [nodejs](https://nodejs.org/en/download/current/) installed.
2. Download [latest release](https://github.com/bitinn/animeshot2/releases)
3. Unzip and `cd` into your folder
4. Run these commands in order:
  - `npm install`
  - `npm run db:migirate`
5. Edit the config **(see guide below)**
6. Run these commands to start the server
  - `npm start`
  - you may need `sudo` due to restriction on port 80/443
  - but don't run your public server with `sudo`, instead, do [this](https://stackoverflow.com/questions/16573668/best-practices-when-running-node-js-with-port-80-ubuntu-linode)
7. Access `localhost` or your domain
8. To actually login and upload images: you need to create a [GitHub](https://developer.github.com/apps/building-oauth-apps/creating-an-oauth-app/) or (Twitter)[https://developer.twitter.com/] app for OAuth authentication. We recommend starting with GitHub as it's faster.

## Telegram Bot

1. Make sure your site is up and running
2. Apply for a bot with [BotFather](https://telegram.me/BotFather)
3. Edit the config **(see guide below)**
4. `npm run bot`
5. Now you should be able to type `@yourbot some-text` to search the animeshot database

## Config

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
      "version": "0.7.0" // only used in cache bursting
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
  }
}
```

## HTTPS Certificate

- For localhost, you want to [read this guide](https://letsencrypt.org/docs/certificates-for-localhost/) to generate test cert/key files and put them in the `ssl` folder.
- For public server, you want to [use certbot](https://certbot.eff.org/) to generate valid cert/key and then [chmod](https://github.com/certbot/certbot/issues/5257) permission and `ln` certificate/key files to the `ssl` folder.
- Then you can modify `ssl_certificate` and `ssl_key` in above config to use these cert and key files.

## License

[AGPL-3.0](https://github.com/bitinn/animeshot2/blob/master/LICENSE)
