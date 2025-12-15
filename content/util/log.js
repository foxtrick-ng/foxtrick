/**
 * log.js
 * Debug log functions
 * @author ryanli, convincedd, UnnecessaryDave
 */

'use strict';

if (!this.Foxtrick)
	// @ts-ignore-error
	var Foxtrick = {};

/**
 * Internal logging function. Compiles arguments, formats, and dispatches logs.
 * @param {Array<*>} args Arguments to log (strings, objects, errors).
 * @param {object} [options] Optional logging options, passed through to Reporter.
 */
Foxtrick._log = function(args, options = {}) {
	if (args.length < 2 && typeof args[0] === 'undefined') {
		// useless logging
		return;
	}

	// compile everything into a single string for trivial logging contexts
	let hasError = false, concated = '';
	for (let content of args) {
		let item = '';
		if (content instanceof Error) {
			// exception
			hasError = true;
			if (Foxtrick.arch == 'Sandboxed') {
				item = content.message;
				if (typeof content.stack !== 'undefined')
					item += '\n' + content.stack;
			}
		}
		else if (typeof content == 'string') {
			item = content;
		}
		else {
			try {
				item = JSON.stringify(content);
			}
			catch (e) { // eslint-disable-line no-unused-vars
				item = String(content);
				for (let [k, v] of Object.entries(content))
					item += `${k}:${v}\n`;
			}
		}
		concated += ` ${item}`;
	}

	concated += '\n';

	// prepend utc date string
	const now = new Date();
	const pad = n => n.toString().padStart(2, '0');
	const utcDateStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
	concated = `${utcDateStr}:${concated}`;

	// add the compiled string to HTML log container
	Foxtrick.log.cache += concated;
	Foxtrick.log.flush();

	// store in debug storage (retrieved with forum debug log icon)
	if (Foxtrick.context == 'content')
		Foxtrick.SB.ext.sendRequest({ req: 'addDebugLog', log: concated });
	else
		Foxtrick.addToDebugLogStorage(concated);

	if (!hasError)
		return;

	for (let content of args) {
		if (content instanceof Error) {
			Foxtrick.reportError(content, options);

			try {
				if (typeof console.error !== 'undefined')
					console.error(content.stack);
				else if (typeof console.log !== 'undefined')
					console.log(content.stack);
				else if (typeof console.trace !== 'undefined')
					console.trace();
			} catch (e) { // eslint-disable-line no-unused-vars
				// nothing more we can do
			}
		}
	}
};

/**
 * Output a list of strings/objects/errors to Foxtrick log.
 * @param {...*} args Arguments to log.
 */
Foxtrick.log = function(...args) {
	Foxtrick._log(args);
}

/**
 * Log fatal errors, marking them as such for Reporter.
 *
 * This only makes sense if at least one error is passed
 * as an argument.
 * @param {...*} args Arguments to log.
 */
Foxtrick.logFatalError = function(...args) {
	const options = {
		level: 'fatal',
	};
	Foxtrick._log(args, options);
}

/**
 * Return environment info as a formatted string for the log header.
 * @param {Document} doc The document object.
 * @returns {string} The formatted header string.
 */
Foxtrick.log.header = function(doc) {
	const INFO = [
		Foxtrick.version + ' ' + Foxtrick.branch,
		Foxtrick.arch + ' ' + Foxtrick.platform,
		Foxtrick.Prefs.getString('htLanguage'),
		Foxtrick.util.layout.isStandard(doc) ? 'standard' : 'simple',
		Foxtrick.util.layout.isRtl(doc) ? 'RTL' : 'LTR',
		Foxtrick.isStage(doc) ? ', Stage' : '',
	];
	const h = 'Version {}, {} platform, {} locale, {} layout, {} direction{}\n';
	return Foxtrick.format(h, INFO);
};

/**
 * cache log contents, will be flushed to page after calling Foxtrick.log.flush()
 *
 * @type {string}
 */
Foxtrick.log.cache = '';

/**
 * a reference to the last document element for flushing
 *
 * this is a potential memory leak,
 * therefore it needs to be cleared onbeforeunload
 *
 * @type {document}
 */
