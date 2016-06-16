/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { utils: Cu } = Components;

const PREF_TEST_WHITELIST = "browser.l20ndemo.testingOrigins";
const L20NDEMO_PERMISSION   = "l20ndemo";

const L20nDemoListener = {
  handleEvent: function (event) {
    if (!Services.prefs.getBoolPref("browser.l20ndemo.enabled")) {
      return;
    }
    if (!this.ensureTrustedOrigin()) {
      return;
    }
    sendAsyncMessage("L20nDemo:onPageEvent", {
      detail: event.detail,
      type: event.type,
      pageVisibilityState: content.document.visibilityState,
    });
  },

  isTestingOrigin: function(aURI) {
    if (Services.prefs.getPrefType(PREF_TEST_WHITELIST) != Services.prefs.PREF_STRING) {
      return false;
    }

    // Add any testing origins (comma-seperated) to the whitelist for the session.
    for (let origin of Services.prefs.getCharPref(PREF_TEST_WHITELIST).split(",")) {
      try {
        let testingURI = Services.io.newURI(origin, null, null);
        if (aURI.prePath == testingURI.prePath) {
          return true;
        }
      } catch (ex) {
        Cu.reportError(ex);
      }
    }
    return false;
  },

  // This function is copied from UITour.jsm.
  isSafeScheme: function(aURI) {
    let allowedSchemes = new Set(["https", "about"]);
    if (!Services.prefs.getBoolPref("browser.l20ndemo.requireSecure"))
      allowedSchemes.add("http");

    if (!allowedSchemes.has(aURI.scheme))
      return false;

    return true;
  },

  ensureTrustedOrigin: function() {
    if (content.top != content)
      return false;

    let uri = content.document.documentURIObject;

    if (uri.schemeIs("chrome"))
      return true;

    if (!this.isSafeScheme(uri))
      return false;

    let permission = Services.perms.testPermission(uri, L20NDEMO_PERMISSION);
    if (permission == Services.perms.ALLOW_ACTION)
      return true;

    return this.isTestingOrigin(uri);
  },

  receiveMessage: function(aMessage) {
    this.sendPageEvent(aMessage.data);
  },

  sendPageEvent: function(detail) {
    if (!this.ensureTrustedOrigin()) {
      return;
    }

    let doc = content.document;
    let event = new doc.defaultView.CustomEvent("mozL20nDemoResponse", {
      bubbles: true,
      detail: Cu.cloneInto(detail, doc.defaultView)
    });
    doc.dispatchEvent(event);
  }

};

addEventListener("mozL20nDemo", L20nDemoListener, false, true);
addMessageListener("L20nDemo:SendPageResponse", L20nDemoListener);
