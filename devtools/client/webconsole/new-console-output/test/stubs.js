/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const {
  MESSAGE_SOURCE,
  MESSAGE_TYPE,
  MESSAGE_LEVEL,
  // Legacy
  CATEGORY_WEBDEV,
  SEVERITY_LOG,
} = require("devtools/client/webconsole/new-console-output/constants");

const { ConsoleMessage } = require("devtools/client/webconsole/new-console-output/types");

exports.stubConsoleMessages = new Map([
  [
    "console.log('foobar', 'test')",
    new ConsoleMessage({
      allowRepeating: true,
      source: MESSAGE_SOURCE.CONSOLE_API,
      type: MESSAGE_TYPE.LOG,
      level: MESSAGE_LEVEL.LOG,
      messageText: null,
      parameters: ["foobar", "test"],
      repeat: 1,
      repeatId: null,
      category: CATEGORY_WEBDEV,
      severity: SEVERITY_LOG,
    })
  ],
  [
    "console.warn('danger, will robinson!')",
    new ConsoleMessage({
      allowRepeating: true,
      source: MESSAGE_SOURCE.CONSOLE_API,
      type: MESSAGE_TYPE.LOG,
      level: MESSAGE_LEVEL.WARN,
      messageText: null,
      parameters: ["danger, will robinson!"],
      repeat: 1,
      repeatId: null,
      category: CATEGORY_WEBDEV,
      severity: SEVERITY_LOG,
    })
  ],
  [
    "console.log(undefined)",
    new ConsoleMessage({
      allowRepeating: true,
      source: MESSAGE_SOURCE.CONSOLE_API,
      type: MESSAGE_TYPE.LOG,
      level: MESSAGE_LEVEL.LOG,
      messageText: null,
      parameters: [
        { type: "undefined" }
      ],
      repeat: 1,
      repeatId: null,
      category: CATEGORY_WEBDEV,
      severity: SEVERITY_LOG,
    })
  ],
  [
    "console.log(NaN)",
    new ConsoleMessage({
      allowRepeating: true,
      source: MESSAGE_SOURCE.CONSOLE_API,
      type: MESSAGE_TYPE.LOG,
      level: MESSAGE_LEVEL.LOG,
      messageText: null,
      parameters: [
        { type: "NaN" }
      ],
      repeat: 1,
      repeatId: null,
      category: CATEGORY_WEBDEV,
      severity: SEVERITY_LOG,
    })
  ],
  [
    "console.log(null)",
    new ConsoleMessage({
      allowRepeating: true,
      source: MESSAGE_SOURCE.CONSOLE_API,
      type: MESSAGE_TYPE.LOG,
      level: MESSAGE_LEVEL.LOG,
      messageText: null,
      parameters: [
        { type: "null" }
      ],
      repeat: 1,
      repeatId: null,
      category: CATEGORY_WEBDEV,
      severity: SEVERITY_LOG,
    })
  ],
]);
