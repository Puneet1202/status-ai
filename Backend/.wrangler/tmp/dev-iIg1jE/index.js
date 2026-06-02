var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
    init_modules_watch_stub();
  }
});

// .wrangler/tmp/bundle-VGz0II/middleware-loader.entry.ts
init_modules_watch_stub();

// .wrangler/tmp/bundle-VGz0II/middleware-insertion-facade.js
init_modules_watch_stub();

// src/index.js
init_modules_watch_stub();

// node_modules/hono/dist/index.js
init_modules_watch_stub();

// node_modules/hono/dist/hono.js
init_modules_watch_stub();

// node_modules/hono/dist/hono-base.js
init_modules_watch_stub();

// node_modules/hono/dist/compose.js
init_modules_watch_stub();
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler5;
      if (middleware[i]) {
        handler5 = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler5 = i === middleware.length && next || void 0;
      }
      if (handler5) {
        try {
          res = await handler5(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/context.js
init_modules_watch_stub();

// node_modules/hono/dist/request.js
init_modules_watch_stub();

// node_modules/hono/dist/http-exception.js
init_modules_watch_stub();

// node_modules/hono/dist/request/constants.js
init_modules_watch_stub();
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
init_modules_watch_stub();
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
init_modules_watch_stub();
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name5 = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name5 = _decodeURI(name5);
    }
    keyIndex = nextKeyIndex;
    if (name5 === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name5] && Array.isArray(results[name5]))) {
        results[name5] = [];
      }
      ;
      results[name5].push(value);
    } else {
      results[name5] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name5) {
    if (name5) {
      return this.raw.headers.get(name5) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
init_modules_watch_stub();
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name5, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name5);
    } else if (options?.append) {
      headers.append(name5, value);
    } else {
      headers.set(name5, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
init_modules_watch_stub();
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
init_modules_watch_stub();
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler5) => {
          this.#addRoute(method, this.#path, handler5);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler5) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler5);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler5) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler5);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler5;
      if (app2.errorHandler === errorHandler) {
        handler5 = r.handler;
      } else {
        handler5 = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler5[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler5);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler5) => {
    this.errorHandler = handler5;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler5) => {
    this.#notFoundHandler = handler5;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler5 = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler5);
    return this;
  }
  #addRoute(method, path, handler5) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler: handler5 };
    this.router.add(method, path, [handler5, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/index.js
init_modules_watch_stub();

// node_modules/hono/dist/router/reg-exp-router/router.js
init_modules_watch_stub();

// node_modules/hono/dist/router/reg-exp-router/matcher.js
init_modules_watch_stub();
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
init_modules_watch_stub();
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name5 = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name5 && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name5 !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name5 !== "") {
        paramMap.push([name5, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
init_modules_watch_stub();
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler5) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler5, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler5, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler5, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/reg-exp-router/prepared-router.js
init_modules_watch_stub();

// node_modules/hono/dist/router/smart-router/index.js
init_modules_watch_stub();

// node_modules/hono/dist/router/smart-router/router.js
init_modules_watch_stub();
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler5) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler5]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/index.js
init_modules_watch_stub();

// node_modules/hono/dist/router/trie-router/router.js
init_modules_watch_stub();

// node_modules/hono/dist/router/trie-router/node.js
init_modules_watch_stub();
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler5, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler5) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler: handler5, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler5) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler: handler5,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name5, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name5] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name5] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler: handler5, params }) => [handler5, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler5) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler5);
      }
      return;
    }
    this.#node.insert(method, path, handler5);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
init_modules_watch_stub();
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/routers/auth.routes.js
init_modules_watch_stub();

// src/controllers/auth.controller.js
init_modules_watch_stub();

// node_modules/bcryptjs/index.js
init_modules_watch_stub();
var import_crypto = __toESM(require_crypto(), 1);
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return import_crypto.default.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
__name(randomBytes, "randomBytes");
function setRandomFallback(random) {
  randomFallback = random;
}
__name(setRandomFallback, "setRandomFallback");
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
__name(genSaltSync, "genSaltSync");
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(genSalt, "genSalt");
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
__name(hashSync, "hashSync");
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(hash, "hash");
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
__name(safeStringCompare, "safeStringCompare");
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
__name(compareSync, "compareSync");
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
__name(compare, "compare");
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
__name(getRounds, "getRounds");
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
__name(getSalt, "getSalt");
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
__name(truncates, "truncates");
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
__name(utf8Length, "utf8Length");
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
__name(utf8Array, "utf8Array");
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
__name(base64_encode, "base64_encode");
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
__name(base64_decode, "base64_decode");
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
__name(_encipher, "_encipher");
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
__name(_streamtoword, "_streamtoword");
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_key, "_key");
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
__name(_ekskey, "_ekskey");
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
__name(_crypt, "_crypt");
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
__name(_hash, "_hash");
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
__name(encodeBase64, "encodeBase64");
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
__name(decodeBase64, "decodeBase64");
var bcryptjs_default = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};

// node_modules/hono/dist/middleware/jwt/index.js
init_modules_watch_stub();

// node_modules/hono/dist/middleware/jwt/jwt.js
init_modules_watch_stub();

// node_modules/hono/dist/helper/cookie/index.js
init_modules_watch_stub();

// node_modules/hono/dist/utils/cookie.js
init_modules_watch_stub();
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = /* @__PURE__ */ __name((value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
}, "trimCookieWhitespace");
var parse = /* @__PURE__ */ __name((cookie, name5) => {
  if (name5 && cookie.indexOf(name5) === -1) {
    return {};
  }
  const pairs = cookie.split(";");
  const parsedCookie = {};
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name5 && name5 !== cookieName || !validCookieNameRegEx.test(cookieName)) {
      continue;
    }
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = cookieValue.indexOf("%") !== -1 ? tryDecode(cookieValue, decodeURIComponent_) : cookieValue;
      if (name5) {
        break;
      }
    }
  }
  return parsedCookie;
}, "parse");
var _serialize = /* @__PURE__ */ __name((name5, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name5)) {
    throw new Error("Invalid cookie name");
  }
  let cookie = `${name5}=${value}`;
  if (name5.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name5.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
}, "_serialize");
var serialize = /* @__PURE__ */ __name((name5, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name5, value, opt);
}, "serialize");

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = /* @__PURE__ */ __name((c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
}, "getCookie");
var generateCookie = /* @__PURE__ */ __name((name5, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name5, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name5, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name5, value, { path: "/", ...opt });
  }
  return cookie;
}, "generateCookie");
var setCookie = /* @__PURE__ */ __name((c, name5, value, opt) => {
  const cookie = generateCookie(name5, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
}, "setCookie");

// node_modules/hono/dist/utils/jwt/index.js
init_modules_watch_stub();

// node_modules/hono/dist/utils/jwt/jwt.js
init_modules_watch_stub();

// node_modules/hono/dist/utils/encode.js
init_modules_watch_stub();
var decodeBase64Url = /* @__PURE__ */ __name((str) => {
  return decodeBase642(str.replace(/_|-/g, (m) => ({ _: "/", "-": "+" })[m] ?? m));
}, "decodeBase64Url");
var encodeBase64Url = /* @__PURE__ */ __name((buf) => encodeBase642(buf).replace(/\/|\+/g, (m) => ({ "/": "_", "+": "-" })[m] ?? m), "encodeBase64Url");
var encodeBase642 = /* @__PURE__ */ __name((buf) => {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0, len = bytes.length; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}, "encodeBase64");
var decodeBase642 = /* @__PURE__ */ __name((str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  const half = binary.length / 2;
  for (let i = 0, j = binary.length - 1; i <= half; i++, j--) {
    bytes[i] = binary.charCodeAt(i);
    bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
}, "decodeBase64");

// node_modules/hono/dist/utils/jwt/jwa.js
init_modules_watch_stub();
var AlgorithmTypes = /* @__PURE__ */ ((AlgorithmTypes2) => {
  AlgorithmTypes2["HS256"] = "HS256";
  AlgorithmTypes2["HS384"] = "HS384";
  AlgorithmTypes2["HS512"] = "HS512";
  AlgorithmTypes2["RS256"] = "RS256";
  AlgorithmTypes2["RS384"] = "RS384";
  AlgorithmTypes2["RS512"] = "RS512";
  AlgorithmTypes2["PS256"] = "PS256";
  AlgorithmTypes2["PS384"] = "PS384";
  AlgorithmTypes2["PS512"] = "PS512";
  AlgorithmTypes2["ES256"] = "ES256";
  AlgorithmTypes2["ES384"] = "ES384";
  AlgorithmTypes2["ES512"] = "ES512";
  AlgorithmTypes2["EdDSA"] = "EdDSA";
  return AlgorithmTypes2;
})(AlgorithmTypes || {});

// node_modules/hono/dist/utils/jwt/jws.js
init_modules_watch_stub();

// node_modules/hono/dist/helper/adapter/index.js
init_modules_watch_stub();
var knownUserAgents = {
  deno: "Deno",
  bun: "Bun",
  workerd: "Cloudflare-Workers",
  node: "Node.js"
};
var getRuntimeKey = /* @__PURE__ */ __name(() => {
  const global = globalThis;
  const userAgentSupported = typeof navigator !== "undefined" && true;
  if (userAgentSupported) {
    for (const [runtimeKey, userAgent] of Object.entries(knownUserAgents)) {
      if (checkUserAgentEquals(userAgent)) {
        return runtimeKey;
      }
    }
  }
  if (typeof global?.EdgeRuntime === "string") {
    return "edge-light";
  }
  if (global?.fastly !== void 0) {
    return "fastly";
  }
  if (global?.process?.release?.name === "node") {
    return "node";
  }
  return "other";
}, "getRuntimeKey");
var checkUserAgentEquals = /* @__PURE__ */ __name((platform) => {
  const userAgent = "Cloudflare-Workers";
  return userAgent.startsWith(platform);
}, "checkUserAgentEquals");

// node_modules/hono/dist/utils/jwt/types.js
init_modules_watch_stub();
var JwtAlgorithmNotImplemented = class extends Error {
  static {
    __name(this, "JwtAlgorithmNotImplemented");
  }
  constructor(alg) {
    super(`${alg} is not an implemented algorithm`);
    this.name = "JwtAlgorithmNotImplemented";
  }
};
var JwtAlgorithmRequired = class extends Error {
  static {
    __name(this, "JwtAlgorithmRequired");
  }
  constructor() {
    super('JWT verification requires "alg" option to be specified');
    this.name = "JwtAlgorithmRequired";
  }
};
var JwtAlgorithmMismatch = class extends Error {
  static {
    __name(this, "JwtAlgorithmMismatch");
  }
  constructor(expected, actual) {
    super(`JWT algorithm mismatch: expected "${expected}", got "${actual}"`);
    this.name = "JwtAlgorithmMismatch";
  }
};
var JwtTokenInvalid = class extends Error {
  static {
    __name(this, "JwtTokenInvalid");
  }
  constructor(token) {
    super(`invalid JWT token: ${token}`);
    this.name = "JwtTokenInvalid";
  }
};
var JwtTokenNotBefore = class extends Error {
  static {
    __name(this, "JwtTokenNotBefore");
  }
  constructor(token) {
    super(`token (${token}) is being used before it's valid`);
    this.name = "JwtTokenNotBefore";
  }
};
var JwtTokenExpired = class extends Error {
  static {
    __name(this, "JwtTokenExpired");
  }
  constructor(token) {
    super(`token (${token}) expired`);
    this.name = "JwtTokenExpired";
  }
};
var JwtTokenIssuedAt = class extends Error {
  static {
    __name(this, "JwtTokenIssuedAt");
  }
  constructor(currentTimestamp, iat) {
    super(
      `Invalid "iat" claim, must be a valid number lower than "${currentTimestamp}" (iat: "${iat}")`
    );
    this.name = "JwtTokenIssuedAt";
  }
};
var JwtTokenIssuer = class extends Error {
  static {
    __name(this, "JwtTokenIssuer");
  }
  constructor(expected, iss) {
    super(`expected issuer "${expected}", got ${iss ? `"${iss}"` : "none"} `);
    this.name = "JwtTokenIssuer";
  }
};
var JwtHeaderInvalid = class extends Error {
  static {
    __name(this, "JwtHeaderInvalid");
  }
  constructor(header) {
    super(`jwt header is invalid: ${JSON.stringify(header)}`);
    this.name = "JwtHeaderInvalid";
  }
};
var JwtHeaderRequiresKid = class extends Error {
  static {
    __name(this, "JwtHeaderRequiresKid");
  }
  constructor(header) {
    super(`required "kid" in jwt header: ${JSON.stringify(header)}`);
    this.name = "JwtHeaderRequiresKid";
  }
};
var JwtSymmetricAlgorithmNotAllowed = class extends Error {
  static {
    __name(this, "JwtSymmetricAlgorithmNotAllowed");
  }
  constructor(alg) {
    super(`symmetric algorithm "${alg}" is not allowed for JWK verification`);
    this.name = "JwtSymmetricAlgorithmNotAllowed";
  }
};
var JwtAlgorithmNotAllowed = class extends Error {
  static {
    __name(this, "JwtAlgorithmNotAllowed");
  }
  constructor(alg, allowedAlgorithms) {
    super(`algorithm "${alg}" is not in the allowed list: [${allowedAlgorithms.join(", ")}]`);
    this.name = "JwtAlgorithmNotAllowed";
  }
};
var JwtTokenSignatureMismatched = class extends Error {
  static {
    __name(this, "JwtTokenSignatureMismatched");
  }
  constructor(token) {
    super(`token(${token}) signature mismatched`);
    this.name = "JwtTokenSignatureMismatched";
  }
};
var JwtPayloadRequiresAud = class extends Error {
  static {
    __name(this, "JwtPayloadRequiresAud");
  }
  constructor(payload) {
    super(`required "aud" in jwt payload: ${JSON.stringify(payload)}`);
    this.name = "JwtPayloadRequiresAud";
  }
};
var JwtTokenAudience = class extends Error {
  static {
    __name(this, "JwtTokenAudience");
  }
  constructor(expected, aud) {
    super(
      `expected audience "${Array.isArray(expected) ? expected.join(", ") : expected}", got "${aud}"`
    );
    this.name = "JwtTokenAudience";
  }
};
var CryptoKeyUsage = /* @__PURE__ */ ((CryptoKeyUsage2) => {
  CryptoKeyUsage2["Encrypt"] = "encrypt";
  CryptoKeyUsage2["Decrypt"] = "decrypt";
  CryptoKeyUsage2["Sign"] = "sign";
  CryptoKeyUsage2["Verify"] = "verify";
  CryptoKeyUsage2["DeriveKey"] = "deriveKey";
  CryptoKeyUsage2["DeriveBits"] = "deriveBits";
  CryptoKeyUsage2["WrapKey"] = "wrapKey";
  CryptoKeyUsage2["UnwrapKey"] = "unwrapKey";
  return CryptoKeyUsage2;
})(CryptoKeyUsage || {});

// node_modules/hono/dist/utils/jwt/utf8.js
init_modules_watch_stub();
var utf8Encoder = new TextEncoder();
var utf8Decoder = new TextDecoder();

// node_modules/hono/dist/utils/jwt/jws.js
async function signing(privateKey, alg, data) {
  const algorithm = getKeyAlgorithm(alg);
  const cryptoKey = await importPrivateKey(privateKey, algorithm);
  return await crypto.subtle.sign(algorithm, cryptoKey, data);
}
__name(signing, "signing");
async function verifying(publicKey, alg, signature, data) {
  const algorithm = getKeyAlgorithm(alg);
  const cryptoKey = await importPublicKey(publicKey, algorithm);
  return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
}
__name(verifying, "verifying");
function pemToBinary(pem) {
  return decodeBase642(pem.replace(/-+(BEGIN|END).*?-+/g, "").replace(/\s/g, ""));
}
__name(pemToBinary, "pemToBinary");
async function importPrivateKey(key, alg) {
  if (!crypto.subtle || !crypto.subtle.importKey) {
    throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
  }
  if (isCryptoKey(key)) {
    if (key.type !== "private" && key.type !== "secret") {
      throw new Error(
        `unexpected key type: CryptoKey.type is ${key.type}, expected private or secret`
      );
    }
    return key;
  }
  const usages = [CryptoKeyUsage.Sign];
  if (typeof key === "object") {
    return await crypto.subtle.importKey("jwk", key, alg, false, usages);
  }
  if (key.includes("PRIVATE")) {
    return await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, false, usages);
  }
  return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
__name(importPrivateKey, "importPrivateKey");
async function importPublicKey(key, alg) {
  if (!crypto.subtle || !crypto.subtle.importKey) {
    throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
  }
  if (isCryptoKey(key)) {
    if (key.type === "public" || key.type === "secret") {
      return key;
    }
    key = await exportPublicJwkFrom(key);
  }
  if (typeof key === "string" && key.includes("PRIVATE")) {
    const privateKey = await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, true, [
      CryptoKeyUsage.Sign
    ]);
    key = await exportPublicJwkFrom(privateKey);
  }
  const usages = [CryptoKeyUsage.Verify];
  if (typeof key === "object") {
    return await crypto.subtle.importKey("jwk", key, alg, false, usages);
  }
  if (key.includes("PUBLIC")) {
    return await crypto.subtle.importKey("spki", pemToBinary(key), alg, false, usages);
  }
  return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
__name(importPublicKey, "importPublicKey");
async function exportPublicJwkFrom(privateKey) {
  if (privateKey.type !== "private") {
    throw new Error(`unexpected key type: ${privateKey.type}`);
  }
  if (!privateKey.extractable) {
    throw new Error("unexpected private key is unextractable");
  }
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const { kty } = jwk;
  const { alg, e, n } = jwk;
  const { crv, x, y } = jwk;
  return { kty, alg, e, n, crv, x, y, key_ops: [CryptoKeyUsage.Verify] };
}
__name(exportPublicJwkFrom, "exportPublicJwkFrom");
function getKeyAlgorithm(name5) {
  switch (name5) {
    case "HS256":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-256"
        }
      };
    case "HS384":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-384"
        }
      };
    case "HS512":
      return {
        name: "HMAC",
        hash: {
          name: "SHA-512"
        }
      };
    case "RS256":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-256"
        }
      };
    case "RS384":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-384"
        }
      };
    case "RS512":
      return {
        name: "RSASSA-PKCS1-v1_5",
        hash: {
          name: "SHA-512"
        }
      };
    case "PS256":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-256"
        },
        saltLength: 32
        // 256 >> 3
      };
    case "PS384":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-384"
        },
        saltLength: 48
        // 384 >> 3
      };
    case "PS512":
      return {
        name: "RSA-PSS",
        hash: {
          name: "SHA-512"
        },
        saltLength: 64
        // 512 >> 3,
      };
    case "ES256":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-256"
        },
        namedCurve: "P-256"
      };
    case "ES384":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-384"
        },
        namedCurve: "P-384"
      };
    case "ES512":
      return {
        name: "ECDSA",
        hash: {
          name: "SHA-512"
        },
        namedCurve: "P-521"
      };
    case "EdDSA":
      return {
        name: "Ed25519",
        namedCurve: "Ed25519"
      };
    default:
      throw new JwtAlgorithmNotImplemented(name5);
  }
}
__name(getKeyAlgorithm, "getKeyAlgorithm");
function isCryptoKey(key) {
  const runtime = getRuntimeKey();
  if (runtime === "node" && !!crypto.webcrypto) {
    return key instanceof crypto.webcrypto.CryptoKey;
  }
  return key instanceof CryptoKey;
}
__name(isCryptoKey, "isCryptoKey");

