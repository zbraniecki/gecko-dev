/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

function load(url) {
  const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
  return new Promise((resolve, reject) => {
    var req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                      .createInstance(Ci.nsIXMLHttpRequest)

    req.mozBackgroundRequest = true;
    req.overrideMimeType("text/plain");
    req.open("GET", url, true);

    req.addEventListener('load', () => {
      if (req.status == 200) {
        resolve(req.responseText);
      }
    });
    req.send(null);
  });
}

function fetchResource(res, { code }) {
  const url = res.replace('{locale}', code);
  return load(url);
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

this.EXPORTED_SYMBOLS = ["ResourceBundle"];

this.ResourceBundle = ResourceBundle;