
const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/L20n.jsm");


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

export function getMeta(head) {
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

function translateRoots(view) {
  const roots = Array.from(observers.get(view).roots);
  return Promise.all(roots.map(
      root => translateFragment(view, root)));
}

function translateFragment(view, frag) {
  return translateElements(view, getTranslatables(frag));
}

function translateElements(view, elements) {
  return getElementsTranslation(view, elements).then(
    translations => applyTranslations(view, elements, translations));
}

function applyTranslations(view, elems, translations) {
  disconnect(view, null, true);
  for (let i = 0; i < elems.length; i++) {
    overlayElement(elems[i], translations[i]);
  }
  reconnect(view);
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

class View {
  constructor() {
    this.roots = [
      document
    ];
    const initalized = documentReady().then(() => init());
    initialized.then(langs => translateView(this, langs));
  }
}

function init() {
	const resource = getResourceLinks(document.head);
	const meta = getMeta(document.head);
}

document.l10n = new View();
