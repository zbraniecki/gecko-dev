{

class L10nError extends Error {
  constructor(message, id, lang) {
    super();
    this.name = 'L10nError';
    this.message = message;
    this.id = id;
    this.lang = lang;
  }
}

function keysFromContext(ctx, keys, method) {
  return keys.map(key => {
    const [id, args] = Array.isArray(key) ?
      key : [key, undefined];

    // XXX Handle errors somehow; emit?
    const [result] = method.call(this, ctx, id, args);
    return result;
  });
}

function valueFromContext(ctx, id, args) {
  const entity = ctx.messages.get(id);

  if (entity === undefined) {
    return [id, [new L10nError(`Unknown entity: ${id}`)]];
  }

  return ctx.format(entity, args);
}

function entityFromContext(ctx, id, args) {
  const entity = ctx.messages.get(id);

  if (entity === undefined) {
    return [
      { value: id, attrs: null },
      [new L10nError(`Unknown entity: ${id}`)]
    ];
  }

  const [value] = ctx.formatToPrimitive(entity, args);

  const formatted = {
    value,
    attrs: null,
  };

  if (entity.traits) {
    formatted.attrs = Object.create(null);
    for (let trait of entity.traits) {
      const [attrValue] = ctx.format(trait, args);
      formatted.attrs[trait.key.name] = attrValue;
    }
  }

  return [formatted, []];
}

function getDirection(code) {
  const tag = code.split('-')[0];
  return ['ar', 'he', 'fa', 'ps', 'ur'].indexOf(tag) >= 0 ?
    'rtl' : 'ltr';
}

const reHtml = /[&<>]/g;
const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const observerConfig = {
  attributes: true,
  characterData: false,
  childList: true,
  subtree: true,
  attributeFilter: ['data-l10n-id', 'data-l10n-args']
};

class LocalizationObserver {
  constructor() {
    this.roots = new Map();
    this.observer = new MutationObserver(
      mutations => this.translateMutations(mutations)
    );
  }

  observeRoot(root, l10n) {
    this.roots.set(root, l10n);
    this.observer.observe(root, observerConfig);
  }

  disconnectRoot(root) {
    this.pause();
    this.roots.delete(root);
    this.resume();
  }

  pause() {
    this.observer.disconnect();
  }

  resume() {
    this.roots.forEach(
      (_, root) => this.observer.observe(root, observerConfig)
    );
  }

  requestLanguages(requestedLangs) {
    const localizations = Array.from(new Set(this.roots.values()));
    return Promise.all(
      localizations.map(l10n => l10n.requestLanguages(requestedLangs))
    ).then(
      () => this.translateRoots()
    )
  }

  handleEvent() {
    return this.requestLanguages();
  }

  getTranslatables(element) {
    const nodes = Array.from(element.querySelectorAll('[data-l10n-id]'));

    if (typeof element.hasAttribute === 'function' &&
        element.hasAttribute('data-l10n-id')) {
      nodes.push(element);
    }

    return nodes;
  }

  translateMutations(mutations) {
    const targets = new Set();

    for (let mutation of mutations) {
      switch (mutation.type) {
        case 'attributes':
          targets.add(mutation.target);
          break;
        case 'childList':
          for (let addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === addedNode.ELEMENT_NODE) {
              if (addedNode.childElementCount) {
                this.getTranslatables(addedNode).forEach(
                  targets.add.bind(targets)
                );
              } else {
                if (addedNode.hasAttribute('data-l10n-id')) {
                  targets.add(addedNode);
                }
              }
            }
          }
          break;
      }
    }

    if (targets.size === 0) {
      return;
    }

    this.translateElements(Array.from(targets));
  }

  getLocalizationForElement(elem) {
    // check data-l10n-bundle
  }

  // XXX the following needs to be optimized, perhaps getTranslatables should 
  // sort elems by localization they refer to so that it is easy to group them, 
  // handle each group individually and finally concatenate the resulting 
  // translations into a flat array whose elements correspond one-to-one to 
  // elems?
  getElementsTranslation(elems) {
    const keys = elems.map(elem => {
      const args = elem.getAttribute('data-l10n-args');
      return [
        this.getLocalizationForElement(elem),
        elem.getAttribute('data-l10n-id'),
        args ?
          JSON.parse(args.replace(reHtml, match => htmlEntities[match])) :
          null
      ];
    });

    return Promise.all(
      keys.map(
        ([l10n, id, args]) => l10n.formatEntities([[id, args]]).then(
          translations => [l10n, translations]
        )
      )
    );
  }

  translateRoots() {
    const roots = Array.from(this.roots);
    return Promise.all(
      roots.map(([root, l10n]) => l10n.interactive.then(
        bundles => this.translateRoot(root, bundles.map(bundle => bundle.lang))
      ))
    );
  }

  translateRoot(root) {
    const l10n = this.roots.get(root);
    return l10n.interactive.then(bundles => {
      const langs = bundles.map(bundle => bundle.lang);

      function setLangs() {
        const wasLocalizedBefore = root.hasAttribute('langs');

        root.setAttribute('langs', langs.join(' '));
        root.setAttribute('lang', langs[0]);
        root.setAttribute('dir', getDirection(langs[0]));

        if (wasLocalizedBefore) {
          root.dispatchEvent(new CustomEvent('DOMRetranslated', {
            bubbles: false,
            cancelable: false,
          }));
        }
      }

      return this.translateFragment(root).then(setLangs);
    });
  }

  translateFragment(frag) {
    return this.translateElements(this.getTranslatables(frag));
  }

  translateElements(elements) {
    return this.getElementsTranslation(elements).then(
      translations => this.applyTranslations(elements, translations));
  }

  applyTranslations(elems, translations) {
    this.pause();
    for (let i = 0; i < elems.length; i++) {
      const [l10n, [translation]] = translations[i];
      l10n.overlayElement(elems[i], translation);
    }
    this.resume();
  }

}

