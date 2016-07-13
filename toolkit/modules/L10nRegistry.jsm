this.EXPORTED_SYMBOLS = ["L10nRegistry"];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import('resource://gre/modules/SyncPromise.jsm');

/* Sources */
class Source {
  constructor(name) {
    this.name = name;
  }

  loadResource(resId, lang) {
    throw new Error('Not implemented');
  }
}

const HTTP_STATUS_CODE_OK = 200;

function load(path) {
  let url = 'resource://' + path;

  return new Promise((resolve, reject) => {
    const req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Ci.nsIXMLHttpRequest);

    req.mozBackgroundRequest = true;
    req.overrideMimeType('text/plain');
    try {
      req.open('GET', url, true);
    } catch (e) {
      reject(e);
    }

    req.addEventListener('load', () => {
      if (req.status === HTTP_STATUS_CODE_OK) {
        resolve(req.responseText);

      } else {
        reject(new Error('Not found: ' + url));

      }

    });
    req.addEventListener('error', reject);
    req.addEventListener('timeout', reject);

    try {
      req.send(null);
    } catch(e) {
      reject(e);
    }
  });
}

class FileSource extends Source {
  constructor(name, prePath) {
    super(name);
    this.prePath = prePath;
  }

  loadResource(resId, lang) {
    const path =
      this.prePath + resId.substr(0, resId.lastIndexOf('.') + 1) + lang + '.ftl';
    return load(path);
  }
}

/* Registry */

const sources = new Map();
let sourcesOrder = new Set();
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

function getRPermuts(array, size, initialStuff = []) {
  if (initialStuff.length >= size) {
    return initialStuff;
  } else {
    return array.map(elem => {
      return getRPermuts(array, size, initialStuff.concat(elem));
    }).reduce((a, b) => {
      if (b.every(e => typeof e === 'string')) {
        return [a, b];
      }
      return a.concat(b);
    });
  }
}

function fetchFirstBundle(bundles) {
  const fetchList = [];

  for (let resId in bundles[0].resources) {
    let res = bundles[0].resources[resId];
    fetchList.push(this.fetchResource(res.source, resId, res.locale));
  }
  return Promise.all(fetchList).then(resData => {
    let resIds = Object.keys(bundles[0].resources);
    resData.forEach((data, i) => {
      bundles[0].resources[resIds[i]].data = data;
    });
    return bundles;
  }, err => {
    return fetchFirstBundle.call(this, bundles.slice(1));
  });
}

this.L10nRegistry = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const supportedLocales = new Set(requestedLangs);

    const sources = Array.from(sourcesOrder);
    const locales = Array.from(supportedLocales);

    const resBundles = locales.map(locale => {
      const sourceCombinations = getRPermuts(sources, resIds.length);
      const result = [];

      for (let i = 0; i < sourceCombinations.length; i++) {
        const resources = {};
        resIds.forEach((resId, j) => {
          resources[resId] = {
            locale,
            source: sourceCombinations[i][j],
            data: null
          }
        });
        result.push({
          locale,
          resources
        });
      }
      return result;
    }).reduce((a, b) => a.concat(b));

    return fetchFirstBundle.call(this, resBundles).then(bundles => {
      return {
        supportedLocales,
        bundles
      }
    }) 
  },

  registerSource(source) {
    sources.set(source.name, source);
    sourcesOrder = new Set([source.name].concat(Array.from(sourcesOrder)));
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
      let val = cache.get(cacheId);
      if (val === null) {
        return Promise.reject();
      } else {
        return Promise.resolve(val);
      }
    }

    return sources.get(source).loadResource(resId, lang).then(data => {
      //cache.set(cacheId, data);
      return data;
    }, err => {
      //cache.set(cacheId, null);
      return Promise.reject();
    });
  },

  requestResourceInfo() {
    return new Map();
  },

  requestCacheInfo() {
    return cache;
  },
};

const platformFileSource =
  new FileSource('platform', 'gre/chrome/en-US/locale/en-US');

const appFileSource =
  new FileSource('app', '/chrome/en-US/locale');

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
