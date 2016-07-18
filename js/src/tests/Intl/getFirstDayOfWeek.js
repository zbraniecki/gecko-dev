// |reftest| skip-if(!this.hasOwnProperty("Intl"))
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Tests the getFirstDayOfWeek function with a diverse set of arguments.

let gFDoW = Intl.getFirstDayOfWeek;

assertEq(gFDoW.length, 1);

assertEq(gFDoW(), 1);

assertEq(gFDoW('pl'), 2);

assertEq(gFDoW('de'), 2);

assertEq(gFDoW('en-US'), 1);

assertEq(gFDoW('en-GB'), 2);

assertEq(gFDoW('ar'), 7);

if (typeof reportCompare === 'function')
    reportCompare(0, 0);
