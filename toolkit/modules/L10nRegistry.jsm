this.EXPORTED_SYMBOLS = [ "L10nRegistry", "ResourceBundle" ];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://gre/modules/SyncPromise.jsm');

const sync = false;

const CurPromise = sync ? SyncPromise : Promise;

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

const HTTP_STATUS_CODE_OK = 200;

function load(path) {
  let url = 'resource://' + path;

  return new CurPromise((resolve, reject) => {
    const req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Ci.nsIXMLHttpRequest);

    req.mozBackgroundRequest = true;
    req.overrideMimeType('text/plain');
    req.open('GET', url, !sync);

    req.addEventListener('load', () => {
      if (req.status === HTTP_STATUS_CODE_OK) {
        resolve(req.responseText);

      } else {
        reject(new Error('Not found: ' + url));

      }

    });
    req.addEventListener('error', reject);
    req.addEventListener('timeout', reject);

    req.send(null);
  });
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
    return load(path);
  }
}

/* ResourceBundle */

class ResourceBundle {
  constructor(lang, resources) {
    this.lang = lang;
    this.loaded = undefined;
    this.resources = resources;


    let data = Object.keys(resources).map(resId => {
      return resources[resId].data;
    });

    if (data.every(d => d !== null)) {
      this.loaded = CurPromise.resolve(data);
    }
  }

  fetch() {
    if (!this.loaded) {
      const resPromises = [];

      for (let resId in this.resources) {
        let {
          source,
          lang
        } = this.resources[resId];
        resPromises.push(L10nRegistry.fetchResource(source, resId, lang));;
      }

      this.loaded = CurPromise.all(resPromises);
    }
    return this.loaded;
  }
}

/* Registry */

const sources = new Map();
let sourcesOrder = new Set();
const index = new Map();
const cache = new Map();

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

  for (let i = 0; i < sources.length; i++) {
    if (index.get(resId).get(lang).has(sources[i])) {
      return [lang, sources[i]];
    }
  }

  if (locales > 1) {
    return getSource(resId, locales.slice(1));
  }
  return [null, null];
}

function buildResBundleData(resIds, subLocales, sources, firstLocale) {
  const locale = subLocales[0];
  const subSources = Array.from(getSources(locale, resIds));

  return CurPromise.all(subSources.map((subSource, j) => {
    const resSources = {};


    const fetch = firstLocale && j === 0;

    return CurPromise.all(resIds.map(resId => {
      let [lang, source] = getSource(resId, subLocales, sources.indexOf(subSources[j]));
      return fetch ? this.fetchResource(source, resId, lang).then(data => {
        return {
          resId,
          data,
          source,
          lang
        };
      }) : {
        resId,
        data: null,
        source,
        lang
      };
    })).then((resList) => {
      const resSources = {};
      resList.forEach(res => {
        resSources[res.resId] = {
          lang: res.lang,
          source: res.source,
          data: res.data
        }
      });
      return {
        locale,
        resources: resSources
      };
    })
  }));
}