// node_modules/hono/dist/utils/jwt/jwt.js
var encodeJwtPart = /* @__PURE__ */ __name((part) => encodeBase64Url(utf8Encoder.encode(JSON.stringify(part)).buffer).replace(/=/g, ""), "encodeJwtPart");
var encodeSignaturePart = /* @__PURE__ */ __name((buf) => encodeBase64Url(buf).replace(/=/g, ""), "encodeSignaturePart");
var decodeJwtPart = /* @__PURE__ */ __name((part) => JSON.parse(utf8Decoder.decode(decodeBase64Url(part))), "decodeJwtPart");
function isTokenHeader(obj) {
  if (typeof obj === "object" && obj !== null) {
    const objWithAlg = obj;
    return "alg" in objWithAlg && Object.values(AlgorithmTypes).includes(objWithAlg.alg) && (!("typ" in objWithAlg) || objWithAlg.typ === "JWT");
  }
  return false;
}
__name(isTokenHeader, "isTokenHeader");
var sign = /* @__PURE__ */ __name(async (payload, privateKey, alg = "HS256") => {
  const encodedPayload = encodeJwtPart(payload);
  let encodedHeader;
  if (typeof privateKey === "object" && "alg" in privateKey) {
    alg = privateKey.alg;
    encodedHeader = encodeJwtPart({ alg, typ: "JWT", kid: privateKey.kid });
  } else {
    encodedHeader = encodeJwtPart({ alg, typ: "JWT" });
  }
  const partialToken = `${encodedHeader}.${encodedPayload}`;
  const signaturePart = await signing(privateKey, alg, utf8Encoder.encode(partialToken));
  const signature = encodeSignaturePart(signaturePart);
  return `${partialToken}.${signature}`;
}, "sign");
var verify = /* @__PURE__ */ __name(async (token, publicKey, algOrOptions) => {
  if (!algOrOptions) {
    throw new JwtAlgorithmRequired();
  }
  const {
    alg,
    iss,
    nbf = true,
    exp = true,
    iat = true,
    aud
  } = typeof algOrOptions === "string" ? { alg: algOrOptions } : algOrOptions;
  if (!alg) {
    throw new JwtAlgorithmRequired();
  }
  const tokenParts = token.split(".");
  if (tokenParts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  const { header, payload } = decode(token);
  if (!isTokenHeader(header)) {
    throw new JwtHeaderInvalid(header);
  }
  if (header.alg !== alg) {
    throw new JwtAlgorithmMismatch(alg, header.alg);
  }
  const now = Math.floor(Date.now() / 1e3);
  if (nbf && payload.nbf && payload.nbf > now) {
    throw new JwtTokenNotBefore(token);
  }
  if (exp && payload.exp && payload.exp <= now) {
    throw new JwtTokenExpired(token);
  }
  if (iat && payload.iat && now < payload.iat) {
    throw new JwtTokenIssuedAt(now, payload.iat);
  }
  if (iss) {
    if (!payload.iss) {
      throw new JwtTokenIssuer(iss, null);
    }
    if (typeof iss === "string" && payload.iss !== iss) {
      throw new JwtTokenIssuer(iss, payload.iss);
    }
    if (iss instanceof RegExp && !iss.test(payload.iss)) {
      throw new JwtTokenIssuer(iss, payload.iss);
    }
  }
  if (aud) {
    if (!payload.aud) {
      throw new JwtPayloadRequiresAud(payload);
    }
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const matched = audiences.some(
      (payloadAud) => aud instanceof RegExp ? aud.test(payloadAud) : typeof aud === "string" ? payloadAud === aud : Array.isArray(aud) && aud.includes(payloadAud)
    );
    if (!matched) {
      throw new JwtTokenAudience(aud, payload.aud);
    }
  }
  const headerPayload = token.substring(0, token.lastIndexOf("."));
  const verified = await verifying(
    publicKey,
    alg,
    decodeBase64Url(tokenParts[2]),
    utf8Encoder.encode(headerPayload)
  );
  if (!verified) {
    throw new JwtTokenSignatureMismatched(token);
  }
  return payload;
}, "verify");
var symmetricAlgorithms = [
  AlgorithmTypes.HS256,
  AlgorithmTypes.HS384,
  AlgorithmTypes.HS512
];
var verifyWithJwks = /* @__PURE__ */ __name(async (token, options, init) => {
  const verifyOpts = options.verification || {};
  const header = decodeHeader(token);
  if (!isTokenHeader(header)) {
    throw new JwtHeaderInvalid(header);
  }
  if (!header.kid) {
    throw new JwtHeaderRequiresKid(header);
  }
  if (symmetricAlgorithms.includes(header.alg)) {
    throw new JwtSymmetricAlgorithmNotAllowed(header.alg);
  }
  if (!options.allowedAlgorithms.includes(header.alg)) {
    throw new JwtAlgorithmNotAllowed(header.alg, options.allowedAlgorithms);
  }
  let verifyKeys = options.keys ? [...options.keys] : void 0;
  if (options.jwks_uri) {
    const response = await fetch(options.jwks_uri, init);
    if (!response.ok) {
      throw new Error(`failed to fetch JWKS from ${options.jwks_uri}`);
    }
    const data = await response.json();
    if (!data.keys) {
      throw new Error('invalid JWKS response. "keys" field is missing');
    }
    if (!Array.isArray(data.keys)) {
      throw new Error('invalid JWKS response. "keys" field is not an array');
    }
    verifyKeys ??= [];
    verifyKeys.push(...data.keys);
  } else if (!verifyKeys) {
    throw new Error('verifyWithJwks requires options for either "keys" or "jwks_uri" or both');
  }
  const matchingKey = verifyKeys.find((key) => key.kid === header.kid);
  if (!matchingKey) {
    throw new JwtTokenInvalid(token);
  }
  if (matchingKey.alg && matchingKey.alg !== header.alg) {
    throw new JwtAlgorithmMismatch(matchingKey.alg, header.alg);
  }
  return await verify(token, matchingKey, {
    alg: header.alg,
    ...verifyOpts
  });
}, "verifyWithJwks");
var decode = /* @__PURE__ */ __name((token) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    return {
      header,
      payload
    };
  } catch {
    throw new JwtTokenInvalid(token);
  }
}, "decode");
var decodeHeader = /* @__PURE__ */ __name((token) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtTokenInvalid(token);
  }
  try {
    return decodeJwtPart(parts[0]);
  } catch {
    throw new JwtTokenInvalid(token);
  }
}, "decodeHeader");

