/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

Components.utils.import('resource://gre/modules/Services.jsm');

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

const { classes: Cc, interfaces: Ci } = Components;

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

const L20nDemoSource = {
  resMap: {
    '/branding/brand.ftl': {
      'en-US': "brandShortName = Nightly2"
    }
  },

  init(L10nService) {
    this.L10nService = L10nService;
  },

  indexResources() {
    const result = {};

    for (let resId in this.resMap) {
      result[resId] = Object.keys(this.resMap[resId]);
    }
    return result;
  },

  loadResource(resId, lang) {
    return Promise.resolve(this.resMap[resId][lang]);
  },

  handleEvent(evt) {
    let lang = evt.lang;
    let resList = evt.resList;

    for (let [resId, value] of resList) {
      this.resMap[resId][lang] = value;
    }

    this.L10nService.onResourcesChanged(resList.keys());
  },
}

const FileSource = {
  resMap: {
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

  init(L10nService) {
    this.L10nService = L10nService;
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

this.EXPORTED_SYMBOLS = ['L10nService'];

function getLanguages(resIds) {
  const locales = new Set();

  for (let id of resIds) {
    if (resIndex.has(id)) {
      Object.keys(resIndex.get(id)).forEach(lang => {
        locales.add(lang);
      });
    }
  }
  return locales;
}

this.L10nService = {
  getResources(requestedLangs, resIds) {
    const defaultLang = 'en-US';
    const availableLangs = getLanguages(resIds);
    const supportedLocales = prioritizeLocales(
      defaultLang, availableLangs, requestedLangs);
    const resBundles = Array.from(supportedLocales).map(
      lang => new ResourceBundle(lang, resIds)
    );
    return {
      availableLangs,
      resBundles
    };
  },

  registerSource(sourceName, source) {
    resSources.set(sourceName, source);
    source.init(this);
    let resIds = source.indexResources();

    let changedResources = new Set();

    for (let resId in resIds) {
      if (!resIndex.has(resId)) {
        resIndex.set(resId, new Map());
      }
      let resLangs = resIndex.get(resId);
      
      for (let lang of resIds[resId]) {
        if (!resLangs.has(lang)) {
          resLangs.set(lang, []);
        }
        resLangs.get(lang).unshift(sourceName);
        changedResources.add(resId);
      }
    }

    this.onResourcesChanged(changedResources);
  },

  onResourcesChanged(resList) {
    Services.obs.notifyObservers(this, 'language-registry-update', 'add data');
  },

  addL20nDemo() {
    this.registerSource('l20ndemo', L20nDemoSource);
  },

  updateL20nDemo() {
    let resList = new Map();
    resList.set('/branding/brand.ftl', 'brandShortName = Nightly3');
    return L20nDemoSource.handleEvent({
      lang: 'en-US',
      resList
    });
  }
};

this.L10nService.registerSource('file', FileSource);
