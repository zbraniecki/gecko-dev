/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

this.EXPORTED_SYMBOLS = ['L10nService', 'ResourceBundle'];

const resIndex = {
  'chrome://global/locale/aboutSupport.{locale}.ftl': ['pl', 'en-US'],
  'chrome://branding/locale/brand.{locale}.ftl': ['pl', 'en-US'],
  'chrome://global/locale/resetProfile.{locale}.ftl': ['pl', 'en-US'],
  'chrome://browser/locale/aboutDialog.ftl': ['pl', 'en-US']
};

const HTTP_STATUS_CODE_OK = 200;

const { classes: Cc, interfaces: Ci } = Components;

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

function fetchResource(res, lang) {
  const url = res.replace('{locale}', lang);
  return load(url).catch(e => e);
}


function prioritizeLocales(def, availableLangs, requested) {
  let supportedLocales = new Set();
  for (let lang of requested) {
    if (availableLangs.has(lang)) {
      supportedLocales.add(lang);
    }
  }
  
  supportedLocales.add(def);

  return supportedLocales;
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
  let locales = new Set();

  for (let id of resIds) {
    if (resIndex[id]) {
      resIndex[id].forEach(resid => locales.add(resid));
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
  
  test() {
    return new ResourceBundle('en-US', []);
  }
};