class ChromeLocalizationObserver extends LocalizationObserver {
  getLocalizationForElement(elem) {
    // check data-l10n-bundle, check for BindingParent, getAnonymousNodes if 
    // needed
    return Array.from(this.roots.values())[0];
  }
}

const properties = new WeakMap();
const contexts = new WeakMap();

class Localization {
  constructor(requestBundles, createContext) {
    this.interactive = requestBundles().then(
      bundles => fetchFirstBundle(bundles, createContext)
    );

    properties.set(this, {
      requestBundles, createContext
    });
  }

  requestLanguages(requestedLangs) {
    return this.interactive.then(
      bundles => changeLanguages(this, bundles, requestedLangs)
    );
  }

  formatEntities(keys) {
    // XXX add async fallback
    return this.interactive.then(
      ([bundle]) => keysFromContext(
        contexts.get(bundle), keys, entityFromContext
      )
    );
  }

  formatValues(...keys) {
    return this.interactive.then(
      ([bundle]) => keysFromContext(
        contexts.get(bundle), keys, valueFromContext
      )
    );
  }

  formatValue(id, args) {
    return this.formatValues([id, args]).then(
      ([val]) => val
    );
  }

  setAttributes(element, id, args) {
    element.setAttribute('data-l10n-id', id);
    if (args) {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    }
    return element;
  }

  getAttributes(element) {
    return {
      id: element.getAttribute('data-l10n-id'),
      args: JSON.parse(element.getAttribute('data-l10n-args'))
    };
  }

}

function createContextFromBundle(bundle, createContext) {
  return bundle.fetch().then(resources => {
    const ctx = createContext(bundle.lang);
    resources
      .filter(res => !(res instanceof Error))
      .forEach(res => ctx.addMessages(res));
    contexts.set(bundle, ctx);
    return ctx;
  });
}

function fetchFirstBundle(bundles, createContext) {
  const [bundle] = bundles;
  return createContextFromBundle(bundle, createContext).then(
    () => bundles
  );
}

function changeLanguages(l10n, oldBundles, requestedLangs) {
  const { requestBundles, createContext } = properties.get(l10n);

  return l10n.interactive = requestBundles(requestedLangs).then(
    newBundles => equal(oldBundles, newBundles) ?
      oldBundles : fetchFirstBundle(newBundles, createContext)
  );
}