Foxtrick.log.doc = null;

/**
 * Print to HTML log, when doc is available.
 * @param {Document} [document] The document to flush the log to.
 */
Foxtrick.log.flush = function(document) {
	if (Foxtrick.platform !== 'Firefox' && Foxtrick.context === 'background')
		return;

	let doc = document;
	if (!doc) {
		if (this.doc)
			doc = this.doc;
		else
			return;
	}
	else if (doc !== this.doc) {
		this.doc = doc;
		doc.defaultView.addEventListener('beforeunload', function(ev) {
			if (Foxtrick.log.doc === ev.target)
				Foxtrick.log.doc = null;
		});
	}

	if (!Foxtrick.Prefs.getBool('DisplayHTMLDebugOutput'))
		return;

	if (!doc.getElementById('page') || Foxtrick.log.cache === '')
		return;

	let div = doc.getElementById('ft-log');
	let consoleDiv;
	if (div) {
		consoleDiv = doc.getElementById('ft-log-pre');
	}
	else {
		// create log container
		div = doc.createElement('div');
		div.id = 'ft-log';
		let header = doc.createElement('h2');
		header.textContent = Foxtrick.L10n.getString('log.header');
		div.appendChild(header);
		consoleDiv = doc.createElement('pre');
		consoleDiv.id = 'ft-log-pre';
		consoleDiv.textContent = Foxtrick.log.header(doc);
		div.appendChild(consoleDiv);

		// add to page
		let bottom = doc.getElementById('bottom');
		if (bottom)
			bottom.parentNode.insertBefore(div, bottom);
	}

	// add to log
	consoleDiv.textContent += Foxtrick.log.cache;

	// clear the cache
	Foxtrick.log.cache = '';
};

/**
 * debug log storage
 *
 * (retrieved with forum debug log icon)
 *
 * @type {string}
 */
Foxtrick.debugLogStorage = '';

/**
 * Add text to debug log storage
 *
 * Retrieved with forum debug log icon.
 * Displayed at foot of the page when debug logging enabled in prefs.
 * @param {string} text The text to add.
 */
Foxtrick.addToDebugLogStorage = function(text) {
	Foxtrick.debugLogStorage += text;
};

/**
 * Deprecated. Wrapper around Foxtrick.log for compatibility.
 * @deprecated
 * @param {*} content Content to log.
 */
Foxtrick.dump = function(content) {
	Foxtrick.log(String(content).trim());
};


/**
 * Sentry reporter object for error and message reporting.
 * @type {object}
 */
