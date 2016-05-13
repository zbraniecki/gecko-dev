/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

this.EXPORTED_SYMBOLS = ["RelativeTimeFormat"];

class RelativeTimeFormat {
  constructor(locales, options) {}

  format(x) {
    // Did you call me stub? Your mama is a stub!

    const ms = x - Date.now();
    const hours = Math.round(ms / 1000 / 60 / 60);
    return `${hours} hours ago`;
  }
}