// node_modules/hono/dist/utils/jwt/index.js
var Jwt = { sign, verify, decode, verifyWithJwks };

// node_modules/hono/dist/middleware/jwt/jwt.js
var verifyWithJwks2 = Jwt.verifyWithJwks;
var verify2 = Jwt.verify;
var decode2 = Jwt.decode;
var sign2 = Jwt.sign;

// src/controllers/auth.controller.js
var ACCESS_TOKEN_TTL = 7 * 24 * 60 * 60;
var REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;
function getCookieConfig(c, maxAgeSeconds) {
  const url = c.req.url;
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  return {
    httpOnly: true,
    secure: isLocal ? false : true,
    sameSite: isLocal ? "Lax" : "None",
    maxAge: maxAgeSeconds,
    path: "/"
  };
}
__name(getCookieConfig, "getCookieConfig");
var registerController = /* @__PURE__ */ __name(async (c) => {
  try {
    const { email, name: name5, password } = await c.req.json();
    const db = c.env.DB;
    if (!email || !name5 || !password) {
      return c.json({ message: "All fields required: email, name, password", status: 400 }, 400);
    }
    const existingUser = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email.toLowerCase().trim()).first();
    if (existingUser) {
      return c.json({ message: "Email already registered", status: 400 }, 400);
    }
    const salt = await bcryptjs_default.genSalt(10);
    const hashedPassword = await bcryptjs_default.hash(password, salt);
    const assignedRole = "employee";
    const result = await db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").bind(name5.trim(), email.toLowerCase().trim(), hashedPassword, assignedRole).run();
    if (result.meta.changes === 0) {
      throw new Error("Database insertion failed");
    }
    return c.json({ message: "User registered successfully", success: true }, 201);
  } catch (error) {
    console.error("[Register Error]:", error);
    return c.json({ message: error.message || "Internal Server Error", status: 500 }, 500);
  }
}, "registerController");
var loginController = /* @__PURE__ */ __name(async (c) => {
  try {
    const { email, password } = await c.req.json();
    const db = c.env.DB;
    const identifier = (email || "").toLowerCase().trim();
    if (!identifier || !password) {
      return c.json({ message: "Email and password required", status: 400 }, 400);
    }
    const user = await db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").bind(identifier).first();
    if (!user) {
      return c.json({ message: "Invalid credentials", status: 401 }, 401);
    }
    const isPasswordValid = await bcryptjs_default.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return c.json({ message: "Invalid credentials", status: 401 }, 401);
    }
    if (!c.env.ACCESS_TOKEN_SECRET || !c.env.REFRESH_TOKEN_SECRET) {
      console.error("[CRITICAL] JWT secrets missing!");
      return c.json({ message: "Server configuration error", status: 500 }, 500);
    }
    const now = Math.floor(Date.now() / 1e3);
    const ACCESS_EXPIRY = ACCESS_TOKEN_TTL;
    const REFRESH_EXPIRY = REFRESH_TOKEN_TTL;
    const accessToken = await sign2({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      exp: now + ACCESS_EXPIRY
    }, c.env.ACCESS_TOKEN_SECRET);
    const refreshToken = await sign2({
      id: user.id,
      exp: now + REFRESH_EXPIRY
    }, c.env.REFRESH_TOKEN_SECRET);
    setCookie(c, "access_token", accessToken, getCookieConfig(c, ACCESS_EXPIRY));
    setCookie(c, "refresh_token", refreshToken, getCookieConfig(c, REFRESH_EXPIRY));
    return c.json({
      message: "Login successful",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: accessToken,
      refresh_token: refreshToken,
      status: 200
    }, 200);
  } catch (error) {
    console.error("[Login Error]:", error);
    return c.json({ message: "Internal Server Error", status: 500 }, 500);
  }
}, "loginController");
var getAllUsers = /* @__PURE__ */ __name(async (c) => {
  try {
    const currentUser = c.get("user");
    if (currentUser.role !== "admin") {
      return c.json({ message: "Access denied: Admin only", status: 403 }, 403);
    }
    const db = c.env.DB;
    const { results } = await db.prepare("SELECT id, email, name, role, created_at FROM users").all();
    return c.json({ total_users: results.length, users: results, success: true }, 200);
  } catch (error) {
    console.error("[GetAllUsers Error]:", error);
    return c.json({ message: "Internal Server Error", status: 500 }, 500);
  }
}, "getAllUsers");
var getProfileHandler = /* @__PURE__ */ __name(async (c) => {
  try {
    const currentUser = c.get("user");
    const db = c.env.DB;
    const user = await db.prepare("SELECT name, email, role FROM users WHERE id = ?").bind(currentUser.id).first();
    if (!user) {
      return c.json({ message: "User not found", status: 404 }, 404);
    }
    return c.json({
      success: true,
      user: {
        name: user.name || currentUser.name || "User",
        email: user.email || currentUser.email,
        role: user.role || currentUser.role
      }
    }, 200);
  } catch (error) {
    return c.json({ message: "Failed to retrieve profile", status: 500 }, 500);
  }
}, "getProfileHandler");
var refreshTokenController = /* @__PURE__ */ __name(async (c) => {
  try {
    let refreshToken = getCookie(c, "refresh_token");
    if (!refreshToken) {
      try {
        const body = await c.req.json();
        if (body?.refresh_token) {
          refreshToken = body.refresh_token;
        }
      } catch (e) {
      }
    }
    if (!refreshToken) {
      return c.json({ message: "Refresh token missing. Please login again.", status: 401 }, 401);
    }
    const decoded = await verify2(refreshToken, c.env.REFRESH_TOKEN_SECRET);
    const db = c.env.DB;
    const user = await db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").bind(decoded.id).first();
    if (!user) {
      return c.json({ message: "User not found.", status: 401 }, 401);
    }
    const now = Math.floor(Date.now() / 1e3);
    const ACCESS_EXPIRY = ACCESS_TOKEN_TTL;
    const REFRESH_EXPIRY = REFRESH_TOKEN_TTL;
    const newAccessToken = await sign2({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      exp: now + ACCESS_EXPIRY
    }, c.env.ACCESS_TOKEN_SECRET);
    const newRefreshToken = await sign2({
      id: user.id,
      exp: now + REFRESH_EXPIRY
    }, c.env.REFRESH_TOKEN_SECRET);
    setCookie(c, "access_token", newAccessToken, getCookieConfig(c, ACCESS_EXPIRY));
    setCookie(c, "refresh_token", newRefreshToken, getCookieConfig(c, REFRESH_EXPIRY));
    return c.json({
      message: "Token refreshed",
      token: newAccessToken,
      refresh_token: newRefreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      status: 200
    }, 200);
  } catch (error) {
    console.error("[Refresh Token Error]:", error);
    return c.json({ message: "Invalid refresh token. Please login again.", status: 401 }, 401);
  }
}, "refreshTokenController");

// src/middlewares/auth.middleware.js
init_modules_watch_stub();
var authMiddleware = /* @__PURE__ */ __name(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    let token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    if (!token) {
      token = getCookie(c, "access_token");
    }
    if (!token) {
      return c.json({ message: "Unauthorized: Missing active session token", success: false }, 401);
    }
    const decodedPayload = await verify2(token, c.env.ACCESS_TOKEN_SECRET, "HS256");
    c.set("user", decodedPayload);
    await next();
  } catch (error) {
    console.error("[Security Middleware Exception Logs]:", error.message || error);
    return c.json({
      message: "Unauthorized: Invalid or expired access token architecture signature",
      success: false
    }, 401);
  }
}, "authMiddleware");

// src/routers/auth.routes.js
var authRouter = new Hono2();
authRouter.post("/signup", registerController);
authRouter.post("/login", loginController);
authRouter.post("/refresh", refreshTokenController);
authRouter.get("/users", authMiddleware, getAllUsers);
authRouter.get("/me", authMiddleware, getProfileHandler);
var auth_routes_default = authRouter;

// src/routers/timesheet.routes.js
init_modules_watch_stub();

// src/controllers/timesheet.controller.js
init_modules_watch_stub();

// src/ai/chat.js
init_modules_watch_stub();

// src/ai/providers/cloudflare.js
init_modules_watch_stub();

// src/ai/ai-config.js
init_modules_watch_stub();
var CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
var MAX_MESSAGE_CHARS = 4e3;
var MAX_TOTAL_CHARS = 52e3;
var EXTRACTION_MODE = "regex-first";
var EXTRACT_TIMEOUT_MS = 1e4;
var MAX_HISTORY_MESSAGES = 10;
var AI_TIMEOUT_MS = 25e3;

// src/ai/providers/cloudflare.js
function withTimeout(promise, ms, label = "AI") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
__name(withTimeout, "withTimeout");
function normalizeMessages(messages = []) {
  const validMessages = [];
  let totalChars = 0;
  for (const item of messages) {
    if (!item || typeof item.content !== "string" || !item.content.trim()) continue;
    const role = item.role === "system" || item.role === "assistant" ? item.role : "user";
    let content = item.content.trim();
    if (content.length > MAX_MESSAGE_CHARS) {
      content = `${content.slice(0, MAX_MESSAGE_CHARS)}
[Message truncated to stay within AI context limits]`;
    }
    if (totalChars + content.length > MAX_TOTAL_CHARS) {
      const remainingChars = MAX_TOTAL_CHARS - totalChars;
      if (remainingChars <= 200) break;
      content = `${content.slice(0, remainingChars)}
[Context truncated to stay within AI context limits]`;
    }
    const previous = validMessages[validMessages.length - 1];
    if (previous?.role === role && role !== "system") {
      previous.content += `
${content}`;
    } else {
      validMessages.push({ role, content });
    }
    totalChars += content.length;
  }
  return validMessages;
}
__name(normalizeMessages, "normalizeMessages");
function extractText(response) {
  if (!response) throw new Error("Cloudflare AI returned an empty response object");
  if (response?.result?.choices?.[0]?.message?.content) return response.result.choices[0].message.content;
  if (response?.choices?.[0]?.message?.content) return response.choices[0].message.content;
  if (typeof response?.result?.response === "string") return response.result.response;
  if (typeof response?.response === "string") return response.response;
  if (typeof response === "string") return response;
  if (response?.response && typeof response.response === "object") {
    return JSON.stringify(response.response);
  }
  throw new Error("Cloudflare AI response did not include standard string output text");
}
__name(extractText, "extractText");
async function askCloudflareAI(systemPrompt, message, history = [], env, tools = null) {
  if (!env?.AI?.run) {
    throw new Error("Cloudflare AI system binding connection is missing. Ensure wrangler.toml contains [ai] configurations.");
  }
  const messages = normalizeMessages([
    { role: "system", content: systemPrompt || "You are a helpful assistant." },
    ...history,
    { role: "user", content: message || "Hello" }
  ]);
  const payload = {
    messages,
    temperature: 0.1,
    // Highly locked down token settings for absolute mathematical response accuracy
    max_tokens: 1e3
    // Increased budget slightly to prevent tool extraction cutoff tokens
  };
  if (tools && Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }
  const response = await withTimeout(env.AI.run(CHAT_MODEL, payload), AI_TIMEOUT_MS, "WORKERS_AI");
  if (response.tool_calls && response.tool_calls.length > 0) {
    return response;
  }
  return extractText(response).trim();
}
__name(askCloudflareAI, "askCloudflareAI");

// src/ai/tools.js
init_modules_watch_stub();