function equal(bundles1, bundles2) {
  return bundles1.length === bundles2.length &&
    bundles1.every(({lang}, i) => lang === bundles2[i].lang);
}

// match the opening angle bracket (<) in HTML tags, and HTML entities like
// &amp;, &#0038;, &#x0026;.
const reOverlay = /<|&#?\w+;/;

function overlayElement(l10n, element, translation) {
  const value = translation.value;

  if (typeof value === 'string') {
    if (!reOverlay.test(value)) {
      element.textContent = value;
    } else {
      // start with an inert template element and move its children into
      // `element` but such that `element`'s own children are not replaced
      const tmpl = element.ownerDocument.createElementNS(
        'http://www.w3.org/1999/xhtml', 'template');
      tmpl.innerHTML = value;
      // overlay the node with the DocumentFragment
      overlay(l10n, element, tmpl.content);
    }
  }

  for (let key in translation.attrs) {
    if (l10n.isAttrAllowed({ name: key }, element)) {
      element.setAttribute(key, translation.attrs[key]);
    }
  }
}

// The goal of overlay is to move the children of `translationElement`
// into `sourceElement` such that `sourceElement`'s own children are not
// replaced, but only have their text nodes and their attributes modified.
//
// We want to make it possible for localizers to apply text-level semantics to
// the translations and make use of HTML entities. At the same time, we
// don't trust translations so we need to filter unsafe elements and
// attributes out and we don't want to break the Web by replacing elements to
// which third-party code might have created references (e.g. two-way
// bindings in MVC frameworks).
function overlay(l10n, sourceElement, translationElement) {
  const result = translationElement.ownerDocument.createDocumentFragment();
  let k, attr;

  // take one node from translationElement at a time and check it against
  // the allowed list or try to match it with a corresponding element
  // in the source
  let childElement;
  while ((childElement = translationElement.childNodes[0])) {
    translationElement.removeChild(childElement);

    if (childElement.nodeType === childElement.TEXT_NODE) {
      result.appendChild(childElement);
      continue;
    }

    const index = getIndexOfType(childElement);
    const sourceChild = getNthElementOfType(sourceElement, childElement, index);
    if (sourceChild) {
      // there is a corresponding element in the source, let's use it
      overlay(l10n, sourceChild, childElement);
      result.appendChild(sourceChild);
      continue;
    }

    if (l10n.isElementAllowed(childElement)) {
      const sanitizedChild = childElement.ownerDocument.createElement(
        childElement.nodeName);
      overlay(l10n, sanitizedChild, childElement);
      result.appendChild(sanitizedChild);
      continue;
    }

    // otherwise just take this child's textContent
    result.appendChild(
      translationElement.ownerDocument.createTextNode(
        childElement.textContent));
  }

  // clear `sourceElement` and append `result` which by this time contains
  // `sourceElement`'s original children, overlayed with translation
  sourceElement.textContent = '';
  sourceElement.appendChild(result);

  // if we're overlaying a nested element, translate the allowed
  // attributes; top-level attributes are handled in `translateElement`
  // XXX attributes previously set here for another language should be
  // cleared if a new language doesn't use them; https://bugzil.la/922577
  if (translationElement.attributes) {
    for (k = 0, attr; (attr = translationElement.attributes[k]); k++) {
      if (l10n.isAttrAllowed(attr, sourceElement)) {
        sourceElement.setAttribute(attr.name, attr.value);
      }
    }
  }
}

// Get n-th immediate child of context that is of the same type as element.
// XXX Use querySelector(':scope > ELEMENT:nth-of-type(index)'), when:
// 1) :scope is widely supported in more browsers and 2) it works with
// DocumentFragments.
function getNthElementOfType(context, element, index) {
  /* jshint boss:true */
  let nthOfType = 0;
  for (let i = 0, child; child = context.children[i]; i++) {
    if (child.nodeType === child.ELEMENT_NODE &&
        child.tagName.toLowerCase() === element.tagName.toLowerCase()) {
      if (nthOfType === index) {
        return child;
      }
      nthOfType++;
    }
  }
  return null;
}

