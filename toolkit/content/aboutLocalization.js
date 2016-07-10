/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { utils: Cu } = Components;

Cu.import('resource://gre/modules/L10nRegistry.jsm');

const gInfoRequests = {
  resources: () => displayResources(L10nRegistry.requestResourceInfo()),
  cache: () => displayCache(L10nRegistry.requestCacheInfo()),
};

function col(element, rowspan = 1) {
  const col = document.createElement('td');
  col.setAttribute('rowspan', rowspan);
  const content = document.createTextNode(element);
  col.appendChild(content);
  return col;
}

function displayResources(data) {
  const cont = document.getElementById('resources_content');
  const parent = cont.parentNode;
  const new_cont = document.createElement('tbody');
  new_cont.setAttribute('id', 'resources_content');

  for (let [resId, langs] of data) {
    let createResourceCell = true;
    for (let [lang, sources] of langs) {
      const row = document.createElement('tr');
      if (createResourceCell) {
        createResourceCell = false;
        row.appendChild(col(resId, langs.size));
      }
      row.appendChild(col(lang));
      row.appendChild(col(Array.from(sources).join(', ')));
      new_cont.appendChild(row);
    }
  }

  parent.replaceChild(new_cont, cont);
}

function toggleExpand(e) {
  e.target.classList.toggle('expanded');
}

function displayCache(data) {
  const cont = document.getElementById('cache_content');
  const parent = cont.parentNode;
  const new_cont = document.createElement('dl');
  new_cont.setAttribute('id', 'cache_content');

  for (let [key, value] of data) {
    const dt = document.createElement('dt');
    dt.appendChild(document.createTextNode(key));
    new_cont.appendChild(dt);

    const dd = document.createElement('dd');
    dd.addEventListener('click', toggleExpand);
    dd.appendChild(document.createTextNode(value));
    new_cont.appendChild(dd);
  }

  parent.replaceChild(new_cont, cont);
}

function requestAllData() {
  for (let id in gInfoRequests)
    gInfoRequests[id]();
}

function init() {
  requestAllData();

  const refr = document.getElementById("refreshButton");
  refr.addEventListener("click", requestAllData);

  // Event delegation on #categories element
  const menu = document.getElementById("categories");
  menu.addEventListener("click", function click(e) {
    if (e.target && e.target.parentNode == menu)
      show(e.target);
  });

}

function show(button) {
  const current_tab = document.querySelector(".active");
  const content = document.getElementById(button.getAttribute("value"));
  if (current_tab == content)
    return;
  current_tab.classList.remove("active");
  current_tab.hidden = true;
  content.classList.add("active");
  content.hidden = false;

  const current_button = document.querySelector("[selected=true]");
  current_button.removeAttribute("selected");
  button.setAttribute("selected", "true");

  const title = document.getElementById("sectionTitle");
  const l10nId = button.children[0].getAttribute('data-l10n-id');
  title.setAttribute('data-l10n-id', l10nId);
}

window.addEventListener("DOMContentLoaded", function load() {
  window.removeEventListener("DOMContentLoaded", load);
  init();
});
