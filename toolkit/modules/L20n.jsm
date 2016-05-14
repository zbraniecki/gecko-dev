/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

class L10nError extends Error {
  constructor(message, id, lang) {
    super();
    this.name = 'L10nError';
    this.message = message;
    this.id = id;
    this.lang = lang;
  }
}

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

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/IntlMessageContext.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "L20nParser",
                                  "resource://gre/modules/L20nParser.jsm");

class Context {
  constructor(langs, resIds) {
    this.langs = langs;
    this.resIds = resIds;
    this.messages = new Map();
  }

  formatValues() {
    throw new L10nError('Not implemented');
  }

  formatEntities() {
    throw new L10nError('Not implemented');
  }
}

class SimpleContext extends Context {
  constructor(langs, resIds, resources) {
    super(langs, resIds);
    this.bundle = new MessageContext(langs[0].code);
    resources.forEach(res => {
      const [entries] = L20nParser.parseResource(res);
      for (let i in entries) {
        this.messages.set(i, entries[i]);
      }
    });
  }

  _formatKeys(keys, method) {
    return keys.map(key => {
      const [id, args] = Array.isArray(key) ?
        key : [key, undefined];

      // XXX Context should handle errors somehow; emit/return?
      const [result] = method.call(this, id, args);
      return result;
    });
  }

  formatValue(id, args) {
    const entity = this.messages.get(id);

    if (entity === undefined) {
      return [id, [new L10nError(`Unknown entity: ${id}`)]];
    }

    return this.bundle.format(entity, args, this.messages);
  }

  formatEntity(id, args) {
    const entity = this.messages.get(id);

    if (entity === undefined)  {
      return [
        { value: id, attrs: null },
        [new L10nError(`Unknown entity: ${id}`)]
      ];
    }

    let value = null;

    if (typeof entity === 'string' || Array.isArray(entity) || entity.val !== undefined) {
      value = this.bundle.format(entity, args, this.messages)[0];
    }

    const formatted = {
      value,
      attrs: null,
    };

    if (entity.traits) {
      formatted.attrs = Object.create(null);
      for (let trait of entity.traits) {
        const [attrValue] = this.bundle.format(trait, args, this.messages);
        formatted.attrs[trait.key.name] = attrValue;
      }
    }

    // XXX return errors
    return [formatted, []];
  }


  formatValues(...keys) {
    return this._formatKeys(keys, this.constructor.prototype.formatValue);
  }

  formatEntities(...keys) {
    return this._formatKeys(keys, this.constructor.prototype.formatEntity);
  }
}

SimpleContext.create = function(fetchResource, langs, resIds) {
  const [first] = langs;

  return Promise.all(
    resIds.map(resId => fetchResource(resId, first))
  ).then(
    resources => new SimpleContext(
      langs, resIds, resources.filter(res => !(res instanceof Error))
    )
  );
}

this.EXPORTED_SYMBOLS = ["L20n"];

this.L20n = {
  createSimpleContext: function(langs, resIds) {
    return SimpleContext.create(fetchResource, langs, resIds);
  }
}