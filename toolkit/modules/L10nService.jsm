/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

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

const resIndex = {
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
};


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

function fetchResource(resId, lang) {
  const url = resIndex[resId][lang][0];
  return load(url).catch(e => e);
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
    if (resIndex[id]) {
      Object.keys(resIndex[id]).forEach(lang => {
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
};