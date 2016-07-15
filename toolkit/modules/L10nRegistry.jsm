this.EXPORTED_SYMBOLS = ["L10nRegistry"];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/NetUtil.jsm");

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

function load(path, json = false) {
  let uri = 'resource://' + path;

	return new Promise((resolve, reject) => {
		NetUtil.asyncFetch({uri, loadUsingSystemPrincipal: true}, (inputStream, status) => {
			if (!Components.isSuccessCode(status)) {
				reject(new Error(status));
				return;
			}
			let text = NetUtil.readInputStreamToString(inputStream, inputStream.available(),
				{charset: "utf-8"});
      if (json) {
        resolve(JSON.parse(text));
      } else {
			  resolve(text);
      }
		});
	});
}

function loadSync(path, json) {
  let uri = 'resource://' + path;

  let charset = 'UTF-8';
  return new Promise((resolve, reject) => {
		let channel = NetUtil.newChannel({
			uri: NetUtil.newURI(uri, charset),
			loadUsingSystemPrincipal: true
		});
		let stream = channel.open2();

		let count = stream.available();
		let data = NetUtil.readInputStreamToString(stream, count, { charset });

		stream.close();

		if (json) {
			resolve(JSON.parse(data));
		}
		resolve(data);
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

  return Promise.all(subSources.map((subSource, j) => {
    const resSources = {};


    const fetch = firstLocale && j === 0;

    return Promise.all(resIds.map(resId => {
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
  ready: null,
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs
    );

    const locales = Array.from(supportedLocales);
    return this.ready.then(() => {
      const sources = Array.from(sourcesOrder);

      return Promise.all(locales.map((locale, i) => {
        let subLocales = locales.slice(i);
        
        return buildResBundleData.call(
          this,
          resIds,
          subLocales,
          sources,
          i === 0);
      })).then(resBundles => {
        const bundles = [].concat.apply([], resBundles).filter((bundle, i, arr) => {
          if (i === 0) return true;

          const prev = arr[i - 1];

          for (let resId in bundle.resources) {
            const res = bundle.resources[resId];
            if (!prev.resources.hasOwnProperty(resId) ||
              prev.resources[resId].lang !== res.lang ||
              prev.resources[resId].source !== res.source) {
              return true;
            }
          }
          return false;
        });
        return {
          supportedLocales: locales,
          bundles
        }
      });
    });
  },

  startFetching(resId) {
    const [lang, source] = getSource(resId, ['en-US']);

    return this.fetchResource(source, resId, lang).then(() => {
      return [resId, source];
    });
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
      Cu.import("resource://gre/modules/Services.jsm");
      Services.obs.notifyObservers(this, 'language-registry-update', null);
    }
  },

  fetchResource(source, resId, lang) {
    const cacheId = `${resId}-${lang}-${source}`;

    if (cache.has(cacheId)) {
      let val = cache.get(cacheId);
      if (val === null) {
        return Promise.reject();
      } else if (val.then) {
        return val;
      } else {
        return Promise.resolve(val);
      }
    }

    const prom = sources.get(source).loadResource(resId, lang).then(data => {
      cache.set(cacheId, data);
      return data;
    }, err => {
      cache.set(cacheId, null);
      return Promise.reject(err);
    });
    cache.set(cacheId, prom);
    return prom;
  },

  requestResourceInfo() {
    return index;
  },

  requestCacheInfo() {
    return cache;
  },
};

L10nRegistry.ready = load('gre/chrome/en-US/locale/en-US/global/l10nregistry-manifest.json', true).then(data => {
  let platformFileSource = new FileSource('platform', data.platform);
  let appFileSource = new FileSource('app', data.app);
  L10nRegistry.registerSource(platformFileSource);
  L10nRegistry.registerSource(appFileSource);
});
