// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

this.EXPORTED_SYMBOLS = ["L20nDemo"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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

    let action = aEvent.detail.action;
    if (typeof action != "string" || !action) {
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
        // XXX check if the languages are the same
        this.sendPageResponse(messageManager, "ehlo");
        break;
      }
      case "create": {
        Services.obs.notifyObservers(
          null,
          // XXX this should be "language-create" which will create a new 
          // MessageContext but Localization doesn't support it yet
          "language-update",
          data.messages
        );
        this.sendPageResponse(messageManager, "created");
        break;
      }
      case "update": {
        Services.obs.notifyObservers(
          null,
          "language-update",
          data.messages
        );
        break;
      }
    }

    return true;
  },

  sendPageResponse: function(aMessageManager, aAction) {
    let detail = {action: aAction};
    log.debug("sendPageResponse:", detail);
    aMessageManager.sendAsyncMessage("L20nDemo:SendPageResponse", detail);
  },

};

this.L20nDemo.init();
