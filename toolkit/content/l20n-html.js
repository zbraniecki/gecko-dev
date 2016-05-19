(function () {
  'use strict';

  function prioritizeLocales(def, availableLangs, requested) {
    let supportedLocale;
    // Find the first locale in the requested list that is supported.
    for (let i = 0; i < requested.length; i++) {
      const locale = requested[i];
      if (availableLangs.indexOf(locale) !== -1) {
        supportedLocale = locale;
        break;
      }
    }
    if (!supportedLocale ||
        supportedLocale === def) {
      return [def];
    }

    return [supportedLocale, def];
  }

  function getDirection(code) {
    const tag = code.split('-')[0];
    return ['ar', 'he', 'fa', 'ps', 'ur'].indexOf(tag) >= 0 ?
      'rtl' : 'ltr';
  }

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

    if (entity === undefined)  {
      return [
        { value: id, attrs: null },
        [new L10nError(`Unknown entity: ${id}`)]
      ];
    }

    let value = null;

    if (typeof entity === 'string' || Array.isArray(entity) || entity.val !== undefined) {
      value = ctx.format(entity, args)[0];
    }

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

  // match the opening angle bracket (<) in HTML tags, and HTML entities like
  // &amp;, &#0038;, &#x0026;.
  const reOverlay = /<|&#?\w+;/;

  const allowed = {
    elements: [
      'a', 'em', 'strong', 'small', 's', 'cite', 'q', 'dfn', 'abbr', 'data',
      'time', 'code', 'var', 'samp', 'kbd', 'sub', 'sup', 'i', 'b', 'u',
      'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'span', 'br', 'wbr'
    ],
    attributes: {
      global: ['title', 'aria-label', 'aria-valuetext', 'aria-moz-hint'],
      button: ['accesskey'],
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

  function overlayElement(element, translation) {
    const value = translation.value;

    if (typeof value === 'string') {
      if (!reOverlay.test(value)) {
        element.textContent = value;
      } else {
        // start with an inert template element and move its children into
        // `element` but such that `element`'s own children are not replaced
        const tmpl =
          document.createElementNS('http://www.w3.org/1999/xhtml', 'template');
        tmpl.innerHTML = value;
        // overlay the node with the DocumentFragment
        overlay(element, tmpl.content);
      }
    }

    for (let key in translation.attrs) {
      if (isAttrAllowed({ name: key }, element)) {
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
  function overlay(sourceElement, translationElement) {
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
        overlay(sourceChild, childElement);
        result.appendChild(sourceChild);
        continue;
      }

      if (isElementAllowed(childElement)) {
        const sanitizedChild = childElement.ownerDocument.createElement(
          childElement.nodeName);
        overlay(sanitizedChild, childElement);
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
        if (isAttrAllowed(attr, sourceElement)) {
          sourceElement.setAttribute(attr.name, attr.value);
        }
      }
    }
  }

  // XXX the allowed list should be amendable; https://bugzil.la/922573
  function isElementAllowed(element) {
    return allowed.elements.indexOf(element.tagName.toLowerCase()) !== -1;
  }

  function isAttrAllowed(attr, element) {
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

  const reHtml = /[&<>]/g;
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  function setAttributes(element, id, args) {
    element.setAttribute('data-l10n-id', id);
    if (args) {
      element.setAttribute('data-l10n-args', JSON.stringify(args));
    }
    return element;
  }

  function getAttributes(element) {
    return {
      id: element.getAttribute('data-l10n-id'),
      args: JSON.parse(element.getAttribute('data-l10n-args'))
    };
  }

  function getTranslatables(element) {
    const nodes = Array.from(element.querySelectorAll('[data-l10n-id]'));

    if (typeof element.hasAttribute === 'function' &&
        element.hasAttribute('data-l10n-id')) {
      nodes.push(element);
    }

    return nodes;
  }

  function translateMutations(view, mutations) {
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
                getTranslatables(addedNode).forEach(targets.add.bind(targets));
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

    translateElements(view, Array.from(targets));
  }

  function translateFragment(view, frag) {
    return translateElements(view, getTranslatables(frag));
  }

  function getElementsTranslation(view, elems) {
    const keys = elems.map(elem => {
      const id = elem.getAttribute('data-l10n-id');
      const args = elem.getAttribute('data-l10n-args');
      return args ? [
        id,
        JSON.parse(args.replace(reHtml, match => htmlEntities[match]))
      ] : id;
    });

    return view.formatEntities(...keys);
  }

  function translateElements(view, elements) {
    return getElementsTranslation(view, elements).then(
      translations => applyTranslations(view, elements, translations));
  }

  function applyTranslations(view, elems, translations) {
    disconnect(view, null, true);
    for (let i = 0; i < elems.length; i++) {
      try {
        overlayElement(elems[i], translations[i]);
      } catch (e) {
        console.log(e);
      }
    }
    reconnect(view);
  }

  const observerConfig = {
    attributes: true,
    characterData: false,
    childList: true,
    subtree: true,
    attributeFilter: ['data-l10n-id', 'data-l10n-args']
  };

  const observers = new WeakMap();

  function initMutationObserver(view) {
    observers.set(view, {
      roots: new Set(),
      observer: new MutationObserver(
        mutations => translateMutations(view, mutations)),
    });
  }

  function translateRoots(view) {
    const roots = Array.from(observers.get(view).roots);
    return Promise.all(roots.map(
        root => translateFragment(view, root)));
  }

  function observe(view, root) {
    const obs = observers.get(view);
    if (obs) {
      obs.roots.add(root);
      obs.observer.observe(root, observerConfig);
    }
  }

  function disconnect(view, root, allRoots) {
    const obs = observers.get(view);
    if (obs) {
      obs.observer.disconnect();
      if (allRoots) {
        return;
      }
      obs.roots.delete(root);
      obs.roots.forEach(
        other => obs.observer.observe(other, observerConfig));
    }
  }

  function reconnect(view) {
    const obs = observers.get(view);
    if (obs) {
      obs.roots.forEach(
        root => obs.observer.observe(root, observerConfig));
    }
  }

  Components.utils.import("resource://gre/modules/Services.jsm");
  Components.utils.import("resource://gre/modules/IntlMessageContext.jsm");

  const properties = new WeakMap();
  const contexts = new WeakMap();

  class Localization {
    constructor(doc, requestBundles) {
      this.interactive = requestBundles();
      this.ready = this.interactive
        .then(bundles => fetchFirstBundle(bundles))
        .then(bundles => translateDocument(this, bundles));

      this.interactive.then(bundles => {
        this.getValue = function(id, args) {
          return keysFromContext(contexts.get(bundles[0]), [[id, args]], valueFromContext)[0];
        };
      });

      properties.set(this, { doc, requestBundles, ready: false });
      initMutationObserver(this);
      this.observeRoot(doc.documentElement);
    }

    requestLanguages(requestedLangs) {
      return this.ready = this.interactive.then(
        bundles => changeLanguages(this, bundles, requestedLangs)
      );
    }

    handleEvent() {
      return this.requestLanguages();
    }

    formatEntities(...keys) {
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

    translateFragment(frag) {
      return translateFragment(this, frag);
    }

    observeRoot(root) {
      observe(this, root);
    }

    disconnectRoot(root) {
      disconnect(this, root);
    }
  }

  Localization.prototype.setAttributes = setAttributes;
  Localization.prototype.getAttributes = getAttributes;

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

  function createContextFromBundle(bundle) {
    return bundle.fetch().then(resources => {
      const ctx = new MessageContext(bundle.lang, {
        functions
      });
      resources.forEach(res => ctx.addMessages(res));
      contexts.set(bundle, ctx);
      return ctx;
    });
  }

  function fetchFirstBundle(bundles) {
    const [bundle] = bundles;
    return createContextFromBundle(bundle).then(
      () => bundles
    );
  }

  function changeLanguages(l10n, oldBundles, requestedLangs) {
    const { requestBundles } = properties.get(l10n);

    l10n.interactive = requestBundles(requestedLangs).then(
      newBundles => equal(oldBundles, newBundles) ?
        oldBundles : fetchFirstBundle(newBundles)
    );

    return l10n.interactive.then(
      bundles => translateDocument(l10n, bundles)
    );
  }

  function equal(bundles1, bundles2) {
    return bundles1.length === bundles2.length &&
      bundles1.every(({lang}, i) => lang === bundles2[i].lang);
  }

  function translateDocument(l10n, bundles) {
    const langs = bundles.map(bundle => bundle.lang);
    const props = properties.get(l10n);
    const html = props.doc.documentElement;

    function setLangs() {
      html.setAttribute('langs', langs.join(' '));
      html.setAttribute('lang', langs[0]);
      html.setAttribute('dir', getDirection(langs[0]));
    }

    function emit() {
      html.parentNode.dispatchEvent(new CustomEvent('DOMRetranslated', {
        bubbles: false,
        cancelable: false,
      }));
    }

    const next = props.ready ?
      emit : () => props.ready = true;

    return translateRoots(l10n)
      .then(setLangs)
      .then(next);
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
      el => el.getAttribute('href'));
  }

  function getMeta(head) {
    let availableLangs = Object.create(null);
    let defaultLang = null;
    let appVersion = null;

    // XXX take last found instead of first?
    const metas = Array.from(head.querySelectorAll(
      'meta[name="availableLanguages"],' +
      'meta[name="defaultLanguage"],' +
      'meta[name="appVersion"]'));
    for (let meta of metas) {
      const name = meta.getAttribute('name');
      const content = meta.getAttribute('content').trim();
      switch (name) {
        case 'availableLanguages':
          availableLangs = getLangRevisionMap(
            availableLangs, content);
          break;
        case 'defaultLanguage':
          const [lang, rev] = getLangRevisionTuple(content);
          defaultLang = lang;
          if (!(lang in availableLangs)) {
            availableLangs[lang] = rev;
          }
          break;
        case 'appVersion':
          appVersion = content;
      }
    }

    return {
      defaultLang,
      availableLangs,
      appVersion
    };
  }

  function getLangRevisionMap(seq, str) {
    return str.split(',').reduce((prevSeq, cur) => {
      const [lang, rev] = getLangRevisionTuple(cur);
      prevSeq[lang] = rev;
      return prevSeq;
    }, seq);
  }

  function getLangRevisionTuple(str) {
    const [lang, rev]  = str.trim().split(':');
    // if revision is missing, use NaN
    return [lang, parseInt(rev)];
  }

  Components.utils.import("resource://gre/modules/L20n.jsm");

  function requestBundles(requestedLangs = navigator.languages) {
    return documentReady().then(() => {
      const { defaultLang, availableLangs } = getMeta(document.head);
      const resIds = getResourceLinks(document.head);

      const newLangs = prioritizeLocales(
        defaultLang, Object.keys(availableLangs), requestedLangs
      );

      return newLangs.map(
        lang => new ResourceBundle(lang, resIds)
      );
    });
  }

  document.l10n = new Localization(document, requestBundles);
  window.addEventListener('languagechange', document.l10n);

}());