Foxtrick.log.Reporter = {
	/**
	 * The Sentry DSN (Data Source Name) for error reporting.
	 * @private
	 * @type {string}
	 */
	_DSN: 'https://952707096a78dd7f67e360d0f95dc054@o4509770710384640.ingest.us.sentry.io/4509770715037696',

	// Maximum number of reported error keys to keep in session storage.
	_MAX_REPORTED_ERRORS: 100,

	// In-memory cache of error keys we've recorded or observed in this process.
	_reportedKeysCache: new Set(),

	// Error keys currently being reported (in-flight) by this process.
	_inFlightKeys: new Set(),

	/**
	 * Initialize the Sentry client and scope.
	 * @private
	 * @returns {boolean} True if initialization succeeded, false otherwise.
	 */
	_init: function() {
		if (this._disabled || !Foxtrick.Sentry)
			return false;

		try {
			// Early calls to _init will not have the branch string available to set the release.
			// Create a new client for each call so that later calls have release set if possible.
			const client = this._createClient();

			let scope = this._scope;
			if (!scope)
				scope = this._createScope(client);

			client.init(); // initializing has to be done after setting the client on the scope
			return true;

		} catch (e) {
			// Safely log Sentry initialization errors; nested try-catch
			// prevents logging failures from causing further exceptions or recursion
			try {
				this._disabled = true;
				console.error('ERROR: Sentry init - ' + e.message);
				console.error(e.stack);
				return false;
			} catch (e) { // eslint-disable-line
				return false;
			}
		}
	},

	/**
	 * Create and configure a new Sentry client.
	 * @private
	 * @returns {object} The Sentry client instance.
	 */
	_createClient: function() {
		const sentry = Foxtrick.Sentry;

		const branch = this._getFtBranch();
		const dsn = this._DSN;
		const environment = branch === 'dev' ? 'development' : 'production';
		let release = null;
		const version = this._getFtVersion();
		if (version) {
			if (branch !== 'dev') {
				release = `foxtrick-${branch}@${version}`;
			} else {
				// Prevent the creation of spurious releases on sentry during development.
				const majorVer = version.split('.').slice(0, -1).join('.');
				release = `foxtrick-release@${majorVer}.0`;
			}
		}

		// For web extensions Sentry recommend filtering out integrations that
		// use the global variable.
		// Also filter out BrowserSession as there is a custom implementation in Reporter.
		const integrations = sentry.getDefaultIntegrations({}).filter(
			(defaultIntegration) => {
				return !["BrowserApiErrors", "Breadcrumbs", "GlobalHandlers", "BrowserSession"].includes(
					defaultIntegration.name,
				);
			},
		);

		// keepalive currently doesn't work with firefox
		//@ts-expect-error
		const keepalive = navigator && navigator.userAgentData ? true: false;
		// content scripts send request data to background
		let transport = Foxtrick.context === 'content' ? this._makeBackgroundTransport: sentry.makeFetchTransport;

		return new sentry.BrowserClient({
			beforeSend: (event, hint) => {
				// Custom hint property to allow exceptions caught at the top
				// level to show as unhandled in Sentry reports.
				if (hint && typeof hint.level === 'string') {
					const validLevels = ["fatal", "error", "warning", "log", "info", "debug"];
					if (validLevels.includes(hint.level)) {
						event.level = hint.level;
					}
				}
				return event;
			},
			dsn,
			environment,
			integrations,
			release,
			stackParser: sentry.defaultStackParser,
			transport,
			transportOptions: {
				fetchOptions: {
					keepalive,
				}
			},
		});
	},

	/**
	 * Create and configure a new Sentry scope.
	 * @private
	 * @param {object} client Client instance to be set on scope.
	 * @returns {object} The Sentry scope instance.
	 */
	_createScope: function(client) {
		const scope = new Foxtrick.Sentry.Scope();
		this._setReportingData(scope);
		scope.setClient(client);
		this._scope = scope;
		return scope;
	},

	/**
	 * Get the Foxtrick branch name (without suffix).
	 * @private
	 * @returns {string|null} The branch name or null if unavailable.
	 */
	_getFtBranch: function() {
		return Foxtrick.branch ? Foxtrick.branch.split('-')[0] : null;
	},

	/**
	 * Get the Foxtrick version string.
	 * @private
	 * @returns {string|null} The version string or null if unavailable.
	 */
	_getFtVersion: function() {
		return Foxtrick.version ? Foxtrick.version : null;
	},

	/**
	 * Get hattrick team information.
	 * @private
	 * @returns {OwnTeamInfo|null} Team id and name, or null if unavailable.
	 */
	_getHtTeam: function() {
		return Foxtrick.modules?.Core?.TEAM ? Foxtrick.modules.Core.TEAM : null;
	},

	/**
	 * Create a Sentry transport which forwards requests from a content script
	 * to the extension background context via chrome.runtime messaging.
	 * @param {object} options Transport options provided by Sentry (may include `url`, `headers`, and `fetchOptions`).
	 * @returns {Function} A Sentry-compatible Transport created via `sentry.createTransport`.
	 */
	_makeBackgroundTransport: function(options) {
		const sentry = Foxtrick.Sentry;

		const makeRequest = function(request) {
			return new Promise((resolve, reject) => {
				if (!request)
					return reject(new Error('no request'));

				try {
					// use values from the transport request, fall back to outer options
					const url = request.url || options.url;
					const headers = request.headers || options.headers || {};
					const fetchOptions = request.fetchOptions || options.fetchOptions || {};
					// send body and url to background
					chrome.runtime.sendMessage({
						__ft_sentry_send: true,
						url,
						body: request.body,
						headers,
						fetchOptions,
					}, function(response) {
						if (!response)
							return reject(new Error('no response from background'));

						if (response.error)
							return reject(new Error(response.error));

						resolve({ statusCode: response.statusCode, headers: response.headers });
					});
				} catch (e) {
					reject(e);
				}
			});
		}
		return sentry.createTransport(options, makeRequest);
	},

	/**
	 * Ensure a Sentry session exists on the scope, creating one if needed.
	 * @private
	 * @param {object} scope The Sentry scope.
	 * @returns {object} The Sentry session instance.
	 */
	_makeSession: function(scope) {
		let session = scope.getSession();
		if (!session) {
			const { userAgent } = navigator || {};
			session = Foxtrick.Sentry.makeSession({
				user: scope.getUser(),
				ignoreDuration: true,
				...(userAgent && { userAgent }),
			});
			scope.setSession(session);
		}
		return session;
	},

	/**
	 * Set session, user and tag data on the Sentry scope for reporting context.
	 * @private
	 * @param {object} scope The Sentry scope to set data on.
	 */
	_setReportingData: function(scope) {
		this._makeSession(scope);

		// Set Sentry user context
		try {
			if (document && Foxtrick.Pages.All.isLoggedIn(document)) {
				const {userId, userName} = Foxtrick.Pages.All.getUser(document);
				scope.setUser({
					id: userId,
					username: userName,
				});
			}
		} catch (e) { // eslint-disable-line no-unused-vars
			// We can still report without a user set.
		}

		/**
		 * Array of tag descriptor objects specifying how each tag is set.
		 * @type {Array<ReporterTagDescriptor>}
		 */
		const tagDescriptors = [
			{ name: 'arch', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.arch
			},
			{ name: 'branch', prefix: 'ft', needsDoc: false,
				getValue: () => this._getFtBranch()
			},
			{ name: 'context', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.context
			},
			{ name: 'platform', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.platform
			},
			{ name: 'version', prefix: 'ft', needsDoc: false,
				getValue: () => this._getFtVersion()
			},
			{ name: 'classic', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.Pages?.All?.isClassic ? Foxtrick.Pages.All.isClassic(document).toString() : null
			},
			{ name: 'country', prefix: 'ht', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htCountry') : null
			},
			{ name: 'currency', prefix: 'ht', needsDoc: true,
				getValue: () => (this._getHtTeam() && Foxtrick.Prefs) ? Foxtrick.Prefs.getString('Currency.Code.' + this._getHtTeam().teamId) : null
			},
			{ name: 'dateFormat', prefix: 'ht', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htDateFormat') : null
			},
			{ name: 'language', prefix: 'ht', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htLanguage') : null
			},
			{ name: 'legacy', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.Pages?.All?.isLegacy ? Foxtrick.Pages.All.isLegacy(document).toString() : null
			},
			{ name: 'stage', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.isStage ? Foxtrick.isStage(document).toString() : null
			},
			{ name: 'teamId', prefix: 'ht', needsDoc: true,
				getValue: () => this._getHtTeam() ? (this._getHtTeam().teamId ? String(this._getHtTeam().teamId) : null) : null
			},
			{ name: 'teamName', prefix: 'ht', needsDoc: true,
				getValue: () => this._getHtTeam() ? this._getHtTeam().teamName : null
			},
			{ name: 'textDirection', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.util?.layout?.isRtl ? (Foxtrick.util.layout.isRtl(document) ? 'RTL' : 'LTR') : null
			},
			{ name: 'theme', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.util?.layout?.isStandard ? (Foxtrick.util.layout.isStandard(document) ? 'standard' : 'simple') : null
			},
			{ name: 'timezone', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.util.time.getHtTimezone ? Foxtrick.util.time.getHtTimezone(document) : null
			},
		];

		const tags = {};
		for (const desc of tagDescriptors) {
			if (desc.needsDoc && !document) continue;
			let value;
			try {
				value = desc.getValue();
			} catch (e) { // eslint-disable-line no-unused-vars
				value = null;
			}
			const key = desc.prefix ? `${desc.prefix}.${desc.name}` : desc.name;
			tags[key] = value;
		}

		scope.setTags(tags);
	},

	/**
	 * Record a reported error key.
	 * Updates the in-memory cache and persists the key to session storage.
	 *
	 * Enforces max session cache size configured by `_MAX_REPORTED_ERRORS`.
	 * @private
	 * @param {string} key Error key.
	 * @returns {Promise<void>} Resolves when persistence completes.
	 */
	_addReportedError: async function(key) {
		// Update in-memory cache immediately to prevent concurrent reporting
		this._reportedKeysCache.add(key);

		let list = await this._getReportedErrors();
		if (!list.includes(key)) {
			list.push(key);
			if (list.length > this._MAX_REPORTED_ERRORS)
				list = list.slice(list.length - this._MAX_REPORTED_ERRORS);
			await this._setReportedErrors(list);
		}
	},


	/**
	 * Check whether a normalized error key has already been reported in this session.
	 * @private
	 * @param {string} key Error key.
	 * @returns {Promise<boolean>}
	 */
	_alreadyReported: async function(key) {
		// Fast path: if we've seen this key in-memory, avoid async session access.
		if (this._reportedKeysCache.has(key))
			return true;

		// Otherwise load from session storage and update in-memory cache.
		const reportedErrors = await this._getReportedErrors();
		if (reportedErrors.includes(key)) {
			this._reportedKeysCache.add(key);
			return true;
		}
		return false;
	},

	/**
	 * Retrieve the reported-errors list from session storage.
	 * @returns {Promise<Array<string>>} Array of normalized error keys.
	 */
	_getReportedErrors: async function() {
		const list = await Foxtrick.session.get('Reporter.errorList');
		return Array.isArray(list) ? list : [];
	},


	/**
	 * Synchronously reserve a key for reporting in this process to avoid duplicate concurrent reports.
	 * @private
	 * @param {string} key Error key.
	 * @returns {boolean} True if reservation succeeded, false if another Reporter owns it.
	 */
	_lockReporting: function(key) {
		if (this._reportedKeysCache.has(key) || this._inFlightKeys.has(key))
			return false;

		this._inFlightKeys.add(key);
		return true;
	},

	/**
	 * Produce a short, stable key for an error by hashing its name, message
	 * and stack.
	 * @param {Error|*} error The error to normalize.
	 * @returns {string} 8-character hex key representing the error.
	 */
	_normalizeErrorKey: function(error) {
		// Create a short, stable hash for the error using its name, message and stack.
		try {
			if (!error) return String(error);
			const name = error && error.name ? String(error.name) : '';
			const message = error && error.message ? String(error.message) : '';
			const stack = error && error.stack ? String(error.stack) : '';

			// Build a metadata string and truncate to avoid hashing huge blobs.
			const MAX_CHARS = 1024;
			let meta = `${name}|${message}|${stack}`;
			if (meta.length > MAX_CHARS)
				meta = meta.slice(0, MAX_CHARS);

			// Small DJB2 hash producing an 8-char hex string.
			const hashString = function(s) {
				let h = 5381;
				for (let i = 0; i < s.length; i++) {
					h = ((h << 5) + h) + s.charCodeAt(i);
					// keep to 32-bit int
					h = h & 0xFFFFFFFF;
				}
				return ('00000000' + (h >>> 0).toString(16)).slice(-8);
			};

			return hashString(meta);
		} catch {
			return String(error);
		}
	},

	/**
	 * Persist the reported-errors list to session storage.
	 * @param {Array<string>} list Array of normalized error keys to store.
	 * @returns {Promise<any>} The underlying session.set promise.
	 */
	_setReportedErrors: async function(list) {
		return Foxtrick.session.set('Reporter.errorList', list);
	},


	/**
	 * Release a previously reserved in-flight reporting key for this process.
	 * Safe to call even if the key was not reserved.
	 * @private
	 * @param {string} key Error key.
	 */
	_unlockReporting: function(key) {
			this._inFlightKeys.delete(key);
	},

	/**
	 * Report an exception to Sentry.
	 *
	 * Each error is only reported once per session.
	 * @param {Error} error The error/exception to report.
	 * @param {ReporterEventOptions} hint Additional Sentry hint data.
	 */
	reportException: async function(error, hint) {
		try{
			if (this._getFtBranch() === 'dev')
				return; // don't report on dev branch

			// Generate a key identifying this error to avoid duplicate reports.
			const key = this._normalizeErrorKey(error);

			if (!this._lockReporting(key))
				return; // already being handled by another instance of Reporter

			try {
				if (await this._alreadyReported(key))
					return;

				if (!this._init())
					return;

				const scope = this._scope;
				this._setReportingData(scope);
				scope.captureException(error, hint);
				console.log('Foxtrick error report sent.');
				await this._addReportedError(key);
			} finally {
				this._unlockReporting(key);
			}
		} catch (e) {
			// avoid re-triggering report
			try {
				if (typeof console.error !== 'undefined')
					console.error(e.stack);
				else if (typeof console.log !== 'undefined')
					console.log(e.stack);
				else if (typeof console.trace !== 'undefined')
					console.trace();
			} catch {
				// nothing more we can do
			}
		}
	},

	/**
	 *  Report a message to Sentry.
	 * @param {string} message The message to report.
	 * @param {ReporterEventOptions} hint Additional Sentry hint data.
	 */
	reportMessage: function(message, hint) {
		if (!this._init())
			return;

		const scope = this._scope;
		this._setReportingData(scope);
		scope.setTag('ft.referenceId', hint.referenceId);
		scope.captureMessage(message, 'debug', hint);
	},

	/**
	 * Send a browser session event to Sentry.
	 */
	sendSession: function() {
		if (this._getFtBranch() === 'dev')
			return; // don't report on dev branch;

		if (!this._init())
			return;

		const scope = this._scope;
		this._setReportingData(scope);
		scope.getClient().captureSession(scope.getSession());
	},
};

