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

const { classes: Cc$1, interfaces: Ci$1, utils: Cu$1 } = Components;

Cu$1.import("resource://gre/modules/Services.jsm");
Cu$1.import("resource://gre/modules/IntlMessageContext.jsm");

class Context {
  constructor(env, langs, resIds) {
    this.messageContexts = {};
    this.langs = langs;
    this.resIds = resIds;
    this.env = env;

    this.messageContexts[langs[0]] = new MessageContext(langs[0], {
      formatters: {
        OS: function() {
          switch (Services.appinfo.OS) {
            case 'WINNT':
              return 'win';
            case 'Linux':
              return 'lin';
            case 'Darwin':
              return 'mac';
            case 'Android':
              return 'android';
            default:
              return 'other';
          }
        }
      }
    });
  }

  _formatEntity(lang, args, entity) {
    let value = null;
    let entities = this._getAllEntities(lang);

    if (typeof entity === 'string' || Array.isArray(entity)) {
      value = this.messageContexts[lang].formatEntry(entity, args, entities);
    } else if (entity.val) {
      value = this.messageContexts[lang].formatEntry(entity.val, args, entities);
    }

    const formatted = {
      value,
      attrs: null,
    };

    if (entity.traits) {
      formatted.attrs = Object.create(null);
      for (let trait of entity.traits) {
        const attrValue = this.messageContexts[lang].formatEntry(trait, args, entities);
        formatted.attrs[trait.key.name] = attrValue;
      }
    }

    return formatted;
  }

  _formatValue(lang, args, entity) {
    let entities = this._getAllEntities(lang);
    return this.messageContexts[lang].formatEntry(entity, args, entities);
  }

  fetch(langs = this.langs) {
    if (langs.length === 0) {
      return Promise.resolve(langs);
    }

    return Promise.all(
      this.resIds.map(
        resId => this.env._getResource(langs[0], resId))
    ).then(() => langs);
  }

  _resolve(langs, keys, formatter, prevResolved) {
    const lang = langs[0];

    if (!lang) {
      return reportMissing.call(this, keys, formatter, prevResolved);
    }

    let hasUnresolved = false;

    const resolved = keys.map((key, i) => {
      if (prevResolved && prevResolved[i] !== undefined) {
        return prevResolved[i];
      }
      const [id, args] = Array.isArray(key) ?
        key : [key, undefined];
      const entity = this._getEntity(lang, id);

      if (entity !== undefined) {
        return formatter.call(this, lang, args, entity);
      }

      hasUnresolved = true;
    });

    if (!hasUnresolved) {
      return resolved;
    }

    return this.fetch(langs.slice(1)).then(
      nextLangs => this._resolve(nextLangs, keys, formatter, resolved));
  }

  formatEntities(...keys) {
    return this.fetch().then(
      langs => this._resolve(langs, keys, this._formatEntity));
  }

  formatValues(...keys) {
    return this.fetch().then(
      langs => this._resolve(langs, keys, this._formatValue));
  }

  getValue(id, args) {
    const entity = this._getEntity(this.langs[0], id);
    if (entity === undefined) {
      return id;
    }
    return this._formatValue(this.langs[0], args, entity);
  }

  _getEntity(lang, name) {
    const cache = this.env.resCache;

    // Look for `name` in every resource in order.
    for (let i = 0, resId; resId = this.resIds[i]; i++) {
      const resource = cache.get(resId + lang.code + lang.src);
      if (resource instanceof L10nError) {
        continue;
      }
      if (name in resource) {
        return resource[name];
      }
    }
    return undefined;
  }

  _getAllEntities(lang) {
    const entities = {};
    const cache = this.env.resCache;

    // Look for `name` in every resource in order.
    for (let i = 0, resId; resId = this.resIds[i]; i++) {
      const resource = cache.get(resId + lang.code + lang.src);
      if (resource instanceof L10nError) {
        continue;
      }
      for (let key in resource) {
        entities[key] = resource[key];
      }
    }
    return entities;
  }
}

function reportMissing(keys, formatter, resolved) {
  const missingIds = new Set();

  keys.forEach((key, i) => {
    if (resolved && resolved[i] !== undefined) {
      return;
    }
    const id = Array.isArray(key) ? key[0] : key;
    missingIds.add(id);
    resolved[i] = formatter === this._formatValue ?
      id : {value: id, attrs: null};
  });

  return resolved;
}

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "L20nParser",
                                  "resource://gre/modules/L20nParser.jsm");

class Env {
  constructor(fetchResource) {
    this.fetchResource = fetchResource;

    this.resCache = new Map();
    this.resRefs = new Map();
    this.builtins = null;
  }

  createContext(langs, resIds) {
    const ctx = new Context(this, langs, resIds);
    resIds.forEach(resId => {
      const usedBy = this.resRefs.get(resId) || 0;
      this.resRefs.set(resId, usedBy + 1);
    });

    return ctx;
  }

  destroyContext(ctx) {
    ctx.resIds.forEach(resId => {
      const usedBy = this.resRefs.get(resId) || 0;

      if (usedBy > 1) {
        return this.resRefs.set(resId, usedBy - 1);
      }

      this.resRefs.delete(resId);
      this.resCache.forEach((val, key) =>
        key.startsWith(resId) ? this.resCache.delete(key) : null);
    });
  }

  _getResource(lang, res) {
    const cache = this.resCache;
    const id = res + lang.code + lang.src;

    if (cache.has(id)) {
      return cache.get(id);
    }

    const saveEntries = data => {
      const [entries] = L20nParser.parseResource(data);
      cache.set(id, entries);
    };

    const recover = err => {
      err.lang = lang;
      cache.set(id, err);
    };

    const resource = this.fetchResource(res, lang)
      .then(saveEntries, recover);

    cache.set(id, resource);

    return resource;
  }
}

this.EXPORTED_SYMBOLS = ["L20n"];

this.L20n = new Env(fetchResource);