// Get the index of the element among siblings of the same type.
function getIndexOfType(element) {
  let index = 0;
  let child;
  while ((child = element.previousElementSibling)) {
    if (child.tagName === element.tagName) {
      index++;
    }
  }
  return index;
}

const allowed = {
  elements: [
    'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data',
    'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u',
    'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'span', 'br', 'wbr'
  ],
  attributes: {
    global: ['title', 'aria-label', 'aria-valuetext', 'aria-moz-hint'],
    a: ['download'],
    area: ['download', 'alt'],
    // value is special-cased in isAttrAllowed
    input: ['alt', 'placeholder'],
    menuitem: ['label'],
    menu: ['label'],
    optgroup: ['label'],
    option: ['label'],
    track: ['label'],
    img: ['alt'],
    textarea: ['placeholder'],
    th: ['abbr']
  }
};

class HTMLLocalization extends Localization {
  overlayElement(element, translation) {
    return overlayElement(this, element, translation);
  }

  // XXX the allowed list should be amendable; https://bugzil.la/922573
  isElementAllowed(element) {
    return allowed.elements.indexOf(element.tagName.toLowerCase()) !== -1;
  }

  isAttrAllowed(attr, element) {
    const attrName = attr.name.toLowerCase();
    const tagName = element.tagName.toLowerCase();
    // is it a globally safe attribute?
    if (allowed.attributes.global.indexOf(attrName) !== -1) {
      return true;
    }
    // are there no allowed attributes for this element?
    if (!allowed.attributes[tagName]) {
      return false;
    }
    // is it allowed on this element?
    // XXX the allowed list should be amendable; https://bugzil.la/922573
    if (allowed.attributes[tagName].indexOf(attrName) !== -1) {
      return true;
    }
    // special case for value on inputs with type button, reset, submit
    if (tagName === 'input' && attrName === 'value') {
      const type = element.type.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'reset') {
        return true;
      }
    }
    return false;
  }

}

// A document.ready shim
// https://github.com/whatwg/html/issues/127
function documentReady() {
  if (document.readyState !== 'loading') {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    document.addEventListener('readystatechange', function onrsc() {
      document.removeEventListener('readystatechange', onrsc);
      resolve();
    });
  });
}

function getResourceLinks(head) {
  return Array.prototype.map.call(
    head.querySelectorAll('link[rel="localization"]'),
    el => el.getAttribute('href')
  );
}

function observe(subject, topic, data) {
  switch (topic) {
    case 'language-update': {
      this.interactive = this.interactive.then(bundles => {
        // just overwrite any existing messages in the first bundle
        const ctx = contexts.get(bundles[0]);
        ctx.addMessages(data);
        return bundles;
      });
      return this.interactive.then(
        bundles => translateDocument(this, bundles)
      );
    }
    default: {
      throw new Error(`Unknown topic: ${topic}`);
    }
  }
}

Components.utils.import('resource://gre/modules/Services.jsm');
Components.utils.import('resource://gre/modules/L10nService.jsm');
Components.utils.import('resource://gre/modules/IntlMessageContext.jsm');

function requestBundles(requestedLangs = new Set(navigator.languages)) {
  return documentReady().then(() => {
    const resIds = getResourceLinks(document.head);
    const {
      resBundles
    } = L10nService.getResources(requestedLangs, resIds);

    return resBundles;
  });
}

const functions = {
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
};

function createContext(lang) {
  return new MessageContext(lang, { functions });
}

const localization = new HTMLLocalization(requestBundles, createContext);
localization.observe = observe;
localization.interactive.then(bundles => {
  localization.getValue = function(id, args) {
    return valueFromContext(contexts.get(bundles[0]), id, args)[0];
  };
});

Services.obs.addObserver(localization, 'language-update', false);

document.l10n = new ChromeLocalizationObserver();
document.l10n.observeRoot(document.documentElement, localization);
document.l10n.translateRoot(document.documentElement);
window.addEventListener('languagechange', document.l10n);

}