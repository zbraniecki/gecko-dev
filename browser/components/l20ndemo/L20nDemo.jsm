// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

"use strict";

this.EXPORTED_SYMBOLS = ["L20nDemo"];

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

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

    return true;
  },

  handleEvent: function(aEvent) {
    log.debug("handleEvent: type =", aEvent.type, "event =", aEvent);
  },

};

this.L20nDemo.init();