(function() {
	if (Foxtrick.context === 'background') {
		chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
			if (msg && msg.__ft_sentry_send) {
				// Reconstruct body as Uint8Array if it arrived as a plain object representing bytes.
				let bodyToSend = msg.body;
				try {
					if (bodyToSend && typeof bodyToSend === 'object' &&
							!ArrayBuffer.isView(bodyToSend) && !(bodyToSend instanceof ArrayBuffer)) {
						const keys = Object.keys(bodyToSend);
						const len = keys.length;
						// safety cap (10 MiB) to avoid allocating huge blobs unexpectedly
						const MAX_LEN = 10 * 1024 * 1024;
						if (len > MAX_LEN) {
							console.warn('Foxtrick Reporter: sentry message body too large, skipping reconstruction', len);
						} else {
							const uint8 = new Uint8Array(len);
							for (const k of keys) {
								const idx = Number(k);
								const v = bodyToSend[k];
								uint8[idx] = typeof v === 'number' ? v : Number(v) || 0;
							}
							bodyToSend = uint8;
						}
					}
				} catch (e) { // eslint-disable-line no-unused-vars
					// if reconstruction fails, fall back to original msg.body
					bodyToSend = msg.body;
				}

				// Dispatch to sentry.
				fetch(msg.url, {
					method: 'POST',
					body: bodyToSend,
					headers: msg.headers,
					...msg.fetchOptions,
				}).then(r => {
					sendResponse({
						statusCode: r.status,
						headers: {
						'x-sentry-rate-limits': r.headers.get('X-Sentry-Rate-Limits'),
						'retry-after': r.headers.get('Retry-After')
						}
					});
				}).catch(e => {
					sendResponse({ error: String(e) });
				});
				return true;
			}
		});
	}
})();