// src/ai/tools/index.js
init_modules_watch_stub();

// src/ai/tools/addTimesheet.tool.js
init_modules_watch_stub();

// src/ai/tools/_helpers.js
init_modules_watch_stub();
async function getOrCreateProjectId(db, projectName) {
  const cleanName = projectName.trim();
  const existing = await db.prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)").bind(cleanName).first();
  if (existing) return existing.id;
  try {
    const insertResult = await db.prepare("INSERT INTO projects (name) VALUES (?)").bind(cleanName).run();
    if (insertResult.meta.changes === 0) {
      throw new Error(`Project creation failed: ${cleanName}`);
    }
    return insertResult.meta.last_row_id;
  } catch (err) {
    const raced = await db.prepare("SELECT id FROM projects WHERE LOWER(name) = LOWER(?)").bind(cleanName).first();
    if (raced) return raced.id;
    throw err;
  }
}
__name(getOrCreateProjectId, "getOrCreateProjectId");
function calcEndTime(startTime, durationMinutes) {
  const [sh, sm] = startTime.split(":").map(Number);
  const total = sh * 60 + sm + parseInt(durationMinutes, 10);
  const pad2 = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}
__name(calcEndTime, "calcEndTime");
function calcMinutesFromTimes(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}
__name(calcMinutesFromTimes, "calcMinutesFromTimes");
function isValidTime(t) {
  return typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
}
__name(isValidTime, "isValidTime");
function isValidEntryDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = /* @__PURE__ */ new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
__name(isValidEntryDate, "isValidEntryDate");
function todayISO() {
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
__name(todayISO, "todayISO");
function detectOverlap(entries) {
  const toRange = /* @__PURE__ */ __name((e) => {
    const [sh, sm] = e.start_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const dur = calcMinutesFromTimes(e.start_time, e.end_time);
    return { start, end: start + dur, raw: e };
  }, "toRange");
  const ranges = entries.filter((e) => isValidTime(e.start_time) && isValidTime(e.end_time)).map(toRange).sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    const prev = ranges[i - 1];
    const cur = ranges[i];
    if (cur.start < prev.end) {
      return [prev.raw, cur.raw];
    }
  }
  return null;
}
__name(detectOverlap, "detectOverlap");

// src/ai/tools/addTimesheet.tool.js
var name = "add_timesheet_entries";
var schema = {
  name,
  description: "Add work time entries to a timesheet. Handles any time format, any schedule, any number of entries. Supports breaks, night shifts, split shifts, and multilingual input.",
  parameters: {
    type: "object",
    required: ["entry_date", "entries"],
    properties: {
      project_name: {
        type: "string",
        description: "Project name exactly as mentioned by user. Never assume or invent. If not mentioned, the active selected project context is used."
      },
      entry_date: {
        type: "string",
        description: "Date in YYYY-MM-DD format. Parse from user input. Default: today when none given."
      },
      entries: {
        type: "array",
        description: "Array of work blocks. One object per continuous time block. Split around breaks. No overlaps allowed.",
        minItems: 1,
        items: {
          type: "object",
          required: ["module_name", "task_description", "start_time", "end_time"],
          properties: {
            start_time: {
              type: "string",
              description: "Start time as strict 24-hour HH:MM. Convert any expression (any language/format) into HH:MM. NEVER output anything other than HH:MM."
            },
            end_time: {
              type: "string",
              description: "End time as strict 24-hour HH:MM. Can roll to next day for night shifts. NEVER output anything other than HH:MM."
            },
            module_name: {
              type: "string",
              description: "Work category in UPPERCASE_SNAKE_CASE, derived from the task. Examples: BUG_FIXING, CLIENT_MEETING, CODE_REVIEW, DEPLOYMENT, RESEARCH, DOCUMENTATION."
            },
            task_description: {
              type: "string",
              description: "Clean, professional English summary of the work done in this block."
            },
            is_lunch: {
              type: "boolean",
              description: "True if this block is any kind of break (lunch/tea/rest). Excluded from the DB."
            }
          }
        }
      }
    }
  }
};
async function handler(ctx, data) {
  const { db, user, selectedProject, today } = ctx;
  try {
    const targetProjectName = selectedProject || data.project_name;
    if (!targetProjectName) {
      return { reply: "Please select a project first! Type '@' to choose." };
    }
    const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
    if (!hasEntries && !data.task_description) {
      return { reply: "Please describe what you worked on." };
    }
    let entryDate = data.entry_date || today;
    if (!isValidEntryDate(entryDate)) entryDate = today;
    let entriesToBatch = hasEntries ? data.entries : [
      {
        start_time: data.start_time,
        end_time: data.end_time || (data.duration_minutes ? calcEndTime(data.start_time, data.duration_minutes) : null),
        duration_minutes: data.duration_minutes,
        module_name: data.module_name || "GENERAL",
        task_description: data.task_description
      }
    ];
    entriesToBatch = entriesToBatch.filter((e) => !e.is_lunch);
    if (entriesToBatch.length === 0) {
      return {
        reply: "No workable time entries found. Either no time was mentioned, or only a break was logged."
      };
    }
    const problems = [];
    const seen = /* @__PURE__ */ new Set();
    const valid = [];
    for (const e of entriesToBatch) {
      const startTime = e.start_time;
      const endTime = e.end_time || (e.duration_minutes ? calcEndTime(startTime, e.duration_minutes) : null);
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        problems.push(
          `\u2022 "${e.task_description || "one block"}" \u2014 couldn't read the time (give a clear start & end, e.g. "9 to 11").`
        );
        continue;
      }
      const mins = calcMinutesFromTimes(startTime, endTime);
      if (mins > 120) {
        problems.push(
          `\u2022 ${startTime}\u2013${endTime} ("${e.task_description || "work"}") \u2014 ${(mins / 60).toFixed(
            1
          )} hrs exceeds the 2-hour limit; please split it into blocks of max 2 hours.`
        );
        continue;
      }
      const key = `${startTime}|${endTime}|${(e.task_description || "").trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push({ ...e, start_time: startTime, end_time: endTime, _mins: mins });
    }
    const overlap = detectOverlap(valid);
    if (overlap) {
      const [a, b] = overlap;
      return {
        reply: `These blocks overlap: ${a.start_time}\u2013${a.end_time} and ${b.start_time}\u2013${b.end_time}. Please adjust so they don't clash.`
      };
    }
    if (valid.length === 0) {
      return { reply: `I couldn't save those entries:
${problems.join("\n")}` };
    }
    const projectId = await getOrCreateProjectId(db, targetProjectName);
    const statements = valid.map(
      (entry) => db.prepare(
        `INSERT INTO daily_status_entries
         (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        user.id,
        projectId,
        entryDate,
        entry.start_time,
        entry.end_time,
        entry._mins,
        (entry.module_name || "GENERAL").toUpperCase().trim(),
        entry.task_description?.trim() || "Work update"
      )
    );
    await db.batch(statements);
    const summaryLines = valid.map(
      (e) => `\u2022 ${e.start_time} \u2192 ${e.end_time} (${(e._mins / 60).toFixed(1)} hrs) \u2014 ${e.task_description}`
    ).join("\n");
    const totalMins = valid.reduce((sum, e) => sum + e._mins, 0);
    let reply = `\u2705 ${valid.length} ${valid.length === 1 ? "entry" : "entries"} saved under "${targetProjectName}" for ${entryDate}.

${summaryLines}

Total: ${(totalMins / 60).toFixed(1)} hrs`;
    if (problems.length > 0) {
      reply += `

\u26A0\uFE0F Not saved \u2014 please fix and resend just these:
${problems.join("\n")}`;
    }
    return {
      success: true,
      action: "ADD_MULTIPLE_TIMESHEETS",
      reply
    };
  } catch (err) {
    console.error("[add_timesheet_entries] handler error:", err?.message || err);
    return {
      reply: "I couldn't save those entries \u2014 one of the time blocks looked off. Please re-send with clear start and end times for each block."
    };
  }
}
__name(handler, "handler");
var addTimesheet_tool_default = { name, schema, handler };

// src/ai/tools/getTimesheet.tool.js
init_modules_watch_stub();
var name2 = "get_timesheet_logs";
var schema2 = {
  name: name2,
  description: "Fetch timesheet history by date range. Supports filtering by module, project, or specific dates. Handles natural language date queries.",
  parameters: {
    type: "object",
    required: ["from_date", "to_date"],
    properties: {
      from_date: {
        type: "string",
        description: "Start date in YYYY-MM-DD. Parse from user input. Default: today when none given."
      },
      to_date: {
        type: "string",
        description: "End date in YYYY-MM-DD. Parse from user input. Default: today when none given."
      },
      module_name: {
        type: "string",
        description: "Optional. Filter by module name in UPPERCASE_SNAKE_CASE. Example: BUG_FIXING."
      },
      project_name: {
        type: "string",
        description: "Optional. Filter by project name (partial match). Example: AI Project."
      }
    }
  }
};
async function handler2(ctx, data) {
  const { db, user, today } = ctx;
  let fromDate = data.from_date || data.date || today;
  let toDate = data.to_date || fromDate || today;
  if (!isValidEntryDate(fromDate)) fromDate = today;
  if (!isValidEntryDate(toDate) || toDate > today) toDate = today;
  if (fromDate > toDate) fromDate = toDate;
  let query = `
    SELECT d.id, d.entry_date, d.start_time, d.end_time,
           d.duration_minutes, d.module_name, d.task_description, p.name AS project_name
    FROM daily_status_entries d
    JOIN projects p ON d.project_id = p.id
    WHERE d.employee_id = ? AND d.entry_date BETWEEN ? AND ?
  `;
  const binds = [user.id, fromDate, toDate];
  if (data.module_name) {
    query += ` AND UPPER(d.module_name) = UPPER(?)`;
    binds.push(data.module_name);
  }
  if (data.project_name) {
    query += ` AND LOWER(p.name) LIKE LOWER(?)`;
    binds.push(`%${data.project_name.trim()}%`);
  }
  query += ` ORDER BY d.entry_date ASC, d.start_time ASC`;
  const rows = await db.prepare(query).bind(...binds).all();
  const results = rows.results || [];
  const totalMinutes = results.reduce(
    (sum, r) => sum + parseInt(r.duration_minutes || 0, 10),
    0
  );
  return {
    success: true,
    action: "GET_TIMESHEET",
    reply: results.length === 0 ? `No records found between ${fromDate} and ${toDate}.` : `${fromDate} to ${toDate} \u2014 Total: ${(totalMinutes / 60).toFixed(
      1
    )} hrs (${totalMinutes} mins) across ${results.length} ${results.length === 1 ? "entry" : "entries"}.`,
    data: results
  };
}
__name(handler2, "handler");
var getTimesheet_tool_default = { name: name2, schema: schema2, handler: handler2 };

// src/ai/tools/updateTimesheet.tool.js
init_modules_watch_stub();
var name3 = "update_timesheet";
var schema3 = {
  name: name3,
  description: "Update / correct an existing timesheet entry the user logged earlier (e.g. wrong time, wrong task, wrong project). Locate the target by id, or by project / task / date / start-time, then apply the new values. Use this when the user says something was logged incorrectly and wants it changed.",
  parameters: {
    type: "object",
    properties: {
      timesheet_id: {
        type: "integer",
        description: "Optional. Exact entry id when the user names one or it is clear from chat history."
      },
      match_project_name: {
        type: "string",
        description: "Optional. Project of the entry to locate."
      },
      match_task_description: {
        type: "string",
        description: "Optional. Task text of the entry to locate."
      },
      match_date: {
        type: "string",
        description: "Optional. Date (YYYY-MM-DD) of the entry to locate."
      },
      match_start_time: {
        type: "string",
        description: "Optional. The OLD start time (HH:MM) of the entry to locate. Useful to disambiguate same-day blocks."
      },
      new_start_time: {
        type: "string",
        description: "Optional new start time as strict 24-hour HH:MM."
      },
      new_end_time: {
        type: "string",
        description: "Optional new end time as strict 24-hour HH:MM."
      },
      new_task_description: {
        type: "string",
        description: "Optional new clean, professional English task summary. If the user insists on exact wording, store it verbatim."
      },
      new_module_name: {
        type: "string",
        description: "Optional new work category in UPPERCASE_SNAKE_CASE."
      },
      new_project_name: {
        type: "string",
        description: "Optional new project name to move the entry under."
      },
      new_entry_date: {
        type: "string",
        description: "Optional new date in YYYY-MM-DD."
      }
    }
  }
};
var SELECT_COLS = `d.id, d.project_id, d.entry_date, d.start_time, d.end_time,
  d.duration_minutes, d.module_name, d.task_description, p.name AS project_name`;
var ROW_FROM = `FROM daily_status_entries d JOIN projects p ON d.project_id = p.id`;
function extractNewFields(data) {
  const f = {};
  if (typeof data.new_start_time === "string") f.start_time = data.new_start_time.trim();
  if (typeof data.new_end_time === "string") f.end_time = data.new_end_time.trim();
  if (typeof data.new_task_description === "string")
    f.task_description = data.new_task_description.trim();
  if (typeof data.new_module_name === "string")
    f.module_name = data.new_module_name.toUpperCase().trim();
  if (typeof data.new_project_name === "string")
    f.project_name = data.new_project_name.trim();
  if (typeof data.new_entry_date === "string") f.entry_date = data.new_entry_date.trim();
  return f;
}
__name(extractNewFields, "extractNewFields");
async function findCandidates(db, user, data) {
  const id = data.timesheet_id || data.entry_id;
  if (id) {
    const row2 = await db.prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.id = ? AND d.employee_id = ?`).bind(id, user.id).first();
    return row2 ? [row2] : [];
  }
  const hasCriteria = data.match_project_name?.trim() || data.match_task_description?.trim() || data.match_date?.trim() || data.match_start_time?.trim();
  if (hasCriteria) {
    let q = `SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.employee_id = ?`;
    const b = [user.id];
    if (data.match_project_name?.trim()) {
      q += ` AND p.name LIKE ?`;
      b.push(`%${data.match_project_name.trim()}%`);
    }
    if (data.match_task_description?.trim()) {
      q += ` AND d.task_description LIKE ?`;
      b.push(`%${data.match_task_description.trim()}%`);
    }
    if (data.match_date?.trim()) {
      q += ` AND d.entry_date = ?`;
      b.push(data.match_date.trim());
    }
    if (data.match_start_time?.trim()) {
      q += ` AND d.start_time = ?`;
      b.push(data.match_start_time.trim());
    }
    q += ` ORDER BY d.created_at DESC LIMIT 5`;
    const { results } = await db.prepare(q).bind(...b).all();
    return results || [];
  }
  const row = await db.prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`).bind(user.id).first();
  return row ? [row] : [];
}
__name(findCandidates, "findCandidates");
async function performUpdate(ctx, row, newFields) {
  const { db, user } = ctx;
  const startTime = newFields.start_time ?? row.start_time;
  const endTime = newFields.end_time ?? row.end_time;
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return { reply: `I couldn't apply that time change \u2014 please give a clear start and end (e.g. "9 to 11").` };
  }
  const minutes = calcMinutesFromTimes(startTime, endTime);
  if (minutes > 120) {
    return {
      reply: `That change makes the block ${(minutes / 60).toFixed(1)} hrs, which exceeds the 2-hour limit. Please keep it under 2 hours.`
    };
  }
  let entryDate = newFields.entry_date ?? row.entry_date;
  if (!isValidEntryDate(entryDate)) entryDate = row.entry_date;
  let projectId = row.project_id;
  let projectName = row.project_name;
  if (newFields.project_name) {
    projectId = await getOrCreateProjectId(db, newFields.project_name);
    projectName = newFields.project_name;
  }
  const taskDescription = newFields.task_description ?? row.task_description;
  const moduleName = newFields.module_name ?? row.module_name;
  const result = await db.prepare(
    `UPDATE daily_status_entries
       SET project_id = ?, entry_date = ?, start_time = ?, end_time = ?,
           duration_minutes = ?, module_name = ?, task_description = ?,
           updated_at = datetime('now')
       WHERE id = ? AND employee_id = ?`
  ).bind(
    projectId,
    entryDate,
    startTime,
    endTime,
    minutes,
    moduleName,
    taskDescription,
    row.id,
    user.id
  ).run();
  if (result.meta.changes === 0) {
    return { reply: "That entry no longer exists or could not be updated." };
  }
  return {
    success: true,
    action: "UPDATE_TIMESHEET",
    reply: `\u2705 Updated: "${projectName}" on ${entryDate} \u2014 ${startTime} \u2192 ${endTime} (${(minutes / 60).toFixed(1)} hrs) \u2014 "${taskDescription}".`
  };
}
__name(performUpdate, "performUpdate");
async function handler3(ctx, data) {
  try {
    const { db, user } = ctx;
    const newFields = extractNewFields(data);
    if (Object.keys(newFields).length === 0) {
      return {
        reply: "Sure \u2014 what should I change on that entry? (e.g. new time, task, or project.)"
      };
    }
    const candidates = await findCandidates(db, user, data);
    if (candidates.length === 0) {
      return { reply: "I couldn't find a matching entry to update. Which one did you mean?" };
    }
    if (candidates.length > 1) {
      const top = candidates[0];
      return {
        requiresConfirmation: true,
        pendingAction: {
          action: "UPDATE_TIMESHEET",
          matchId: top.id,
          newFields
        },
        reply: `I found ${candidates.length} possible entries. The most recent is "${top.project_name}" on ${top.entry_date} (${top.start_time}\u2013${top.end_time}) \u2014 "${top.task_description}". Type "confirm" to update that one, or tell me which entry you mean.`
      };
    }
    return performUpdate(ctx, candidates[0], newFields);
  } catch (err) {
    console.error("[update_timesheet] handler error:", err?.message || err);
    return {
      reply: "I couldn't update that entry \u2014 please tell me which entry and what to change."
    };
  }
}
__name(handler3, "handler");
async function executeUpdate(ctx, pendingAction) {
  const { db, user } = ctx;
  const row = await db.prepare(`SELECT ${SELECT_COLS} ${ROW_FROM} WHERE d.id = ? AND d.employee_id = ?`).bind(pendingAction.matchId, user.id).first();
  if (!row) return { reply: "That entry no longer exists." };
  return performUpdate(ctx, row, pendingAction.newFields || {});
}
__name(executeUpdate, "executeUpdate");
var updateTimesheet_tool_default = { name: name3, schema: schema3, handler: handler3 };