this.L10nRegistry = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs
    );

    const locales = Array.from(supportedLocales);
    const sources = Array.from(sourcesOrder);

    return CurPromise.all(locales.map((locale, i) => {
      let subLocales = locales.slice(i);
      
      return buildResBundleData.call(
        this,
        resIds,
        subLocales,
        sources,
        i === 0);
    })).then(resBundles => {
      return {
        supportedLocales: locales,
        bundles: [].concat.apply([], resBundles)
      }
    })
  },

  registerSource(source) {
    sources.set(source.name, source);
    sourcesOrder = new Set([source.name].concat(Array.from(sourcesOrder)));

    const resList = source.indexResources();

    for (let resId in resList) {
      if (!index.has(resId)) {
        index.set(resId, new Map());
      }

      const resLangs = index.get(resId);

      for (let lang of resList[resId]) {
        if (!resLangs.has(lang)) {
          resLangs.set(lang, new Set());
        }
        resLangs.get(lang).add(source.name);
      }
    }
  },

  onResourcesChanged(sourceName, resList) {
    const changedResources = new Set();

    for (let resId in resList) {
      if (!index.has(resId)) {
        index.set(resId, new Map());
      }

      const resLangs = index.get(resId);

      for (let lang of resList[resId]) {
        const cacheId = `${resId}-${lang}-${sourceName}`;

        // invalidate the cache for this changed resource; the next 
        // fetchResource will re-populate it
        if (cache.has(cacheId)) {
          cache.delete(cacheId);
        }

        if (!resLangs.has(lang)) {
          resLangs.set(lang, new Set());
        }

        resLangs.get(lang).add(sourceName);
        changedResources.add(resId);
      }
    }

    if (changedResources.size) {
      Services.obs.notifyObservers(this, 'language-registry-update', null);
    }
  },

  fetchResource(source, resId, lang) {
    const cacheId = `${resId}-${lang}-${source}`;

    if (cache.has(cacheId)) {
      return CurPromise.resolve(cache.get(cacheId));
    }

    return sources.get(source).loadResource(resId, lang).then(data => {
      cache.set(cacheId, data);
      return data;
    }).catch(e => e);
  },

  requestResourceInfo() {
    return index;
  },

  requestCacheInfo() {
    return cache;
  },
};

const platformFileSource = new FileSource('platform', {
  '/global/aboutLocalization.ftl': {
    'en-US': 'gre/chrome/en-US/locale/en-US/global/aboutLocalization.en-US.ftl',
  },
  '/global/aboutSupport.ftl': {
    'en-US': 'gre/chrome/en-US/locale/en-US/global/aboutSupport.en-US.ftl',
    'pl': 'gre/chrome/en-US/locale/en-US/global/aboutSupport.pl.ftl',
  },
  '/global/resetProfile.ftl': {
    'en-US': 'gre/chrome/en-US/locale/en-US/global/resetProfile.en-US.ftl',
    'pl': 'gre/chrome/en-US/locale/en-US/global/resetProfile.pl.ftl'
  }
});

const appFileSource = new FileSource('app', {
  '/branding/brand.ftl': {
    'en-US': '/chrome/en-US/locale/branding/brand.en-US.ftl',
    'pl': '/chrome/en-US/locale/branding/brand.pl.ftl'
  },
  '/browser/aboutDialog.ftl': {
    'en-US': '/chrome/en-US/locale/browser/aboutDialog.en-US.ftl',
    'pl': '/chrome/en-US/locale/browser/aboutDialog.pl.ftl'
  },
  '/browser/aboutRobots.ftl': {
    'en-US': '/chrome/en-US/locale/browser/aboutRobots.en-US.ftl',
  },
  '/browser/browser.ftl': {
    'en-US': '/chrome/en-US/locale/browser/browser.en-US.ftl',
    'pl': '/chrome/en-US/locale/browser/browser.pl.ftl'
  },
  '/browser/tabbrowser.ftl': {
    'en-US': '/chrome/en-US/locale/browser/tabbrowser.en-US.ftl',
    'pl': '/chrome/en-US/locale/browser/tabbrowser.pl.ftl'
  },
});

L10nRegistry.registerSource(platformFileSource);
L10nRegistry.registerSource(appFileSource);

/*
const source1 = new FileSource('source1', {
  'a': {
    'en-US': 'a',
  },
  'b': {
    'en-US': 'b',
  },
  'c': {
    'en-US': 'c',
  },
});
const source2 = new FileSource('source2', {
  'a': {
    'en-US': 'a',
  },
});

const source3 = new FileSource('source3', {
  'b': {
    'en-US': 'b',
  },
  'c': {
    'en-US': 'c',
  },
  'd': {
    'en-US': 'd',
  },
});
L10nRegistry.registerSource(source3);
L10nRegistry.registerSource(source2);
L10nRegistry.registerSource(source1);
*/
