/* vim: set ts=2 et sw=2 tw=80 filetype=javascript: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

class ReadWrite {
  constructor(fn) {
    this.fn = fn;
  }

  run(ctx) {
    return this.fn(ctx);
  }

  flatMap(fn) {
    return new ReadWrite(ctx => {
      const [cur, curErrs] = this.run(ctx);
      const [val, valErrs] = fn(cur).run(ctx);
      return [val, [...curErrs, ...valErrs]];
    });
  }
}

function ask() {
  return new ReadWrite(ctx => [ctx, []]);
}

function tell(log) {
  return new ReadWrite(() => [null, [log]]);
}

function unit(val) {
  return new ReadWrite(() => [val, []]);
}

function resolve(iter) {
  return function step(resume) {
    const {value, done} = iter.next(resume);
    const rw = (value instanceof ReadWrite) ?
      value : unit(value);
    return done ? rw : rw.flatMap(step);
  }();
}

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ListFormat",
  "resource://gre/modules/IntlListFormat.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PluralRules",
  "resource://gre/modules/IntlPluralRules.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "RelativeTimeFormat",
  "resource://gre/modules/IntlRelativeTimeFormat.jsm");


class FTLBase {
  constructor(value, opts) {
    this.value = value;
    this.opts = opts;
  }
  valueOf() {
    return this.value;
  }
}

class FTLNone extends FTLBase {
  toString() {
    return this.value || '???';
  }
}

class FTLNumber extends FTLBase {
  constructor(value, opts) {
    super(parseFloat(value), opts);
  }
  toString(ctx) {
    const nf = ctx._memoizeIntlObject(
      Intl.NumberFormat, this.opts
    );
    return nf.format(this.value);
  }
}

class FTLDateTime extends FTLBase {
  constructor(value, opts) {
    super(new Date(value), opts);
  }
  toString(ctx) {
    const dtf = ctx._memoizeIntlObject(
      Intl.DateTimeFormat, this.opts
    );
    return dtf.format(this.value);
  }
}

class FTLKeyword extends FTLBase {
  toString() {
    const { name, namespace } = this.value;
    return namespace ? `${namespace}:${name}` : name;
  }
  match(ctx, other) {
    const { name, namespace } = this.value;
    if (other instanceof FTLKeyword) {
      return name === other.value.name && namespace === other.value.namespace;
    } else if (namespace) {
      return false;
    } else if (typeof other === 'string') {
      return name === other;
    } else if (other instanceof FTLNumber) {
      const pr = ctx._memoizeIntlObject(
        PluralRules, other.opts
      );
      return name === pr.select(other.valueOf());
    } else {
      return false;
    }
  }
}

class FTLList extends Array {
  toString(ctx) {
    const lf = ctx._memoizeIntlObject(
      ListFormat // XXX add this.opts
    );
    const elems = this.map(
      elem => elem.toString(ctx)
    );
    return lf.format(elems);
  }
}

// each builtin takes two arguments:
//  - args = an array of positional args
//  - opts  = an object of key-value args

var builtins = {
  'NUMBER': ([arg], opts) =>
    new FTLNumber(arg.valueOf(), merge(arg.opts, opts)),
  'PLURAL': ([arg], opts) =>
    new FTLNumber(arg.valueOf(), merge(arg.opts, opts)),
  'DATETIME': ([arg], opts) =>
    new FTLDateTime(arg.valueOf(), merge(arg.opts, opts)),
  'LIST': (args) => FTLList.from(args),
  'LEN': ([arg]) => new FTLNumber(arg.valueOf().length),
  'TAKE': ([num, arg]) => FTLList.from(arg.valueOf().slice(0, num.value)),
  'DROP': ([num, arg]) => FTLList.from(arg.valueOf().slice(num.value)),
};

function merge(argopts, opts) {
  return Object.assign({}, argopts, valuesOf(opts));
}

function valuesOf(opts) {
  return Object.keys(opts).reduce(
    (seq, cur) => Object.assign({}, seq, {
      [cur]: opts[cur].valueOf()
    }), {});
}

// Unicode bidi isolation characters
const FSI = '\u2068';
const PDI = '\u2069';

const MAX_PLACEABLE_LENGTH = 2500;

function* mapValues(arr) {
  let values = new FTLList();
  for (let elem of arr) {
    values.push(yield* Value(elem));
  }
  return values;
}

// Helper for choosing entity value
function* DefaultMember(members) {
  for (let member of members) {
    if (member.def) {
      return member;
    }
  }

  yield tell(new RangeError('No default'));
  return { val: new FTLNone() };
}


// Half-resolved expressions evaluate to raw Runtime AST nodes

function* EntityReference({name}) {
  const { ctx } = yield ask();
  const entity = ctx.messages.get(name);

  if (!entity) {
    yield tell(new ReferenceError(`Unknown entity: ${name}`));
    return new FTLNone(name);
  }

  return entity;
}

function* MemberExpression({obj, key}) {
  const entity = yield* EntityReference(obj);
  if (entity instanceof FTLNone) {
    return { val: entity };
  }

  const { ctx } = yield ask();
  const keyword = yield* Value(key);

  for (let member of entity.traits) {
    const memberKey = yield* Value(member.key);
    if (keyword.match(ctx, memberKey)) {
      return member;
    }
  }

  yield tell(new ReferenceError(`Unknown trait: ${keyword.toString(ctx)}`));
  return {
    val: yield* Entity(entity)
  };
}

function* SelectExpression({exp, vars}) {
  const selector = yield* Value(exp);
  if (selector instanceof FTLNone) {
    return yield* DefaultMember(vars);
  }

  for (let variant of vars) {
    const key = yield* Value(variant.key);

    if (key instanceof FTLNumber &&
        selector instanceof FTLNumber &&
        key.valueOf() === selector.valueOf()) {
      return variant;
    }

    const { ctx } = yield ask();

    if (key instanceof FTLKeyword &&
        key.match(ctx, selector)) {
      return variant;
    }
  }

  return yield* DefaultMember(vars);
}


// Fully-resolved expressions evaluate to FTL types

function* Value(expr) {
  if (typeof expr === 'string' || expr instanceof FTLNone) {
    return expr;
  }

  if (Array.isArray(expr)) {
    return yield* Pattern(expr);
  }

  switch (expr.type) {
    case 'kw':
      return new FTLKeyword(expr);
    case 'num':
      return new FTLNumber(expr.val);
    case 'ext':
      return yield* ExternalArgument(expr);
    case 'fun':
      return yield* FunctionReference(expr);
    case 'call':
      return yield* CallExpression(expr);
    case 'ref':
      const ref = yield* EntityReference(expr);
      return yield* Entity(ref);
    case 'mem':
      const mem = yield* MemberExpression(expr);
      return yield* Value(mem.val);
    case 'sel':
      const sel = yield* SelectExpression(expr);
      return yield* Value(sel.val);
    default:
      return yield* Value(expr.val);
  }
}

function* ExternalArgument({name}) {
  const { args } = yield ask();

  if (!args || !args.hasOwnProperty(name)) {
    yield tell(new ReferenceError(`Unknown external: ${name}`));
    return new FTLNone(name);
  }

  const arg = args[name];

  if (arg instanceof FTLBase) {
    return arg;
  }

  switch (typeof arg) {
    case 'string':
      return arg;
    case 'number':
      return new FTLNumber(arg);
    case 'object':
      if (Array.isArray(arg)) {
        return yield* mapValues(arg);
      }
      if (arg instanceof Date) {
        return new FTLDateTime(arg);
      }
    default:
      yield tell(
        new TypeError(`Unsupported external type: ${name}, ${typeof arg}`)
      );
      return new FTLNone(name);
  }
}

function* FunctionReference({name}) {
  const { ctx: { functions } } = yield ask();
  const func = functions[name] || builtins[name];

  if (!func) {
    yield tell(new ReferenceError(`Unknown built-in: ${name}()`));
    return new FTLNone(`${name}()`);
  }

  if (!(func instanceof Function)) {
    yield tell(new TypeError(`Function ${name}() is not callable`));
    return new FTLNone(`${name}()`);
  }

  return func;
}

function* CallExpression({name, args}) {
  const callee = yield* FunctionReference(name);

  if (callee instanceof FTLNone) {
    return callee;
  }

  const posargs = [];
  const keyargs = [];

  for (let arg of args) {
    if (arg.type === 'kv') {
      keyargs[arg.name] = yield* Value(arg.val);
    } else {
      posargs.push(yield* Value(arg));
    }
  }

  // XXX builtins should also returns [val, errs] tuples
  return callee(posargs, keyargs);
}

function* Pattern(ptn) {
  const { ctx, dirty } = yield ask();

  if (dirty.has(ptn)) {
    yield tell(new RangeError('Cyclic reference'));
    return new FTLNone();
  }

  dirty.add(ptn);
  let result = '';

  for (let part of ptn) {
    if (typeof part === 'string') {
      result += part;
    } else {
      const value = part.length === 1 ?
        yield* Value(part[0]) : yield* mapValues(part);

      const str = value.toString(ctx);
      if (str.length > MAX_PLACEABLE_LENGTH) {
        yield tell(
          new RangeError(
            'Too many characters in placeable ' +
            `(${str.length}, max allowed is ${MAX_PLACEABLE_LENGTH})`
          )
        );
        result += FSI + str.substr(0, MAX_PLACEABLE_LENGTH) + PDI;
      } else {
        result += FSI + str + PDI;
      }
    }
  }

  dirty.delete(ptn);
  return result;
}

function* Entity(entity) {
  if (entity.val !== undefined) {
    return yield* Value(entity.val);
  }

  if (!entity.traits) {
    return yield* Value(entity);
  }

  const def = yield* DefaultMember(entity.traits);
  return yield* Value(def);
}

function* toString(entity) {
  const value = yield* Entity(entity);

  // at this point we don't need the current resolution context; value can 
  // either be a simple string (which doesn't need it by definition) or 
  // a pattern which has already been resolved in Pattern, or FTLNone.
  return value.toString();
}

function format(ctx, args, entity) {
  if (entity === undefined) {
    return ['', []];
  }
  if (typeof entity === 'string') {
    return [entity, []];
  }

  return resolve(toString(entity)).run({
    ctx, args, dirty: new WeakSet()
  });
}

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "L20nParser",
                                 "resource://gre/modules/L20nParser.jsm");


class MessageContext {
  constructor(lang, { functions } = {}) {
    this.lang = lang;
    this.functions = functions || {}
    this.messages = new Map();
    this.intls = new WeakMap();
  }

  addMessages(source) {
    const [entries, errors] = L20nParser.parseResource(source);
    for (let id in entries) {
      this.messages.set(id, entries[id]);
    }

    return errors;
  }

  format(entity, args) {
    return format(this, args, entity);
  }

  _memoizeIntlObject(ctor, opts) {
    const cache = this.intls.get(ctor) || {};
    const id = JSON.stringify(opts);

    if (!cache[id]) {
      cache[id] = new ctor(this.lang, opts);
      this.intls.set(ctor, cache);
    }

    return cache[id];
  }

}

this.EXPORTED_SYMBOLS = ["MessageContext", "MessageArgument"];


function MessageArgument(formatter, options, values) {
  if (values === undefined) {
    return (values) => {
      if (values === undefined) {
        throw new Error('Cannot resolve Argument without a value');
      }
      if (!Array.isArray(values)) {
        values = [values];
      }
      return {
        formatter,
        options,
        values
      };
    };
  }
  if (!Array.isArray(values)) {
    values = [values];
  }
  return {
    formatter,
    options,
    values
  };
}

this.MessageContext = MessageContext;
this.MessageArgument = MessageArgument;