// src/ai/tools/deleteTimesheet.tool.js
init_modules_watch_stub();
var name4 = "delete_timesheet";
var schema4 = {
  name: name4,
  description: "Delete a timesheet entry. Locates the target by id, or by project/task description, or falls back to the user's most recent entry. Always confirms before deleting.",
  parameters: {
    type: "object",
    properties: {
      timesheet_id: {
        type: "integer",
        description: "Optional. Exact entry id to delete, when the user names one."
      },
      project_name: {
        type: "string",
        description: "Optional. Project name to match the entry to delete."
      },
      task_description: {
        type: "string",
        description: "Optional. Task text to match the entry to delete."
      }
    }
  }
};
var SELECT_COLS2 = `d.id, p.name AS project_name, d.duration_minutes, d.task_description`;
async function handler4(ctx, data) {
  const { db, user } = ctx;
  let matchLog = null;
  const id = data.timesheet_id || data.entry_id;
  if (id) {
    matchLog = await db.prepare(
      `SELECT ${SELECT_COLS2} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.id = ? AND d.employee_id = ?`
    ).bind(id, user.id).first();
  }
  if (!matchLog && (data.project_name?.trim() || data.task_description?.trim())) {
    let q = `SELECT ${SELECT_COLS2} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ?`;
    const b = [user.id];
    if (data.project_name?.trim()) {
      q += ` AND p.name LIKE ?`;
      b.push(`%${data.project_name.trim()}%`);
    }
    if (data.task_description?.trim()) {
      q += ` AND d.task_description LIKE ?`;
      b.push(`%${data.task_description.trim()}%`);
    }
    q += ` ORDER BY d.created_at DESC LIMIT 1`;
    matchLog = await db.prepare(q).bind(...b).first();
  }
  if (!matchLog) {
    matchLog = await db.prepare(
      `SELECT ${SELECT_COLS2} FROM daily_status_entries d JOIN projects p ON d.project_id = p.id WHERE d.employee_id = ? ORDER BY d.created_at DESC LIMIT 1`
    ).bind(user.id).first();
  }
  if (!matchLog) return { reply: "No timesheet entries found to delete." };
  return {
    requiresConfirmation: true,
    pendingAction: {
      action: "DELETE_TIMESHEET",
      matchId: matchLog.id,
      projectName: matchLog.project_name
    },
    reply: `Found: "${matchLog.project_name}" \u2014 ${(matchLog.duration_minutes / 60).toFixed(
      1
    )} hrs \u2014 "${matchLog.task_description}". Type "confirm" to delete.`
  };
}
__name(handler4, "handler");
async function executeDelete(ctx, pendingAction) {
  const { db, user } = ctx;
  const result = await db.prepare("DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?").bind(pendingAction.matchId, user.id).run();
  if (result.meta.changes === 0) {
    return { reply: "Entry not found or already deleted." };
  }
  return {
    success: true,
    action: "DELETE_TIMESHEET",
    reply: `Entry from "${pendingAction.projectName}" permanently deleted.`
  };
}
__name(executeDelete, "executeDelete");
var deleteTimesheet_tool_default = { name: name4, schema: schema4, handler: handler4 };

// src/ai/tools/index.js
var MODULES = [addTimesheet_tool_default, getTimesheet_tool_default, updateTimesheet_tool_default, deleteTimesheet_tool_default];
var REGISTRY = Object.fromEntries(MODULES.map((m) => [m.name, m]));
function getToolSchemas() {
  return MODULES.map((m) => ({ type: "function", function: m.schema }));
}
__name(getToolSchemas, "getToolSchemas");
function getToolDirectory() {
  return MODULES.map((m) => `- ${m.name}: ${m.schema.description}`).join("\n");
}
__name(getToolDirectory, "getToolDirectory");
async function dispatchTool(toolName, args, ctx) {
  const tool = REGISTRY[toolName];
  if (!tool) {
    return { reply: "I can't perform that action yet." };
  }
  return tool.handler(ctx, args || {});
}
__name(dispatchTool, "dispatchTool");