/**
 * Report a bug to remote logging server, attaching debug log and prefs.
 * @param {string} bug The debug log contents.
 * @param {string} prefs The prefs contents.
 * @param {function(string):void} [refIdCb] Optional callback to receive the reference ID.
 */
Foxtrick.reportBug = function(bug, prefs, refIdCb) {
	const reporter = Foxtrick.log.Reporter;
	if (!reporter)
		return;

	/**
	 * Truncates a string to the last `length` KiB.
	 *
	 * @param {string} input The string to truncate.
	 * @param {number} length The maximum length in KiB.
	 * @returns {string} The truncated string.
	 */
	const truncateString = function(input, length) {
		const MAX = 1024 * length;
		return input.length > MAX ? input.slice(input.length - MAX) : input;
	}

	const MAX_LENGTH = 50; // KiB
	const referenceId = Math.floor((1 + Math.random()) * 0x10000000000).toString(16).slice(1);
	const reportOptions = {
		attachments: [
			{
				filename: 'debuglog.txt',
				data: truncateString(bug, MAX_LENGTH),
			},
			{
				filename: 'prefs.txt',
				data: truncateString(prefs, MAX_LENGTH),
			},
		],
		referenceId,
	}

	reporter.reportMessage('Bug report - ' + referenceId, reportOptions);

	refIdCb && refIdCb(referenceId);
};

