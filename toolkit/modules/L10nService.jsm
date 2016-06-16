/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

this.EXPORTED_SYMBOLS = ['L10nService'];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import('resource://gre/modules/Services.jsm');

const HTTP_STATUS_CODE_OK = 200;

function prioritizeLocales(def, availableLangs, requested) {
  const supportedLocales = new Set();
  for (let lang of requested) {
    if (availableLangs.has(lang)) {
      supportedLocales.add(lang);
    }
  }

  supportedLocales.add(def);
  return supportedLocales;
}

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

const FileSource = {
  resMap: {
    '/global/aboutLocalization.ftl': {
      'en-US': [
        'chrome://global/locale/aboutLocalization.en-US.ftl',
      ],
    },
    '/global/aboutSupport.ftl': {
      'en-US': [
        'chrome://global/locale/aboutSupport.en-US.ftl',
      ],
      'pl': [
        'chrome://global/locale/aboutSupport.pl.ftl',
      ]
    },
    '/branding/brand.ftl': {
      'en-US': [
        'chrome://branding/locale/brand.en-US.ftl',
      ],
      'pl': [
        'chrome://branding/locale/brand.pl.ftl',
      ]
    },
    '/global/resetProfile.ftl': {
      'en-US': [
        'chrome://global/locale/resetProfile.en-US.ftl',
      ],
      'pl': [
        'chrome://global/locale/resetProfile.pl.ftl',
      ]
    },
    '/browser/aboutDialog.ftl': {
      'en-US': [
        'chrome://browser/locale/aboutDialog.en-US.ftl',
      ],
      'pl': [
        'chrome://browser/locale/aboutDialog.pl.ftl',
      ]
    },
    '/browser/aboutRobots.ftl': {
      'en-US': [
        'chrome://browser/locale/aboutRobots.en-US.ftl',
      ],
    },
    '/browser/browser.ftl': {
      'en-US': [
        'chrome://browser/locale/browser.en-US.ftl',
      ],
      'pl': [
        'chrome://browser/locale/browser.pl.ftl',
      ]
    },
    '/browser/tabbrowser.ftl': {
      'en-US': [
        'chrome://browser/locale/tabbrowser.en-US.ftl',
      ],
      'pl': [
        'chrome://browser/locale/tabbrowser.pl.ftl',
      ]
    },
  },

  indexResources() {
    const result = {};

    for (let resId in this.resMap) {
      result[resId] = Object.keys(this.resMap[resId]);
    }
    return result;
  },

  loadResource(resId, lang) {
    const url = this.resMap[resId][lang][0];
    return load(url);
  }
}

const resSources = new Map();
const resIndex = new Map();
const resCache = new Map();

function fetchResource(resId, lang) {
  const resSourceName = resIndex.get(resId).get(lang)[0];

  const cacheId = `${resId}-${lang}-${resSourceName}`;

  if (resCache.has(cacheId)) {
    return Promise.resolve(resCache.get(cacheId));
  }

  return resSources.get(resSourceName).loadResource(resId, lang).then(data => {
    resCache.set(cacheId, data);
    return data;
  }).catch(e => e);
}

class ResourceBundle {
  constructor(lang, resIds) {
    this.lang = lang;
    this.loaded = false;
    this.resIds = resIds;
  }

  fetch() {
    if (!this.loaded) {
      this.loaded = Promise.all(
        this.resIds.map(id => fetchResource(id, this.lang))
      );
    }

    return this.loaded;
  }
}

function getLanguages(resIds) {
  const locales = new Set();

  for (let id of resIds) {
    if (resIndex.has(id)) {
      for (let lang of resIndex.get(id).keys()) {
        locales.add(lang);
      }
    }
  }
  return locales;
}

this.L10nService = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs
    );
    const resBundles = Array.from(supportedLocales).map(
      lang => new ResourceBundle(lang, resIds)
    );
    return {
      availableLangs,
      resBundles
    };
  },

  fetchResource(resId, lang) {
    return fetchResource(resId, lang);
  },

  registerSource(sourceName, source) {
    resSources.set(sourceName, source);
    this.onResourcesChanged(sourceName, source.indexResources());
  },

  onResourcesChanged(sourceName, resIds) {
    let changedResources = new Set();

    for (let resId in resIds) {
      if (!resIndex.has(resId)) {
        resIndex.set(resId, new Map());
      }
      let resLangs = resIndex.get(resId);

      for (let lang of resIds[resId]) {
        const cacheId = `${resId}-${lang}-${sourceName}`;
        if (resCache.has(cacheId)) {
          resCache.delete(cacheId);
        }

        if (!resLangs.has(lang)) {
          resLangs.set(lang, []);
        }
        const sources = resLangs.get(lang);
        if (sources.includes(sourceName)) {
          // remove it before it's added in front
          sources.splice(sources.indexOf(sourceName), 1);
        }
        sources.unshift(sourceName);
        changedResources.add(resId);
      }
    }

    if (changedResources.size) {
      Services.obs.notifyObservers(this, 'language-registry-update', 'add data');
    }
  },

  requestResourceInfo() {
    return resIndex;
  },

  requestCacheInfo() {
    return resCache;
  },
};

this.L10nService.registerSource('file', FileSource);