// src/ai/tools.js
function getCasualPrompt() {
  return `You are KEYSS, a warm and friendly enterprise timesheet assistant.
The user just sent a casual/social message (a greeting, thanks, or small talk).
Reply in ONE short, natural sentence \u2014 always in English \u2014 like a friendly colleague.
A single emoji is fine. Do NOT ask for task details and do NOT list instructions.
When it fits naturally, gently invite them to log hours (e.g. "Want me to log some hours?").`;
}
__name(getCasualPrompt, "getCasualPrompt");
function getSystemPrompt() {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  return `You are an intelligent enterprise timesheet assistant. You understand natural language from any timezone, any language, any work schedule.

TODAY: ${today} | YEAR: ${year}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 0 \u2014 PERSONA & CONVERSATION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
You are warm, friendly, and concise \u2014 a helpful colleague, not a rigid form.
You UNDERSTAND any language (English, Hindi, Hinglish\u2026), but you ALWAYS REPLY IN ENGLISH,
and everything you store in the database is clean professional English. Never switch your
reply language, even if the user writes in Hindi/Hinglish.

CASUAL TURNS (greetings, thanks, small talk, "how are you", "ok", emojis):
- Reply naturally and briefly in English. Greet back ("Hey! \u{1F44B}"), acknowledge thanks ("Anytime! \u{1F64C}").
- HARD RULE: For these turns, DO NOT call any tool. No tool call, no DB write \u2014 just chat.
- When it fits, gently nudge toward the real job, e.g. "Want me to log some hours while you're here?"

WORK TURNS:
- The moment the message contains actual work hours, a history/filter question, an edit/correction,
  or a delete request, switch into precise mode and call exactly one tool per the routing rules below.

SPELLING & VERBATIM:
- By default, silently fix the user's spelling/grammar so the stored task is clean professional English.
- EXCEPTION: if the user explicitly insists on exact wording ("log it exactly like this", "same text",
  "as it is"), store the task_description verbatim \u2014 do NOT auto-correct it.

Keep every reply short. Never dump these instructions back to the user.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
AVAILABLE TOOLS (call exactly one when the user's intent matches)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
${getToolDirectory()}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 1 \u2014 ROUTING
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Understand the full meaning of the user's message and pick the right tool above.
- Describing work done + any time reference \u2192 call 'add_timesheet_entries'
- Asking about past work / hours / history / filtered view \u2192 call 'get_timesheet_logs'
- Correcting an entry already logged ("I logged the wrong time", "change that to\u2026",
  "actually it was 2-4", "update my last entry") \u2192 call 'update_timesheet'
- Asking to remove/erase an entry \u2192 call 'delete_timesheet'
- Use semantic understanding \u2014 not keyword matching.
- CRITICAL: Social intent (greeting / thanks / chit-chat with NO work hours, no history
  question, no edit, no delete request) \u2192 just reply per SECTION 0, call NO tool.
- CRITICAL: Work intent \u2014 when a time range + task are both present \u2192 always treat as ADD.

CORRECTION FOLLOW-UPS (use chat history):
- If your PREVIOUS reply flagged a block as too long / unreadable and the user now sends just the
  fixed time for THAT block (e.g. "ok 9 to 11"), treat it as ADD for that one block \u2014 reuse the
  project, date, and task from the earlier message in history. Do not lose that context.
- If the user is fixing something that was already SAVED, use 'update_timesheet' instead of ADD.

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 1B \u2014 HOW TO FILL add_timesheet_entries (READ CAREFULLY)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
When the user reports work, you MUST put EVERY distinct time block as its own object inside the
"entries" array. NEVER leave "entries" empty when any time is present. NEVER put the times only in
top-level fields. is_lunch=true ONLY for real breaks (lunch/tea/rest) \u2014 NEVER for actual work.

EXAMPLE
User: "9-11 API, 11-1 UI, 2-5 testing"  (selected project: AI Project)
You call add_timesheet_entries with arguments:
{
  "project_name": "AI Project",
  "entry_date": "${today}",
  "entries": [
    { "start_time": "09:00", "end_time": "11:00", "module_name": "API_DEVELOPMENT", "task_description": "API work", "is_lunch": false },
    { "start_time": "11:00", "end_time": "13:00", "module_name": "UI_DEVELOPMENT", "task_description": "UI work", "is_lunch": false },
    { "start_time": "14:00", "end_time": "17:00", "module_name": "TESTING", "task_description": "Testing", "is_lunch": false }
  ]
}
(The system will save the valid blocks and tell the user if any single block is over 2 hours \u2014 you
still output every block; do NOT drop or merge them yourself.)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 2 \u2014 TIME PARSING (FULLY DYNAMIC)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
You are smart. Parse ANY time the user gives \u2014 no restrictions.

RULES:
1. Convert all times to HH:MM 24-hour format
2. Accept any format: "9am", "9:00", "09:00", "9 baje", "21:00", "9 PM", "9-11", "half 9" etc.
3. If user says "2 hours in morning" and mentions start time \u2192 calculate end time yourself
4. If only duration given (e.g. "worked 3 hours") and no start time \u2192 ask user for start time
5. If user gives exact start and end \u2192 use exactly as given, no rounding, no snapping

EXAMPLES OF DYNAMIC PARSING:
- "9 to 11"           \u2192 09:00 to 11:00
- "9am to 1pm"        \u2192 09:00 to 13:00
- "9 baje se 12 tak"  \u2192 09:00 to 12:00
- "2pm to 5:30"       \u2192 14:00 to 17:30
- "11pm to 2am"       \u2192 23:00 to 02:00 (night shift \u2014 valid)
- "7 in morning"      \u2192 07:00 (start) \u2014 ask end time if not given
- "1am to 4am"        \u2192 01:00 to 04:00 (valid \u2014 global teams work at night)
- "half past 9 to 12" \u2192 09:30 to 12:00

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 3 \u2014 LUNCH / BREAK HANDLING (DYNAMIC)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
There is NO fixed lunch time. Every user is different. Every company is different.

RULES:
1. Default: assume NO break unless user says so
2. If user says "skip 1-2" or "lunch tha 1 se 2" \u2192 exclude that slot, split entries around it
3. If user says "no break" or "straight through" \u2192 log as one continuous block
4. If user says "took 30 min break at 12:30" \u2192 split: end at 12:30, resume at 13:00
5. If user says "lunch kiya 12 se 1" \u2192 split entry: before 12:00 and after 13:00

BREAK EXAMPLES:
User: "9 to 5 kaam kiya, lunch 1-2 tha"
\u2192 Entry 1: 09:00\u201313:00
\u2192 Entry 2: 14:00\u201317:00

User: "10am to 4pm, skip 12 to 12:30 break"
\u2192 Entry 1: 10:00\u201312:00
\u2192 Entry 2: 12:30\u201316:00

User: "worked 9 to 6, no break"
\u2192 Entry 1: 09:00\u201318:00 (single block, user confirmed no break)

User: "night shift 11pm to 7am"
\u2192 Entry 1: 23:00\u201307:00 (valid, log as-is)

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 4 \u2014 FULL DAY HANDLING (DYNAMIC)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
If user says "full day" or "poora din" WITHOUT specifying times:
\u2192 Ask: "Aapka work schedule kya hai? Start aur end time batao, aur lunch break tha?"
\u2192 Do NOT assume 9-5 or any fixed hours \u2014 every company is different

If user says "full day 8am to 6pm, lunch 1-2":
\u2192 Parse intelligently: 08:00\u201313:00, then 14:00\u201318:00

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 5 \u2014 MODULE NAME GENERATION (DYNAMIC)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Convert user's task description to UPPERCASE_SNAKE_CASE module name.
Be intelligent \u2014 derive from context, do not limit to any predefined list.

EXAMPLES:
- "fixed login bug"        \u2192 BUG_FIXING or LOGIN_BUG_FIX
- "meeting with client"    \u2192 CLIENT_MEETING
- "reviewed PR"            \u2192 CODE_REVIEW
- "deployment kiya"        \u2192 DEPLOYMENT
- "wrote unit tests"       \u2192 UNIT_TESTING
- "database migration"     \u2192 DB_MIGRATION
- "1:1 with manager"       \u2192 MANAGER_MEETING
- "research on LLMs"       \u2192 RESEARCH
- "documentation"          \u2192 DOCUMENTATION
- "on-call support"        \u2192 ON_CALL_SUPPORT
- "kuch bhi user bole"     \u2192 derive logically from the task

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 6 \u2014 DATE PARSING (DYNAMIC)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
DEFAULT: ${today} when no date mentioned. Never use a future date for logged work.

Parse naturally:
- "aaj" / "today"          \u2192 ${today}
- "kal" / "yesterday"      \u2192 calculate yesterday from today
- "Monday"                 \u2192 find most recent Monday
- "last Friday"            \u2192 calculate accordingly
- "15 May" / "May 15"      \u2192 resolve to ${year}-05-15
- "this week"              \u2192 Monday of current week to ${today}
- "last week"              \u2192 Monday to Sunday of previous week
- "this month"             \u2192 first of current month to ${today}

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 7 \u2014 CONFLICT & OVERLAP DETECTION
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
Before generating entries:
1. Check if any two entries have overlapping time ranges
2. If overlap found \u2192 fix it automatically (trim or split)
3. Never create two entries for the same date that overlap
4. If user's input is ambiguous \u2192 ask ONE clarifying question

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 8 \u2014 GLOBAL & MULTILINGUAL
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
- Accept input in ANY language (Hindi, English, Hinglish, etc.)
- ALWAYS respond in English and store data in English (see SECTION 0) \u2014 regardless of input language
- Nothing is hardcoded to one country: do not assume any timezone, currency, or working hours.
  This same assistant runs for teams in India, the US, and elsewhere \u2014 if timezone truly matters, ask.
- Night shifts, split shifts, weekend work \u2014 all valid, log as given
- "9 baje se 5 baje tak" = "9am to 5pm" \u2014 understand context, but reply in English

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
SECTION 9 \u2014 WHEN TO ASK VS WHEN TO ASSUME
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
ASK when:
- Duration given but no start time (e.g. "worked 3 hours")
- "full day" with no times specified
- Task description is completely unclear

ASSUME when:
- Times are clear enough to parse
- Common phrases like "morning" (ask start/end if times not given, or use stated times)
- User confirms no break

NEVER ask more than ONE question at a time.`;
}
__name(getSystemPrompt, "getSystemPrompt");

