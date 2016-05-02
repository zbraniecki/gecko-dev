/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["L20n"];

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "L20nParser",
                                  "resource://gre/modules/L20nParser.jsm");

Cu.import("resource://gre/modules/IntlMessageContext.jsm");

class Env {
  constructor() {
  }

  createContext(langs, resIds) {
    return new L20nContext(this, langs, resIds);
  }
}

this.L20n = new Env();

const IO = {
  load: function(resId) {
    return 'crashesTitle = Hello World { $user }';
  }
};

class L20nContext {
  constructor(env, langs, resIds) {
    this.messageContexts = {};
    this.resCache = {};
    this.resIds = resIds;
    this.langs = langs;
    this.env = env;

    langs.forEach(lang => {
      this.messageContexts[lang] = new MessageContext(lang);
      this.resCache[lang] = {};
      resIds.forEach(resId => {
        const source = IO.load(resId);
        const [entries, errors] = L20nParser.parseResource(source);
        this.resCache[lang][resId] = entries;
      });
    });
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
}
