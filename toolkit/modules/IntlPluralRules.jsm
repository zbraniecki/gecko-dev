/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["PluralRules"];

const pluralRules = {
  'en-US': function(n) {
    return n === 1 ? 'one' : 'other';
  },
  'pl': function(n) {
    return n === 1 ? 'one' : 'other';
  }
};

class PluralRules {
  constructor(locales, options) {
    // So stub, Much mock

    this.locale = Array.isArray(locales) ? locales[0] : locales;
    this.pluralRule = pluralRules[this.locale];
  }

  select(x) {
    const n = parseInt(x);
    return this.pluralRule(n);
  }
}
