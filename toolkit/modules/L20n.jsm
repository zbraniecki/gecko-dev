/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["L20n"];

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "L20nParser",
                                  "resource://gre/modules/L20nParser.jsm");

Cu.import("resource://gre/modules/IntlMessageContext.jsm");

class Env {
  constructor() {
  }

  createContext(langs, resIds) {
    const ctx = new L20nContext(this, langs, resIds);

    return ctx.loadResources().then(() => {
      return ctx;
    });
  }
}

this.L20n = new Env();

const IO = {
  load: function(url) {
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
    /*let hiddenWindow = Services.appShell.hiddenDOMWindow;
    return new Promise((resolve, reject) => {
      const xhr = new hiddenWindow.XmlHttpRequest();

      xhr.open('GET', url, true);

      xhr.addEventListener('load', e => {
        if (e.target.status = 200) {
          resolve(e.target.response);
        } else {
          reject('Not found: ' + url);
        }
      });
    });*/
    /*return hiddenWindow.fetch(url).then(response => {
      return response.text();
    });*/
  }
};

class L20nContext {
  constructor(env, langs, resIds) {
    this.messageContexts = {};
    this.resCache = {};
    this.resIds = resIds;
    this.langs = langs;
    this.env = env;

  }

  loadResources() {
    let resLoading = [];

    this.langs.forEach(lang => {
      this.messageContexts[lang] = new MessageContext(lang, {
        formatters: {
          OS: function() {
            // you call me a stub? Your mom is a stub!
            return 'mac';
          }
        }
      });
      this.resCache[lang] = {};

      this.resIds.forEach(resId => {
        resLoading.push(IO.load(resId).then(source => {
          const [entries, errors] = L20nParser.parseResource(source);
          this.resCache[lang][resId] = entries;
        }));
      });
    });

    return Promise.all(resLoading);
  }

  getValue(id, args) {
    let res;

    this.resIds.forEach(resId => {
      if (this.resCache[this.langs[0]][resId].hasOwnProperty(id)) {
        res = resId;
      }
    });
    if (!res) {
      return 'No Entity for id ' + id;
    }
    const entry = this.resCache[this.langs[0]][res][id];

    return this.messageContexts[this.langs[0]].formatEntry(entry, args);
  }

  getEntity(id, args) {
    let res;

    this.resIds.forEach(resId => {
      if (this.resCache[this.langs[0]][resId].hasOwnProperty(id)) {
        res = resId;
      }
    });
    if (!res) {
      return {
        value: 'No Entity for id ' + id,
        traits: {}
      };
    }

    const entries = this.resCache[this.langs[0]][res];
    const entry = entries[id];
    const msgCtx = this.messageContexts[this.langs[0]];

    let value, traits;

    if (typeof entry === 'string' || Array.isArray(entry)) {
      value = entry;
    } else {
      value = entry.val;
      traits = entry.traits;
    }

    const formatted = {
      value: msgCtx.formatEntry(value, args, entries),
      traits: null
    };
    
    if (traits) {
      formatted.traits = Object.create(null);

      traits.forEach(trait => {
        let key = trait.key.ns ?
          `${trait.key.ns}/${trait.key.name}` : trait.key.name;
        formatted.traits[key] = msgCtx.formatEntry(trait.val, args, entries);
      });
    }

    return formatted;
  }

  formatEntities(...keys) {
    return keys.map(key => {
      let id = Array.isArray(key) ? key[0] : key;
      let args = Array.isArray(key) ? key[1] : undefined;
      
      try {
        return this.getEntity(id, args);
      } catch (e) {
        console.log('Error getting entity: ' + id);
        console.log(e);
        return {
          value: id,
          traits: null
        };
      }
    });
  }
}
