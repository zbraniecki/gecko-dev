this.EXPORTED_SYMBOLS = [ "L10nRegistry", "ResourceBundle" ];

/* Sources */
class Source {
  constructor(name) {
    this.name = name;
  }

  indexResources() {
    throw new Error('Not implemented');
  }
}

const fakeSourceMap = {
  'chrome/toolkit/locales/en-US/global/aboutSupport.ftl': 'key1 = Value1'
}

class FileSource extends Source {
  constructor(name, resMap) {
    super(name);
    this.resMap = resMap;
  }

  indexResources() {
    const result = {};

    for (let resId in this.resMap) {
      result[resId] = Object.keys(this.resMap[resId]);
    }

    return result;
  }

  loadResource(resId, lang) {
    const path = this.resMap[resId][lang];
    return Promise.resolve(fakeSourceMap[path]);;
  }
}

/* ResourceBundle */

class ResourceBundle {
  constructor(lang, resIds) {
    this.lang = lang;
    this.loaded = undefined;
    this.resIds = resIds;
  }

  fetch() {
    if (!this.loaded) {
      const resPromises = [];

      for (let resId in this.resIds) {
        let source = this.resIds[resId][0];
        resPromises.push(L10nRegistry.fetchResource(source, resId, this.lang));;
      }
      this.loaded = Promise.all(resPromises);
    }
    return this.loaded;
  }
}

/* Registry */

const sources = new Map();
const index = new Map();

function prioritizeLocales(defaultLag, availableLangs, requestedLangs) {
  return new Set(['en-US']);
}

function getLanguages(resIds) {
  const locales = new Set();

  let firstRes = true;
  for (let resId of resIds) {
    if (index.has(resId)) {
      if (firstRes) {
        for (let lang of index.get(resId).keys()) {
          locales.add(lang);
        }
      } else {
        for (let lang of locales) {
          if (!(lang in index.get(resId).keys())) {
            locales.delete(lang);
          }
        }
      }
    }
    firstRes = false;
  }
  return locales;
}

this.L10nRegistry = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs
    );
    const resBundles = Array.from(supportedLocales).map(
      lang => {
        return [
          lang,
          {'toolkit:global/aboutSupport.ftl': ['toolkit']}
        ];
      }
    )
    return {
      availableLangs,
      supportedLocales,
      resBundles
    };
  },

  registerSource(source) {
    sources.set(source.name, source);

    const resList = source.indexResources();

    for (let resId in resList) {
      if (!index.has(resId)) {
        index.set(resId, new Map());
      }

      for (let lang of resList[resId]) {
        if (!index.get(resId).has(lang)) {
          index.get(resId).set(lang, new Set());
        }
        index.get(resId).get(lang).add(source.name);
      }
    }
  },

  fetchResource(source, resId, lang) {
    return sources.get(source).loadResource(resId, lang);
  }
};


const toolkitSource = new FileSource('toolkit', {
  'toolkit:global/aboutSupport.ftl': {
    'en-US': 'chrome/toolkit/locales/en-US/global/aboutSupport.ftl'
  }
});

L10nRegistry.registerSource(toolkitSource);