// src/ai/timeParser.js
init_modules_watch_stub();
var pad = /* @__PURE__ */ __name((n) => String(n).padStart(2, "0"), "pad");
var toHHMM = /* @__PURE__ */ __name((min) => {
  const m = (Math.round(min) % 1440 + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}, "toHHMM");
var TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(?:baje|bje|o'?clock)?\s*(a\.?m\.?|p\.?m\.?)?`;
var CONN = String.raw`(?:-|–|—|to|till|until|through|thru|upto|up to|se)`;
var RANGE_RE = new RegExp(`${TIME}\\s*${CONN}\\s*${TIME}`, "gi");
var BREAK_PT_A = new RegExp(String.raw`(\d{1,3})\s*min(?:ute)?s?\s*(?:break|rest)\s*(?:at|@|from)?\s*${TIME}`, "gi");
var BREAK_PT_B = new RegExp(String.raw`(?:break|rest)\s*(?:at|@)\s*${TIME}\s*for\s*(\d{1,3})\s*min`, "gi");
var mer = /* @__PURE__ */ __name((s) => !s ? null : /p/i.test(s) ? "pm" : "am", "mer");
function resolveTime(hour, minute, meridiem, minBound) {
  const min = minute || 0;
  if (meridiem === "am") return hour % 12 * 60 + min;
  if (meridiem === "pm") return (hour % 12 + 12) * 60 + min;
  if (hour >= 13 && hour <= 23) return hour * 60 + min;
  if (hour === 0) return min;
  if (hour === 12) {
    const noon = 720 + min;
    return noon >= minBound ? noon : 1440 + min;
  }
  const am = hour % 12 * 60 + min;
  const pm = (hour % 12 + 12) * 60 + min;
  const cands = [am, pm].sort((a, b) => a - b);
  for (const c of cands) if (c >= minBound) return c;
  return cands[0];
}
__name(resolveTime, "resolveTime");
function resolveWithin(hour, minute, meridiem, dayStart, dayEnd) {
  const min = minute || 0;
  if (meridiem) return resolveTime(hour, min, meridiem, 0);
  if (hour >= 13 && hour <= 23) return hour * 60 + min;
  const am = hour % 12 * 60 + min;
  const pm = (hour % 12 + 12) * 60 + min;
  const inWin = [am, pm].filter((c) => c >= dayStart && c <= dayEnd);
  if (inWin.length) return Math.min(...inWin);
  return am >= dayStart ? am : pm;
}
__name(resolveWithin, "resolveWithin");
var MODULE_RULES = [
  [/\btest|qa|scenario\b/i, "TESTING"],
  [/\bbug|fix|defect|issue\b/i, "BUG_FIXING"],
  [/\bmeet|sync|standup|stand-up|call|1:1|catch ?up\b/i, "MEETING"],
  [/\breview|pr\b/i, "CODE_REVIEW"],
  [/\bdeploy|release|ship\b/i, "DEPLOYMENT"],
  [/\bresearch|investigat|explore|spike\b/i, "RESEARCH"],
  [/\bdoc|documentation|write-?up\b/i, "DOCUMENTATION"],
  [/\bdesign|architect\b/i, "DESIGN"],
  [/\bapi|backend|server\b/i, "API_DEVELOPMENT"],
  [/\bui|ux|frontend|front-end\b/i, "UI_DEVELOPMENT"],
  [/\bdb|database|migration|sql\b/i, "DATABASE"],
  [/\bsupport|on-?call\b/i, "SUPPORT"]
];
function deriveModule(label) {
  for (const [re, mod] of MODULE_RULES) if (re.test(label)) return mod;
  return "GENERAL";
}
__name(deriveModule, "deriveModule");
function cleanLabel(raw2) {
  let s = (raw2 || "").replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s:;,.\-–—]+/, "");
  s = s.replace(/^(?:and|then|also|so|now|next|ok|okay|to|followed by|shifted to|moved to|spent|did|i|worked on|work on|working on|on|for|the|a|an|,|-|–|—)\b[\s,]*/i, "");
  s = s.replace(/\b(?:baje|bje|tak)\b/gi, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/\b(?:from|at|for|to|on|in|and|then)\s*$/i, "").trim();
  s = s.replace(/[,;:.\-]+$/g, "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
__name(cleanLabel, "cleanLabel");
var BREAK_LABEL_RE = /^(?:took |had |take |take a |i took |we took )?(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\b(?!-)/i;
var PURE_BREAK_RE = /^(?:a |the )?(?:short |quick |small |\d+\s*-?\s*min(?:ute)?s?\s*)?(?:tea |coffee |lunch )?(?:break|rest|lunch)\s*$/i;
function isBreakLabel(text) {
  return PURE_BREAK_RE.test(String(text || "").trim());
}
__name(isBreakLabel, "isBreakLabel");
function parseWorkBlocks(message) {
  let text = String(message || "");
  if (!text.trim()) return { entries: [] };
  text = text.replace(/\s*(?:-{1,2}>|={1,2}>|─+>|→|⟶|⟹|➜|▶|▸|»)\s*/g, " to ");
  const ranges = [];
  let m;
  RANGE_RE.lastIndex = 0;
  while (m = RANGE_RE.exec(text)) {
    ranges.push({
      index: m.index,
      end: m.index + m[0].length,
      sh: +m[1],
      sm: +(m[2] || 0),
      sMer: mer(m[3]),
      eh: +m[4],
      em: +(m[5] || 0),
      eMer: mer(m[6])
    });
  }
  if (ranges.length === 0) return { entries: [] };
  const breaks = [];
  for (const r of ranges) {
    const pre = text.slice(Math.max(0, r.index - 40), r.index).toLowerCase().split(/[,;.\n]/).pop();
    const hasTimeBefore = /\d{1,2}(?::\d{2})?\s*(?:-|–|—|to|till|baje)/i.test(pre);
    r.isBreak = !hasTimeBefore && /\b(lunch|break|rest|tea)\b(?!-)/.test(pre);
  }
  const workRanges = ranges.filter((r) => !r.isBreak);
  let pointer = 0;
  const work = [];
  for (const r of workRanges) {
    const start = resolveTime(r.sh, r.sm, r.sMer, pointer);
    let end = resolveTime(r.eh, r.em, r.eMer, start);
    if (end <= start) end += 1440;
    pointer = end;
    work.push({ start, end, index: r.index, endIdx: r.end });
  }
  if (work.length === 0) return { entries: [] };
  const dayStart = Math.min(...work.map((w) => w.start));
  const dayEnd = Math.max(...work.map((w) => w.end));
  for (const r of ranges.filter((r2) => r2.isBreak)) {
    const bs = resolveWithin(r.sh, r.sm, r.sMer, dayStart, dayEnd);
    let be = resolveWithin(r.eh, r.em, r.eMer, dayStart, dayEnd);
    if (be <= bs) be += 60;
    breaks.push([bs, be]);
  }
  let pm2;
  BREAK_PT_A.lastIndex = 0;
  while (pm2 = BREAK_PT_A.exec(text)) {
    const dur = +pm2[1];
    const t = resolveWithin(+pm2[2], +(pm2[3] || 0), mer(pm2[4]), dayStart, dayEnd);
    breaks.push([t, t + dur]);
  }
  BREAK_PT_B.lastIndex = 0;
  while (pm2 = BREAK_PT_B.exec(text)) {
    const t = resolveWithin(+pm2[1], +(pm2[2] || 0), mer(pm2[3]), dayStart, dayEnd);
    const dur = +pm2[4];
    breaks.push([t, t + dur]);
  }
  let pieces = work.map((w) => ({ start: w.start, end: w.end, index: w.index, endIdx: w.endIdx }));
  for (const [bs, be] of breaks) {
    const next = [];
    for (const p of pieces) {
      if (be <= p.start || bs >= p.end) {
        next.push(p);
      } else {
        if (bs > p.start) next.push({ ...p, end: bs });
        if (be < p.end) next.push({ ...p, start: be });
      }
    }
    pieces = next;
  }
  pieces = pieces.filter((p) => p.end > p.start);
  const nextStart = /* @__PURE__ */ __name((idx) => {
    let best = text.length;
    for (const r of ranges) if (r.index > idx && r.index < best) best = r.index;
    return best;
  }, "nextStart");
  const prevEnd = /* @__PURE__ */ __name((idx) => {
    let e = 0;
    for (const r of ranges) if (r.end <= idx && r.end > e) e = r.end;
    return e;
  }, "prevEnd");
  const SENT = /[.;\n]| then | followed by | shifted to | moved to | after that |\bthen\b/i;
  const MAX_DESC = 400;
  function labelFor(piece) {
    const after = text.slice(piece.endIdx, Math.min(nextStart(piece.index), piece.endIdx + MAX_DESC)).split(SENT)[0];
    const lblA = cleanLabel(after);
    if (lblA && PURE_BREAK_RE.test(lblA)) return lblA;
    if (lblA && !BREAK_LABEL_RE.test(lblA)) return lblA;
    const before = text.slice(prevEnd(piece.index), piece.index).split(SENT).pop();
    const lblB = cleanLabel(before);
    if (lblB && !BREAK_LABEL_RE.test(lblB)) return lblB;
    if (lblA && BREAK_LABEL_RE.test(lblA)) return lblA;
    if (lblB && BREAK_LABEL_RE.test(lblB)) return lblB;
    return "Work";
  }
  __name(labelFor, "labelFor");
  const entries = pieces.map((p) => {
    const label = labelFor(p);
    return {
      start_time: toHHMM(p.start),
      end_time: toHHMM(p.end),
      module_name: deriveModule(label),
      task_description: label,
      is_lunch: false
    };
  }).filter((e) => !BREAK_LABEL_RE.test(e.task_description) || e.task_description === "Work");
  return { entries };
}
__name(parseWorkBlocks, "parseWorkBlocks");
var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseEntryDate(message, now = /* @__PURE__ */ new Date()) {
  const m = String(message || "").toLowerCase();
  const iso = /* @__PURE__ */ __name((dt) => dt.toISOString().slice(0, 10), "iso");
  const shift = /* @__PURE__ */ __name((days) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + days);
    return iso(x);
  }, "shift");
  const explicit = m.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];
  if (/\b(day before yesterday|parso)\b/.test(m)) return shift(-2);
  if (/\b(yesterday|kal|kl)\b/.test(m)) return shift(-1);
  if (/\b(today|aaj|abhi)\b/.test(m)) return iso(now);
  let dm = m.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  let day, mon;
  if (dm) {
    day = +dm[1];
    mon = MONTHS[dm[2]];
  } else {
    dm = m.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dm) {
      mon = MONTHS[dm[1]];
      day = +dm[2];
    }
  }
  if (day != null && mon != null && day >= 1 && day <= 31) {
    const y = now.getUTCFullYear();
    const cand = new Date(Date.UTC(y, mon, day));
    if (cand > now) cand.setUTCFullYear(y - 1);
    return iso(cand);
  }
  return void 0;
}
__name(parseEntryDate, "parseEntryDate");

