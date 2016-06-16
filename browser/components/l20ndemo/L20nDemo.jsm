// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

this.EXPORTED_SYMBOLS = ["L20nDemo"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/L10nService.jsm");

// See LOG_LEVELS in Console.jsm. Common examples: "All", "Info", "Warn", & "Error".
const PREF_LOG_LEVEL      = "browser.l20ndemo.loglevel";

// Create a new instance of the ConsoleAPI so we can control the maxLogLevel with a pref.
XPCOMUtils.defineLazyGetter(this, "log", () => {
  let ConsoleAPI = Cu.import("resource://gre/modules/Console.jsm", {}).ConsoleAPI;
  let consoleOptions = {
    maxLogLevelPref: PREF_LOG_LEVEL,
    prefix: "L20nDemo",
  };
  return new ConsoleAPI(consoleOptions);
});

this.L20nDemo = {

  init: function() {
    log.debug("Initializing L20nDemo");
  },

  onPageEvent: function(aMessage, aEvent) {
    let browser = aMessage.target;
    let messageManager = browser.messageManager;

    log.debug("onPageEvent:", aEvent.detail);

    if (typeof aEvent.detail != "object") {
      log.warn("Malformed event - detail not an object");
      return false;
    }

    let requestId = aEvent.detail.requestId;
    if (requestId !== null && typeof requestId != "string") {
      log.warn("Request ID not defined");
      return false;
    }

    let action = aEvent.detail.action;
    if (typeof action != "string") {
      log.warn("Action not defined");
      return false;
    }

    let data = aEvent.detail.data;
    if (typeof data != "object") {
      log.warn("Malformed event - data not an object");
      return false;
    }

    if ((aEvent.pageVisibilityState == "hidden" ||
         aEvent.pageVisibilityState == "unloaded")) {
      log.warn("Ignoring disallowed action from a hidden page:", action);
      return false;
    }

    switch (action) {
      case "helo": {
        this.sendPageResponse(messageManager, requestId);
        break;
      }
      case "register": {
        const { resId, lang, messages } = data;
        this.updateResource(resId, lang, messages);
        L10nService.registerSource("l20ndemo", this);
        this.sendPageResponse(messageManager, requestId);
        break;
      }
      case "update": {
        const { resId, lang, messages } = data;
        this.updateResource(resId, lang, messages);
        L10nService.onResourcesChanged("l20ndemo", { [resId]: [lang] });
        this.sendPageResponse(messageManager, requestId);
        break;
      }
      case "incremental": {
        Services.obs.notifyObservers(
          null,
          "language-registry-incremental",
          JSON.stringify(data)
        );
        break;
      }
    }

    return true;
  },

  sendPageResponse: function(aMessageManager, aRequestId) {
    if (aRequestId === null) {
      return false;
    }

    let detail = {requestId: aRequestId};
    log.debug("sendPageResponse:", detail);
    aMessageManager.sendAsyncMessage("L20nDemo:SendPageResponse", detail);

    return true;
  },

  resMap: {},

  updateResource(resId, lang, messages) {
    if (resId === undefined) {
      log.info("Undefined resource id");
      return false;
    }

    if (lang === undefined) {
      log.info("Undefined language");
      return false;
    }

    if (messages === undefined) {
      log.info("Undefined messages");
      return false;
    }

    if (resId in this.resMap) {
     return this.resMap[resId][lang] = messages;
    }

    this.resMap[resId] = {
      [lang]: messages
    };
  },

  indexResources() {
    const index = {};

    for (let resId in this.resMap) {
      index[resId] = new Set(Object.keys(this.resMap[resId]));
    }

    return index;
  },

  loadResource(resId, lang) {
    return Promise.resolve(this.resMap[resId][lang]);
  },

};

this.L20nDemo.init();