/**
 * Report an error to remote logging server.
 * @param {Error} err The error to report.
 * @param {object} [options] Optional reporting options.
 * @param {ReporterEventLevel} [options.level] The level of the event logged by Reporter.
 */
Foxtrick.reportError = function(err, options) {
	try {
		const reporter = Foxtrick.log.Reporter;
		if (!reporter)
			return;

		let reportOptions;
		if (options) {
			reportOptions = {
				level: options.level,
			};
		}

		reporter.reportException(err, reportOptions);
	} catch (e) {
		try {
			if (typeof console.error !== 'undefined')
				console.error(e.stack);
			else if (typeof console.log !== 'undefined')
				console.log(e.stack);
			else if (typeof console.trace !== 'undefined')
				console.trace();
		} catch {
			// nothing more we can do
		}
	}
};

/**
 * @typedef {object} ReporterTagDescriptor
 * @property {string} name The tag name (e.g. 'arch', 'classic').
 * @property {string} prefix The tag prefix (e.g. 'ft', 'ht', or '').
 * @property {boolean} needsDoc True if tag requires document context.
 * @property {function(): (string|null)} getValue Function to retrieve the tag value.
 */

/**
 * @typedef {object} ReporterEventOptions
 * Options for reporting events, including all Sentry hint properties.
 * @property {ReporterEventLevel} [level] The event level for Sentry reporting (custom property).
 * @property {string} [referenceId] Optional reference ID for correlating events (custom property).
 * @property {Array<object>} [attachments] Optional array of attachments for the event.
 * @property {*} [originalException] The original exception object, if available.
 * @property {*} [syntheticException] A synthetic exception object, if available.
 * @property {object} [extra] Additional arbitrary data for Sentry.
 * @property {string} [event_id] The unique event ID assigned by Sentry.
 * @property {string} [transaction] The transaction name for performance events.
 * @property {string} [type] The type of event (e.g., 'error', 'message').
 * @property {string} [message] The message associated with the event.
 * @property {object} [user] User context for the event.
 * @property {object} [tags] Key-value pairs for custom tags.
 * @property {object} [contexts] Additional context objects (e.g., OS, device).
 * @property {object} [breadcrumbs] Array of breadcrumb objects for event history.
 * @property {object} [request] HTTP request information, if relevant.
 * @property {object} [response] HTTP response information, if relevant.
 * @property {object} [environment] Environment information (e.g., browser, OS).
 * @property {object} [release] Release information for the event.
 * @property {object} [platform] Platform information for the event.
 * @property {object} [logger] Logger information for the event.
 * @property {object} [modules] Module versions loaded in the environment.
 * @property {object} [server_name] Server name, if relevant.
 * @property {object} [timestamp] Timestamp of the event.
 * @property {object} [debug_meta] Debug metadata for source maps, etc.
 */

/**
 * @typedef {('fatal'|'error'|'warning'|'log'|'info'|'debug')} ReporterEventLevel
 * Possible string values for a Sentry event level.
 */
