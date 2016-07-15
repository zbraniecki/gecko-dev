this.EXPORTED_SYMBOLS = ["L10nRegistry"];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/NetUtil.jsm");

/* Sources */
class Source {
  constructor(name) {
    this.name = name;
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
  constructor(name, prePath) {
    super(name);
    this.prePath = prePath;
  }

  loadResource(resId, lang) {
    const path =
      this.prePath + resId.substr(0, resId.lastIndexOf('.') + 1) + lang + '.ftl';
    return loadSync(path);
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

const L10nRegistry = {
  ready: Promise.resolve(),
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

  startFetching(resId, sourceIndex = 0) {
    const sourcesNames = Array.from(sourcesOrder);
    if (sourceIndex >= sourcesNames.length) {
      return Promise.reject(resId);
    }

    return this.fetchResource(sourcesNames[sourceIndex], resId, 'en-US').then(() => {
      return [resId, sourcesNames[sourceIndex]];
    }, () => {
      return this.startFetching(resId, sourceIndex + 1); 
    });
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
      return Promise.reject();
    });
    cache.set(cacheId, prom);
    return prom;
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

this.L10nRegistry = L10nRegistry;
