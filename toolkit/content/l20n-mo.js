Components.utils.import("resource://gre/modules/IntlMessageContext.jsm");
Components.utils.import("resource://gre/modules/L10nRegistryNoIndex.jsm");

const ctx = new MessageContext('en-US');
let ctxReadyResolve;
let ctxReady = new Promise((resolve, reject) => {
  ctxReadyResolve = resolve;
});
/*

const HTTP_STATUS_CODE_OK = 200;

function load2(path) {
  let url = 'resource://' + path;

  const req = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
    .createInstance(Components.interfaces.nsIXMLHttpRequest);

  req.mozBackgroundRequest = true;
  req.overrideMimeType('text/plain');

  req.open('GET', url, false);

  req.send(null);

  return req.responseText;
}

function load(path) {
  let url = 'resource://' + path;

  return new Promise((resolve, reject) => {
    const req = Components.classes['@mozilla.org/xmlextras/xmlhttprequest;1']
      .createInstance(Components.interfaces.nsIXMLHttpRequest);

    req.mozBackgroundRequest = true;
    req.overrideMimeType('text/plain');

    try {
      req.open('GET', url, true);
    } catch (e) {
      reject(e);
    }

    req.addEventListener('load', () => {
      if (req.status === HTTP_STATUS_CODE_OK) {
        resolve(req.responseText);
      } else {
        reject(new Error('Not found: ' + url));
      }
    });

    req.addEventListener('error', reject);
    req.addEventListener('timeout', reject);

    try {
      req.send(null);
    } catch(e) {
      reject(e);
    }
  }, true);
}

let links = [
  '/chrome/en-US/locale/branding/brand.en-US.ftl',
  'gre/chrome/en-US/locale/en-US/global/resetProfile.en-US.ftl',
  'gre/chrome/en-US/locale/en-US/global/aboutSupport.en-US.ftl',
];

function getResources1() {
  performance.mark('io-start');
  Promise.all(links.map(link => load(link))).then(sources => {
    performance.mark('io-loaded');
    sources.map(source => ctx.addMessages(source));
    performance.mark('io-parsed');
    ctxReadyResolve();
    let startIo = performance.getEntriesByName('io-start')[0];
    let loadedIo = performance.getEntriesByName('io-loaded')[0];
    let parsedIo = performance.getEntriesByName('io-parsed')[0];
    console.log('io-start: ' + startIo.startTime);
    console.log('io-loaded: ' + loadedIo.startTime);
    console.log('io-parsed: ' + parsedIo.startTime);
    //document.removeLayoutStartBlocker();
  })
}

function getResources2() {
  performance.mark('io-start');
  let sources = links.map(link => load2(link));
  performance.mark('io-loaded');
  sources.map(source => ctx.addMessages(source));
  performance.mark('io-parsed');
  let startIo = performance.getEntriesByName('io-start')[0];
  let loadedIo = performance.getEntriesByName('io-loaded')[0];
  let parsedIo = performance.getEntriesByName('io-parsed')[0];
  console.log('io-start: ' + startIo.startTime);
  console.log('io-loaded: ' + loadedIo.startTime);
  console.log('io-parsed: ' + parsedIo.startTime);
}
*/

function getResources3() {
  performance.mark('io-start');
  L10nRegistryNoIndex.getResources(['en-US'], [
    '/branding/brand.ftl',
    '/global/resetProfile.ftl',
    '/global/aboutSupport.ftl'
  ]).then(({bundles}) => {
    performance.mark('io-loaded');
    for (let resId in bundles[0].resources) {
      ctx.addMessages(bundles[0].resources[resId].data);
    }
    performance.mark('io-parsed');
    ctxReadyResolve();
    let startIo = performance.getEntriesByName('io-start')[0];
    let loadedIo = performance.getEntriesByName('io-loaded')[0];
    let parsedIo = performance.getEntriesByName('io-parsed')[0];
    console.log('io-start: ' + startIo.startTime);
    console.log('io-loaded: ' + loadedIo.startTime);
    console.log('io-parsed: ' + parsedIo.startTime);
  });
}

getResources3();

function getTranslatables(element) {
  const nodes = Array.from(element.querySelectorAll('[data-l10n-id]'));

  if (typeof element.hasAttribute === 'function') {
    if (element.hasAttribute('data-l10n-id')) {
      nodes.push(element);
    }
  }

  return nodes;
}

const target = document.documentElement;

const observer = new MutationObserver((mutations) => {
  const targets = new Set();

  mutations.forEach(mutation => {
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
  });

  if (targets.size === 0) {
    return;
  }

  translateElements(Array.from(targets));
});

function translateElements(elements) {
  console.log('translateElements called');
  ctxReady.then(() => {
    elements.forEach(elem => {
      let id = elem.getAttribute('data-l10n-id');
      let val = ctx.format(ctx.messages.get(id))[0];
      //let val = id;
      elem.textContent = val + ' -- ' + performance.now();
    });
  });
}

const observerConfig = {
  attributes: true,
  characterData: false,
  childList: true,
  subtree: true,
  attributeFilter: ['data-l10n-id', 'data-l10n-args', 'data-l10n-bundle']
};

observer.observe(target, observerConfig);
