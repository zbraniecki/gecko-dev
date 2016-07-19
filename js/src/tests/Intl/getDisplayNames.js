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


let gDN = Intl.getDisplayNames;

assertEq(gDN.length, 1);

assertEq(deepEqual(gDN('en-US', {
  type: 'weekday'
}), {
  "names": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "style": "long",
  "calendar": "gregory",
  "locale": "en-US"
}), true);

assertEq(deepEqual(gDN('en-US', {
  style: "short",
  type: 'weekday'
}), {
  "names": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "style": "short",
  "calendar": "gregory",
  "locale": "en-US"
}), true);

assertEq(deepEqual(gDN('en-US', {
  style: "shorter",
  type: 'weekday'
}), {
  "names": ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  "style": "shorter",
  "calendar": "gregory",
  "locale": "en-US"
}), true);

assertEq(deepEqual(gDN('en-US', {
  style: "narrow",
  type: 'weekday'
}), {
  "names": ["S", "M", "T", "W", "T", "F", "S"],
  "style": "narrow",
  "calendar": "gregory",
  "locale": "en-US"
}), true);

if (typeof reportCompare === 'function')
    reportCompare(0, 0);
