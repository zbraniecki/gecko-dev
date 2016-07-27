// |reftest| skip-if(!this.hasOwnProperty("Intl"))
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tests the getCalendarInfo function with a diverse set of arguments.

/*
 * Return true if A is equal to B, where equality on arrays and objects
 * means that they have the same set of enumerable properties, the values
 * of each property are deep_equal, and their 'length' properties are
 * equal. Equality on other types is ==.
 */
function deepEqual(a, b) {
    if (typeof a !== typeof b)
        return false;

    if (a === null)
        return b === null;

    if (typeof a === 'object') {
        // For every property of a, does b have that property with an equal value?
        var props = {};
        for (var prop in a) {
            if (!deepEqual(a[prop], b[prop]))
                return false;
            props[prop] = true;
        }

        // Are all of b's properties present on a?
        for (var prop in b)
            if (!props[prop])
                return false;

        // length isn't enumerable, but we want to check it, too.
        return a.length === b.length;
    }

    return Object.is(a, b);
}

addIntlExtras(Intl);

let gCI = Intl.getCalendarInfo;

assertEq(gCI.length, 1);

assertEq(deepEqual(gCI('en-US'), {
  "firstDayOfWeek": 1,
  "weekendStart": 7,
  "weekendEnd": 2,
  "calendar": "gregory",
  "locale": "en-US"
}), true);

assertEq(deepEqual(gCI('en-GB'), {
  "firstDayOfWeek": 2,
  "weekendStart": 7,
  "weekendEnd": 2,
  "calendar": "gregory",
  "locale": "en-GB"
}), true);


assertEq(deepEqual(gCI('pl'), {
  "firstDayOfWeek": 2,
  "weekendStart": 7,
  "weekendEnd": 2,
  "calendar": "gregory",
  "locale": "pl"
}), true);

assertEq(deepEqual(gCI('ar'), {
  "firstDayOfWeek": 7,
  "weekendStart": 6,
  "weekendEnd": 1,
  "calendar": "gregory",
  "locale": "ar"
}), true);

if (typeof reportCompare === 'function')
    reportCompare(0, 0);
