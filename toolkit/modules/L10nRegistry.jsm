this.EXPORTED_SYMBOLS = [ "L10nRegistry", "ResourceBundle" ];

/* SyncPromise */

class SyncPromise {
  constructor() {
  }
}

SyncPromise.resolve = function(f) {
  return {
    then(resolve, reject) {
      return resolve(f);
    }
  }
}

SyncPromise.all = function(promiseList) {
  const result = promiseList.map(f => {
    return f.then(res => {
      return res;
    });
  });
  return {
    then(resolve, reject) {
      resolve(result);
    }
  }
}

/* Sources */
class Source {
  constructor(name) {
    this.name = name;
  }

  indexResources() {
    throw new Error('Not implemented');
  }

  loadResource(resId, lang) {
    throw new Error('Not implemented');
  }
}

const fakeSourceMap = {
  'omni.ja!/toolkit/locales/en-US/global/aboutSupport.ftl': 'support = Support String',
  'omni.ja!/toolkit/locales/pl/global/aboutSupport.ftl': 'support = Support String [PL]',
  'omni.ja!/browser/locales/en-US/global/netError.ftl': 'error = Error from browser',
  'omni.ja!/toolkit/locales/en-US/global/netError.ftl': 'error = Error from toolkit',
  'omni.ja!/toolkit/locales/pl/global/netError.ftl': 'error = Error from toolkit [PL]'
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
    return SyncPromise.resolve(fakeSourceMap[path]);
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

      this.loaded = SyncPromise.all(resPromises);
    }
    return this.loaded;
  }
}

/* Registry */

const sources = new Map();
let sourcesOrder = new Set();
const index = new Map();

function prioritizeLocales(defaultLang, availableLangs, requestedLangs) {
  const supportedLocales = new Set();
  for (let lang of requestedLangs) {
    if (availableLangs.has(lang)) {
      supportedLocales.add(lang);
    }
  }

  supportedLocales.add(defaultLang);
  return supportedLocales;
}

function getLanguages(resIds) {
  const locales = new Set();

  for (let resId of resIds) {
    if (index.has(resId)) {
      for (let lang of index.get(resId).keys()) {
        locales.add(lang);
      }
    }
  }
  return locales;
}

function getSources(lang, resIds) {
  const result = new Set();
  
  for (let sourceName of sourcesOrder) {
    for (let resId of resIds) {
      if (index.has(resId) && index.get(resId).has(lang)) {
        let sources = index.get(resId).get(lang);
        if (sources.has(sourceName)) {
          result.add(sourceName);
        }
      }
    }
  }

  return result;
}

function getSource(resId, locales, sourcesPtr = 0) {
  const sources = Array.from(sourcesOrder);

  let lang = locales[0];
  let source = sources[sourcesPtr];

  if (!index.get(resId).has(lang)) {
    return getSource(resId, locales.slice(1));
  }
  if (index.get(resId).get(lang).has(source)) {
    return [lang, source];
  }

  if (sourcesPtr + 1 < sources.length) {
    return getSource(resId, locales, sourcesPtr + 1);
  }

  if (locales > 1) {
    return getSource(resId, locales.slice(1));
  }
  return [null, null];
}

this.L10nRegistry = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs
    );
    const resBundles = [];

    const locales = Array.from(supportedLocales);
    const sources = Array.from(sourcesOrder);

    for (let i in locales) {
      let subLocales = locales.slice(i);
      const subSources = Array.from(getSources(locales[i], resIds));

      for (let j in subSources) {
        const resSources = {};

        resIds.forEach(resId => {
          let [lang, source] = getSource(resId, subLocales, sources.indexOf(subSources[j]));
          resSources[resId] = {
            lang,
            source,
            data: null
          };
        });
        resBundles.push({
          lang: locales[i],
          resources: resSources
        })
      }
    }
    return {
      supporedLocales: locales,
      resBundles
    };
  },

  registerSource(source) {
    sources.set(source.name, source);
    sourcesOrder = new Set([source.name].concat(Array.from(sourcesOrder)));

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


const toolkitFileSource = new FileSource('toolkit', {
  'toolkit:global/aboutSupport.ftl': {
    'en-US': 'omni.ja!/toolkit/locales/en-US/global/aboutSupport.ftl',
    'pl': 'omni.ja!/toolkit/locales/pl/global/aboutSupport.ftl',
  },
  'toolkit:global/netError.ftl': {
    'en-US': 'omni.ja!/toolkit/locales/en-US/global/netError.ftl',
    'pl': 'omni.ja!/toolkit/locales/pl/global/netError.ftl'
  }
});

const browserFileSource = new FileSource('browser', {
  'toolkit:global/netError.ftl': {
    'en-US': 'omni.ja!/browser/locales/en-US/global/netError.ftl',
    'pl': 'omni.ja!/browser/locales/pl/global/netError.ftl'
  }
});

L10nRegistry.registerSource(toolkitFileSource);
L10nRegistry.registerSource(browserFileSource);
