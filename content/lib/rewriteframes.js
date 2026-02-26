/*! @sentry/browser - rewriteframes 9.34.0 (04a587d) | https://github.com/getsentry/sentry-javascript */
(function (__window) {
var exports = {};

/** Internal global with common properties and Sentry extensions  */

/** Get's the global object for the current JavaScript runtime */
const GLOBAL_OBJ = globalThis ;

/**
 * Define an integration function that can be used to create an integration instance.
 * Note that this by design hides the implementation details of the integration, as they are considered internal.
 */
function defineIntegration(fn) {
  return fn;
}

// Slightly modified (no IE8 support, ES6) and transcribed to TypeScript
// https://github.com/calvinmetcalf/rollup-plugin-node-builtins/blob/63ab8aacd013767445ca299e468d9a60a95328d7/src/es6/path.js
//
// Copyright Joyent, Inc.and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

/** JSDoc */
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  let up = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    const last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
const splitPathRe = /^(\S+:\\|\/?)([\s\S]*?)((?:\.{1,2}|[^/\\]+?|)(\.[^./\\]*|))(?:[/\\]*)$/;
/** JSDoc */
function splitPath(filename) {
  // Truncate files names greater than 1024 characters to avoid regex dos
  // https://github.com/getsentry/sentry-javascript/pull/8737#discussion_r1285719172
  const truncated = filename.length > 1024 ? `<truncated>${filename.slice(-1024)}` : filename;
  const parts = splitPathRe.exec(truncated);
  return parts ? parts.slice(1) : [];
}

// path.resolve([from ...], to)
// posix version
/** JSDoc */
function resolve(...args) {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    const path = i >= 0 ? args[i] : '/';

    // Skip empty entries
    if (!path) {
      continue;
    }

    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(
    resolvedPath.split('/').filter(p => !!p),
    !resolvedAbsolute,
  ).join('/');

  return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
}

/** JSDoc */
function trim(arr) {
  let start = 0;
  for (; start < arr.length; start++) {
    if (arr[start] !== '') {
      break;
    }
  }

  let end = arr.length - 1;
  for (; end >= 0; end--) {
    if (arr[end] !== '') {
      break;
    }
  }

  if (start > end) {
    return [];
  }
  return arr.slice(start, end - start + 1);
}

// path.relative(from, to)
// posix version
/** JSDoc */
function relative(from, to) {
  /* eslint-disable no-param-reassign */
  from = resolve(from).slice(1);
  to = resolve(to).slice(1);
  /* eslint-enable no-param-reassign */

  const fromParts = trim(from.split('/'));
  const toParts = trim(to.split('/'));

  const length = Math.min(fromParts.length, toParts.length);
  let samePartsLength = length;
  for (let i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  let outputParts = [];
  for (let i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
}

/** JSDoc */
function basename(path, ext) {
  let f = splitPath(path)[2] || '';
  return f;
}

const INTEGRATION_NAME = 'RewriteFrames';

/**
 * Rewrite event frames paths.
 */
const rewriteFramesIntegration = defineIntegration((options = {}) => {
  const root = options.root;
  const prefix = options.prefix || 'app:///';

  const isBrowser = 'window' in GLOBAL_OBJ && !!GLOBAL_OBJ.window;

  const iteratee = options.iteratee || generateIteratee({ isBrowser, root, prefix });

  /** Process an exception event. */
  function _processExceptionsEvent(event) {
    try {
      return {
        ...event,
        exception: {
          ...event.exception,
          // The check for this is performed inside `process` call itself, safe to skip here
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          values: event.exception.values.map(value => ({
            ...value,
            ...(value.stacktrace && { stacktrace: _processStacktrace(value.stacktrace) }),
          })),
        },
      };
    } catch (_oO) {
      return event;
    }
  }

  /** Process a stack trace. */
  function _processStacktrace(stacktrace) {
    return {
      ...stacktrace,
      frames: stacktrace?.frames && stacktrace.frames.map(f => iteratee(f)),
    };
  }

  return {
    name: INTEGRATION_NAME,
    processEvent(originalEvent) {
      let processedEvent = originalEvent;

      if (originalEvent.exception && Array.isArray(originalEvent.exception.values)) {
        processedEvent = _processExceptionsEvent(processedEvent);
      }

      return processedEvent;
    },
  };
});

/**
 * Exported only for tests.
 */
function generateIteratee({
  isBrowser,
  root,
  prefix,
}

) {
  return (frame) => {
    if (!frame.filename) {
      return frame;
    }

    // Determine if this is a Windows frame by checking for a Windows-style prefix such as `C:\`
    const isWindowsFrame =
      /^[a-zA-Z]:\\/.test(frame.filename) ||
      // or the presence of a backslash without a forward slash (which are not allowed on Windows)
      (frame.filename.includes('\\') && !frame.filename.includes('/'));

    // Check if the frame filename begins with `/`
    const startsWithSlash = /^\//.test(frame.filename);

    if (isBrowser) {
      if (root) {
        const oldFilename = frame.filename;
        if (oldFilename.indexOf(root) === 0) {
          frame.filename = oldFilename.replace(root, prefix);
        }
      }
    } else {
      if (isWindowsFrame || startsWithSlash) {
        const filename = isWindowsFrame
          ? frame.filename
              .replace(/^[a-zA-Z]:/, '') // remove Windows-style prefix
              .replace(/\\/g, '/') // replace all `\\` instances with `/`
          : frame.filename;
        const base = root ? relative(root, filename) : basename(filename);
        frame.filename = `${prefix}${base}`;
      }
    }

    return frame;
  };
}

exports.rewriteFramesIntegration = rewriteFramesIntegration;


  // Add this module's exports to the global `Sentry.Integrations`
  __window.Sentry = __window.Sentry || {};
  __window.Sentry.Integrations = __window.Sentry.Integrations || {};
  for (var key in exports) {
    if (Object.prototype.hasOwnProperty.call(exports, key)) {
      __window.Sentry.Integrations[key] = exports[key];
      __window.Sentry[key] = exports[key];
    }
  }
}(window));
//# sourceMappingURL=rewriteframes.js.map