// src/ai/blockExtractor.js
init_modules_watch_stub();
var EXTRACT_PROMPT = `You convert a worker's free-text status update into a STRICT JSON array of work blocks.

OUTPUT RULES (critical):
- Output ONLY a JSON array. No prose, no markdown fences, no explanation.
- Each element: {"start_time":"HH:MM","end_time":"HH:MM","task":"short clean English summary","is_lunch":false}
- Times in 24-hour HH:MM. Convert ANY format: "9am", "9-11", "9 to 11", "9 \u2192 11", "9 baje", "9:30 PM".
- One element per continuous time block. Split around breaks.
- Use the day's context so times read left-to-right (e.g. "11 to 1" after a 9-11 block = 11:00 to 13:00).
- is_lunch = true ONLY for lunch/tea/rest breaks. These are removed later, but still include them.
- task = the work described for THAT block, in clean professional English (fix obvious typos).
- If the message contains no work time at all, output exactly: []

EXAMPLE 1
User: "10-11 made some ui, 12-1 lunch break, 1-2 worked on jira"
Output: [{"start_time":"10:00","end_time":"11:00","task":"Made some UI","is_lunch":false},{"start_time":"12:00","end_time":"13:00","task":"Lunch break","is_lunch":true},{"start_time":"13:00","end_time":"14:00","task":"Worked on Jira","is_lunch":false}]

EXAMPLE 2
User: "9 \u2192 11 fix the api bugs then 11 \u2192 12:30 deployment"
Output: [{"start_time":"09:00","end_time":"11:00","task":"Fix the API bugs","is_lunch":false},{"start_time":"11:00","end_time":"12:30","task":"Deployment","is_lunch":false}]`;
function withTimeout2(promise, ms, label = "EXTRACT") {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}
__name(withTimeout2, "withTimeout");
function toHHMM2(s) {
  if (typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}
__name(toHHMM2, "toHHMM");
function extractJsonArray(raw2) {
  if (typeof raw2 !== "string") return null;
  const start = raw2.indexOf("[");
  const end = raw2.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(raw2.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
__name(extractJsonArray, "extractJsonArray");
async function llmExtractBlocks(message, env) {
  if (!env?.AI?.run) return [];
  let response;
  try {
    response = await withTimeout2(
      env.AI.run(CHAT_MODEL, {
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: message }
        ],
        temperature: 0,
        max_tokens: 800
      }),
      EXTRACT_TIMEOUT_MS
    );
  } catch (err) {
    console.warn("[llmExtractBlocks] failed \u2192 regex fallback:", err?.message || err);
    return [];
  }
  const text = typeof response === "string" ? response : response?.response ?? response?.result?.response ?? "";
  const arr = extractJsonArray(text);
  if (!arr) return [];
  const out = [];
  for (const it of arr) {
    const start = toHHMM2(it?.start_time);
    const end = toHHMM2(it?.end_time);
    if (!start || !end) continue;
    const task = typeof it?.task === "string" && it.task.trim() ? it.task.trim() : "Work";
    out.push({
      start_time: start,
      end_time: end,
      task_description: task,
      module_name: deriveModule(task),
      // Trust the model's flag, but re-flag a break it mislabeled as work
      // using our tested break detector (defense-in-depth).
      is_lunch: !!it?.is_lunch || isBreakLabel(task)
    });
  }
  return out;
}
__name(llmExtractBlocks, "llmExtractBlocks");
async function extractWorkBlocks(message, env) {
  const runLLM = /* @__PURE__ */ __name(async () => {
    const llm2 = await llmExtractBlocks(message, env);
    return llm2.some((e) => !e.is_lunch) ? llm2 : null;
  }, "runLLM");
  const runRegex = /* @__PURE__ */ __name(() => {
    const r = parseWorkBlocks(message).entries;
    return r.length > 0 ? r : null;
  }, "runRegex");
  if (EXTRACTION_MODE === "regex-first") {
    const regex2 = runRegex();
    if (regex2) return { entries: regex2, source: "regex" };
    const llm2 = await runLLM();
    if (llm2) return { entries: llm2, source: "llm" };
    return { entries: [], source: "none" };
  }
  const llm = await runLLM();
  if (llm) return { entries: llm, source: "llm" };
  const regex = runRegex();
  if (regex) return { entries: regex, source: "regex" };
  return { entries: [], source: "none" };
}
__name(extractWorkBlocks, "extractWorkBlocks");

// src/ai/chat.js
var DELETE_INTENT = /\b(delete|remove|erase|discard|hata do|mita do)\b/i;
var UPDATE_INTENT = /\b(?:update|edit|correct|modify)\s+(?:the |my |that |previous |last )?(?:entry|entries|time|timing|log|logs|record|timesheet|slot)\b|\bactually it was\b|\bmade a mistake\b|\bwrong (?:time|entry|slot)\b|\bgalti se (?:add|log|likh)/i;
var STRONG_GET = /\b(show|list|view|fetch|display|history|report|summary|how many|how much|kitne|kitna|total hours|fetch my|my logs)\b/i;
var GET_INTENT = /\b(show|list|view|fetch|display|history|report|summary|total|how many|how much|kitne|kitna|logged|my hours|my entries|this week|last week|this month|last month|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/i;
function safeParseArgs(raw2) {
  if (typeof raw2 !== "string") return raw2;
  try {
    return JSON.parse(raw2);
  } catch {
    const start = raw2.indexOf("{");
    if (start === -1) throw new Error("Tool args: no JSON object boundary found.");
    let depth = 0, end = -1;
    for (let i = start; i < raw2.length; i++) {
      if (raw2[i] === "{") depth++;
      else if (raw2[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end === -1) throw new Error("Tool args: malformed unclosed bracket structure.");
    return JSON.parse(raw2.slice(start, end + 1));
  }
}
__name(safeParseArgs, "safeParseArgs");
var WORK_SIGNAL = /(\d|log|hour|hrs|worked|work on|kaam|task|project|delete|remove|update|change|edit|show|list|report|status|entry|entries|timesheet|break|lunch|shift|am\b|pm\b)/i;
function isSmallTalk(message) {
  const m = message.toLowerCase().trim().replace(/[!.,?]+$/g, "").trim();
  if (!m || m.length > 40) return false;
  if (WORK_SIGNAL.test(m)) return false;
  return /^(hi+|hey+|hello+|helo+|hii+|yo|hola|namaste|hye|sup|wassup|whats? ?up)$/.test(m) || /^good ?(morning|afternoon|evening|night|day)$/.test(m) || /^(thanks|thank ?you|thank ?u|thx|tysm|ty|shukriya|dhanyavaad)$/.test(m) || /^how ?(are|r) ?(you|u|ya|things)/.test(m) || /^(kaise|kese) ?ho/.test(m) || /^(ok+|okay|kk?|cool|nice|great|awesome|perfect|got it|fine|alright|acha)$/.test(m) || /^(bye+|goodbye|see ?ya|cya|tata|gn|good ?night)$/.test(m);
}
__name(isSmallTalk, "isSmallTalk");
function buildSlidingWindow(history) {
  let safe = (Array.isArray(history) ? history : []).filter((h) => h && typeof h.content === "string" && h.content.trim()).slice(-MAX_HISTORY_MESSAGES);
  let total = safe.reduce((s, h) => s + h.content.length, 0);
  while (total > MAX_TOTAL_CHARS && safe.length > 1) {
    total -= safe[0].content.length;
    safe = safe.slice(1);
  }
  return safe.map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.content
  }));
}
__name(buildSlidingWindow, "buildSlidingWindow");
async function aiChat(env, userId, message, history = []) {
  try {
    const cleanMessage = (message || "").trim();
    if (cleanMessage.length > MAX_MESSAGE_CHARS) {
      return { reply: "Message too long. Please keep your request under 4000 characters." };
    }
    const window = buildSlidingWindow(history);
    if (isSmallTalk(cleanMessage)) {
      const casual = await askCloudflareAI(getCasualPrompt(), cleanMessage, window, env, null);
      const reply2 = typeof casual === "string" && casual.trim() ? casual.trim() : "Hey! \u{1F44B} Want me to log some hours? Just tell me the time and the task.";
      return { reply: reply2 };
    }
    const wantsOther = DELETE_INTENT.test(cleanMessage) || UPDATE_INTENT.test(cleanMessage) || STRONG_GET.test(cleanMessage);
    if (!wantsOther) {
      const { entries, source } = await extractWorkBlocks(cleanMessage, env);
      if (entries.length > 0) {
        const entry_date = parseEntryDate(cleanMessage);
        console.log(`[hybrid add: ${source}]`, JSON.stringify({ entry_date, entries }));
        return {
          action: {
            name: "add_timesheet_entries",
            data: { entries, ...entry_date ? { entry_date } : {} }
          }
        };
      }
      if (/\d/.test(cleanMessage)) {
        console.warn("[hybrid add] no blocks extracted (regex + LLM) for:", cleanMessage);
        return {
          reply: `I couldn't read the time blocks in that one. Could you re-send in a clearer format? e.g. "9-11 API work" or "9 to 11 fixed login bug; 2 to 4 testing".`
        };
      }
    }
    const toolResponse = await askCloudflareAI(
      getSystemPrompt(),
      cleanMessage,
      window,
      env,
      getToolSchemas()
    );
    const toolCall = toolResponse?.tool_calls?.[0];
    console.log("[AI raw]", JSON.stringify({
      userMessage: cleanMessage,
      toolName: toolCall?.name || null,
      toolArgs: toolCall ? toolCall.arguments : null
    }));
    if (toolCall) {
      if (toolCall.name === "get_timesheet_logs" && !GET_INTENT.test(cleanMessage)) {
        return {
          reply: "I'm here to help with your timesheet \u2014 want me to log some hours, or show your logged hours for a date range?"
        };
      }
      const args = safeParseArgs(toolCall.arguments);
      return { action: { name: toolCall.name, data: args } };
    }
    const reply = typeof toolResponse === "string" ? toolResponse : toolResponse?.response || "Could you clarify your request? e.g. 'Log 9 to 11 on Project-X' or 'Show my hours this week'.";
    return { reply };
  } catch (err) {
    if (String(err?.message).includes("_TIMEOUT")) {
      console.warn("[AI Timeout]:", err.message);
      return { reply: "I'm taking too long to respond right now \u2014 please try again in a moment." };
    }
    console.error("[Fatal Pipeline Error]:", err);
    return { reply: "Internal error occurred. Please try again." };
  }
}
__name(aiChat, "aiChat");

// src/controllers/timesheet.controller.js
var addTimesheetEntry = /* @__PURE__ */ __name(async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get("user");
    const employeeId = currentUser.id;
    const body = await c.req.json();
    let { entry_date, start_time, end_time, module_name, task_description, project_name, duration_minutes, duration_hours } = body;
    if (!duration_minutes && duration_hours) {
      duration_minutes = Math.round(parseFloat(duration_hours) * 60);
    }
    if (!duration_minutes && start_time && end_time) {
      duration_minutes = calcMinutesFromTimes(start_time, end_time);
    }
    if (!end_time && start_time && duration_minutes) {
      end_time = calcEndTime(start_time, duration_minutes);
    }
    if (!entry_date || !start_time || !end_time || !duration_minutes || !task_description || !project_name) {
      return c.json({ message: "Missing required fields: entry_date, start_time, end_time, duration_minutes, task_description, project_name", success: false }, 400);
    }
    if (parseInt(duration_minutes, 10) > 120) {
      return c.json({
        message: "Validation Error: You cannot log a manual entry exceeding 2 hours (120 mins) at once. Please split your work into smaller slots.",
        success: false
      }, 400);
    }
    const projectId = await getOrCreateProjectId(db, project_name);
    const result = await db.prepare(`INSERT INTO daily_status_entries (employee_id, project_id, entry_date, start_time, end_time, duration_minutes, module_name, task_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(employeeId, projectId, entry_date, start_time, end_time, parseInt(duration_minutes, 10), (module_name || "GENERAL").toUpperCase().trim(), task_description).run();
    if (result.meta.changes === 0) throw new Error("Insert failed.");
    return c.json({ message: "Entry saved successfully!", success: true }, 201);
  } catch (error) {
    console.error("[Timesheet Insert Error]:", error);
    return c.json({ message: "Internal Server Error", success: false }, 500);
  }
}, "addTimesheetEntry");
var getAllTimesheetsAdmin = /* @__PURE__ */ __name(async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get("user");
    const { dateFrom, dateTo, employeeName, clientName } = Object.fromEntries(
      ["dateFrom", "dateTo", "employeeName", "clientName"].map((k) => [k, c.req.query(k)])
    );
    let sqlQuery = `
            SELECT t.id, t.employee_id, t.project_id, t.entry_date, t.start_time, t.end_time,
                   t.duration_minutes, t.task_description, t.module_name, t.is_email_sent, t.created_at,
                   u.name as employee_name, u.email as employee_email, p.name as project_name
            FROM daily_status_entries t
            JOIN users u ON t.employee_id = u.id
            JOIN projects p ON t.project_id = p.id
            WHERE 1=1
        `;
    const binds = [];
    if (currentUser.role === "employee") {
      sqlQuery += ` AND t.employee_id = ?`;
      binds.push(currentUser.id);
    } else if (employeeName && employeeName !== "all") {
      sqlQuery += ` AND LOWER(u.name) = LOWER(?)`;
      binds.push(employeeName);
    }
    if (dateFrom) {
      sqlQuery += ` AND t.entry_date >= ?`;
      binds.push(dateFrom);
    }
    if (dateTo) {
      sqlQuery += ` AND t.entry_date <= ?`;
      binds.push(dateTo);
    }
    if (clientName && clientName !== "all") {
      sqlQuery += ` AND LOWER(p.name) LIKE LOWER(?)`;
      binds.push(`%${clientName}%`);
    }
    sqlQuery += ` ORDER BY t.entry_date DESC, t.created_at DESC`;
    const stmt = db.prepare(sqlQuery);
    const { results } = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();
    return c.json({ total_records: results.length, telemetry_logs: results, success: true }, 200);
  } catch (error) {
    console.error("[Filter Engine Error]:", error);
    return c.json({ message: "Internal Server Error", success: false }, 500);
  }
}, "getAllTimesheetsAdmin");
var deleteTimesheetEntry = /* @__PURE__ */ __name(async (c) => {
  try {
    const db = c.env.DB;
    const currentUser = c.get("user");
    const logId = c.req.param("id");
    if (!logId) return c.json({ message: "Missing entry ID", success: false }, 400);
    const result = await db.prepare(`DELETE FROM daily_status_entries WHERE id = ? AND employee_id = ?`).bind(logId, currentUser.id).run();
    if (result.meta.changes === 0) return c.json({ message: "Entry not found or unauthorized.", success: false }, 404);
    return c.json({ message: "Entry deleted successfully!", success: true }, 200);
  } catch (error) {
    console.error("[Delete Error]:", error);
    return c.json({ message: "Internal Server Error", success: false }, 500);
  }
}, "deleteTimesheetEntry");
var aiChatHandler = /* @__PURE__ */ __name(async (c) => {
  try {
    const user = c.get("user");
    const db = c.env.DB;
    const { message, history = [], pendingAction = null, selectedProject = null } = await c.req.json();
    if (!message) return c.json({ success: false, message: "Message required" }, 400);
    const ctx = { db, user, env: c.env, selectedProject, today: todayISO() };
    const isConfirming = /^(confirm|yes|haan|ha|ok|okay)\b/i.test(message.trim());
    if (isConfirming && pendingAction?.action === "DELETE_TIMESHEET") {
      const out = await executeDelete(ctx, pendingAction);
      return c.json(out, 200);
    }
    if (isConfirming && pendingAction?.action === "UPDATE_TIMESHEET") {
      const out = await executeUpdate(ctx, pendingAction);
      return c.json(out, 200);
    }
    const result = await aiChat(c.env, user.id, message, history);
    if (result.action) {
      const out = await dispatchTool(result.action.name, result.action.data, ctx);
      return c.json(out, 200);
    }
    return c.json(result, 200);
  } catch (error) {
    console.error("[AI Handler Error]:", error);
    return c.json({ reply: "Internal server error. Please try again.", success: false }, 500);
  }
}, "aiChatHandler");
var getProjects = /* @__PURE__ */ __name(async (c) => {
  try {
    const db = c.env.DB;
    const { results } = await db.prepare("SELECT id, name FROM projects ORDER BY name ASC").all();
    return c.json({ projects: results, success: true }, 200);
  } catch (error) {
    console.error("[Projects Error]:", error);
    return c.json({ success: false, message: "Failed to fetch projects" }, 500);
  }
}, "getProjects");
var getProjectTasksController = /* @__PURE__ */ __name(async (c) => {
  const projectId = c.req.param("id");
  console.log("==> Controller Triggered for Project ID:", projectId);
  try {
    const queryPrepare = c.env.DB.prepare(
      "SELECT id, task_name FROM project_tasks WHERE project_id = ?"
    );
    const { results } = await queryPrepare.bind(projectId).all();
    return c.json({
      success: true,
      tasks: results
      // Isme saare tasks ki array hogi (like ['UI Design', 'Bug Fix'])
    }, 200);
  } catch (error) {
    console.error("\u274C CLOUD D1 ERROR OCCURRED:", error);
    return c.json({
      success: false,
      error: "Database se tasks fetch karne mein koi dikkat aayi hai."
    }, 500);
  }
}, "getProjectTasksController");

// src/routers/timesheet.routes.js
var timesheetRouter = new Hono2();
timesheetRouter.post("/submit", authMiddleware, addTimesheetEntry);
timesheetRouter.get("/admin/all-logs", authMiddleware, getAllTimesheetsAdmin);
timesheetRouter.delete("/delete/:id", authMiddleware, deleteTimesheetEntry);
timesheetRouter.post("/ai/chat", authMiddleware, aiChatHandler);
timesheetRouter.get("/projects", authMiddleware, getProjects);
timesheetRouter.get("/projects/:id/tasks", getProjectTasksController);
var timesheet_routes_default = timesheetRouter;

// src/index.js
var app = new Hono2();
app.use("/api/*", cors({
  origin: /* @__PURE__ */ __name((origin) => {
    if (!origin) return "http://localhost:8080";
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return origin;
    }
    return "http://localhost:8080";
  }, "origin"),
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true
  // Cookies transfer karne ke liye ye true hona zaroori hai
}));
app.route("/api/auth", auth_routes_default);
app.route("/api/timesheet", timesheet_routes_default);
app.get("/", (c) => c.text("KEYSS Timesheet Engine - Serverless Core Live"));
var src_default = app;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// .wrangler/tmp/bundle-VGz0II/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-VGz0II/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
