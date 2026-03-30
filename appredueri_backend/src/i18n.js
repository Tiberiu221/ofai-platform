const path = require('path');
const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const middleware = require('i18next-http-middleware');

i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'ro',
    supportedLngs: ['ro', 'en'],
    preload: ['ro', 'en'],
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}.json'),
    },
    detection: {
      order: ['querystring', 'cookie', 'header'],
      lookupQuerystring: 'lang',
      lookupCookie: 'ofai_lang',
      caches: ['cookie'],
    },
    interpolation: {
      escapeValue: false, // EJS handles escaping
    },
  });

module.exports = { i18next, i18nMiddleware: middleware };
