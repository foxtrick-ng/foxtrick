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
		const environment = branch === 'dev' ? 'development' : null;
		// keepalive currently doesn't work with firefox
		//@ts-expect-error
		const keepalive = navigator && navigator.userAgentData ? true: false;

		let release = null;
		const version = this._getFtVersion();
		if (version) {
			if (branch !== 'dev') {
				release = `foxtrick-${branch}@${Foxtrick.version}`;
			} else {
				// Prevent the creation of spurious releases on sentry during development.
				const majorVer = Foxtrick.version.split('.').slice(0, -1).join('.');
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
			transport: sentry.makeFetchTransport,
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
			{ name: 'currency', prefix: 'ft', needsDoc: true,
				getValue: () => (this._getHtTeam() && Foxtrick.Prefs) ? Foxtrick.Prefs.getString('Currency.Code.' + this._getHtTeam().teamId) : null
			},
			{ name: 'htCountry', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htCountry') : null
			},
			{ name: 'htDateFormat', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htDateFormat') : null
			},
			{ name: 'htLanguage', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.Prefs ? Foxtrick.Prefs.getString('htLanguage') : null
			},
			{ name: 'platform', prefix: 'ft', needsDoc: false,
				getValue: () => Foxtrick.platform
			},
			{ name: 'teamId', prefix: 'ft', needsDoc: true,
				getValue: () => this._getHtTeam() ? (this._getHtTeam().teamId ? String(this._getHtTeam().teamId) : null) : null
			},
			{ name: 'teamName', prefix: 'ft', needsDoc: true,
				getValue: () => this._getHtTeam() ? this._getHtTeam().teamName : null
			},
			{ name: 'version', prefix: 'ft', needsDoc: false,
				getValue: () => this._getFtVersion()
			},
			{ name: 'classic', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.Pages?.All?.isClassic ? Foxtrick.Pages.All.isClassic(document).toString() : null
			},
			{ name: 'legacy', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.Pages?.All?.isLegacy ? Foxtrick.Pages.All.isLegacy(document).toString() : null
			},
			{ name: 'stage', prefix: 'ht', needsDoc: true,
				getValue: () => Foxtrick.isStage ? Foxtrick.isStage(document).toString() : null
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
	 * Report an exception to Sentry.
	 * @param {Error} error The error/exception to report.
	 * @param {ReporterEventOptions} hint Additional Sentry hint data.
	 */
	reportException: function(error, hint) {
		if (!this._init())
			return;

		const scope = this._scope;
		this._setReportingData(scope);
		scope.captureException(error, hint);
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
		if (!this._init())
			return;

		if (this._getFtBranch() === 'dev')
			return; // don't report on dev branch;

		const scope = this._scope;
		this._setReportingData(scope);
		scope.getClient().captureSession(scope.getSession());
	},
};

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

	const MAX_LENGTH = 50;
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

		if (Foxtrick.branch?.split('-')[0] === 'dev')
			return; // don't report on dev branch;

		let reportOptions;
		if (options) {
			reportOptions = {
				level: options.level,
			};
		}

		reporter.reportException(err, reportOptions);
		console.log('Foxtrick bug report sent.');
	} catch (e) {
		try {
			if (typeof console.error !== 'undefined')
				console.error(e.stack);
			else if (typeof console.log !== 'undefined')
				console.log(e.stack);
			else if (typeof console.trace !== 'undefined')
				console.trace();
		} catch (e) { // eslint-disable-line no-unused-vars
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
