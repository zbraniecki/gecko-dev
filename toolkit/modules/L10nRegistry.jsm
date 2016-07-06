this.EXPORTED_SYMBOLS = [ "L10nRegistry", "ResourceBundle" ];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import('resource://gre/modules/Services.jsm');

const sync = false;

/* SyncPromise */

function isPromise(p) {
  return p && typeof p.then === 'function';
}
function addReject(prom, reject) {
  prom.then(null, reject) // Use this style for sake of non-Promise thenables (e.g., jQuery Deferred)
}

// States
var PENDING = 2,
    FULFILLED = 0, // We later abuse these as array indices
    REJECTED = 1;

function SyncPromise(fn) {
  var self = this;
  self.v = 0; // Value, this will be set to either a resolved value or rejected reason
  self.s = PENDING; // State of the promise
  self.c = [[],[]]; // Callbacks c[0] is fulfillment and c[1] contains rejection callbacks
  self.a = false; // Has the promise been resolved synchronously
  var syncResolved = true;
  function transist(val, state) {
    self.a = syncResolved;
    self.v = val;
    self.s = state;
    if (state === REJECTED && !self.c[state].length) {
      throw val;
    }
    self.c[state].forEach(function(fn) { fn(val); });
    self.c = null; // Release memory.
  }
  function resolve(val) {
    if (!self.c) {
      // Already resolved, do nothing.
    } else if (isPromise(val)) {
      addReject(val.then(resolve), reject);
    } else {
      transist(val, FULFILLED);
    }
  }
  function reject(reason) {
    if (!self.c) {
      // Already resolved, do nothing.
    } else if (isPromise(reason)) {
      addReject(reason.then(reject), reject);
    } else {
      transist(reason, REJECTED);
    }
  }
  fn(resolve, reject);
  syncResolved = false;
}

var prot = SyncPromise.prototype;

prot.then = function(cb, errBack) {
  var self = this;
  if (self.a) { // Promise has been resolved synchronously
    //throw new Error('Cannot call `then` on synchronously resolved promise');
  }
  return new SyncPromise(function(resolve, reject) {
    var rej = typeof errBack === 'function' ? errBack : reject;
    function settle() {
      try {
        resolve(cb ? cb(self.v) : self.v);
      } catch(e) {
        rej(e);
      }
    }
    if (self.s === FULFILLED) {
      settle();
    } else if (self.s === REJECTED) {
      rej(self.v);
    } else {
      self.c[FULFILLED].push(settle);
      self.c[REJECTED].push(rej);
    }
  });
};

prot.catch = function(cb) {
  var self = this;
  if (self.a) { // Promise has been resolved synchronously
    throw new Error('Cannot call `catch` on synchronously resolved promise');
  }
  return new SyncPromise(function(resolve, reject) {
    function settle() {
      try {
        resolve(cb(self.v));
      } catch(e) {
        reject(e);
      }
    }
    if (self.s === REJECTED) {
      settle();
    } else if (self.s === FULFILLED) {
      resolve(self.v);
    } else {
      self.c[REJECTED].push(settle);
      self.c[FULFILLED].push(resolve);
    }
  });
};

SyncPromise.all = function(promises) {
  return new SyncPromise(function(resolve, reject, l) {
    l = promises.length;
    var hasPromises = false;
    promises.forEach(function(p, i) {
      if (isPromise(p)) {
        hasPromises = true;
        addReject(p.then(function(res) {
          promises[i] = res;
          --l || resolve(promises);
        }), reject);
      } else {
        --l || resolve(promises);
      }
    });
  });
};

SyncPromise.race = function(promises) {
  var resolved = false;
  return new SyncPromise(function(resolve, reject) {
    promises.some(function(p, i) {
      if (isPromise(p)) {
        addReject(p.then(function(res) {
          if (resolved) {
            return;
          }
          resolve(res);
          resolved = true;
        }), reject);
      } else {
        throw new Error('Must use promises within `SyncPromise.race`');
      }
    });
  });
};

SyncPromise.resolve = function(f) {
  return new SyncPromise(function(resolve, reject) {
    resolve(f);
  })
}

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

function load(url) {
  return new Promise((resolve, reject) => {
    const req = Cc['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Ci.nsIXMLHttpRequest);

    req.mozBackgroundRequest = true;
    req.overrideMimeType('text/plain');
    req.open('GET', url, true);

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

  if (sourcesPtr + 1 < sources.length) {
    return getSource(resId, locales, sourcesPtr + 1);
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

      for (let lang of resList[resId]) {
        if (!index.get(resId).has(lang)) {
          index.get(resId).set(lang, new Set());
        }
        index.get(resId).get(lang).add(source.name);
      }
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
  }
};


const toolkitFileSource = new FileSource('toolkit', {
  '/global/aboutSupport.ftl': {
    'en-US': 'chrome://global/locale/aboutSupport.en-US.ftl',
    'pl': 'chrome://global/locale/aboutSupport.pl.ftl',
  },
  '/global/resetProfile.ftl': {
    'en-US': 'chrome://global/locale/resetProfile.en-US.ftl',
    'pl': 'chrome://global/locale/resetProfile.pl.ftl'
  }
});

const browserFileSource = new FileSource('browser', {
  '/branding/brand.ftl': {
    'en-US': 'chrome://branding/locale/brand.en-US.ftl',
    'pl': 'chrome://branding/locale/brand.pl.ftl'
  },
  '/browser/aboutDialog.ftl': {
    'en-US': 'chrome://browser/locale/aboutDialog.en-US.ftl',
    'pl': 'chrome://browser/locale/aboutDialog.pl.ftl'
  },
  '/browser/browser.ftl': {
    'en-US': 'chrome://browser/locale/browser.en-US.ftl',
    'pl': 'chrome://browser/locale/browser.pl.ftl'
  },
  '/browser/tabbrowser.ftl': {
    'en-US': 'chrome://browser/locale/tabbrowser.en-US.ftl',
    'pl': 'chrome://browser/locale/tabbrowser.pl.ftl'
  },
});

L10nRegistry.registerSource(toolkitFileSource);
L10nRegistry.registerSource(browserFileSource);
