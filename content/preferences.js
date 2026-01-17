'use strict';

/**
 * Foxtrick preferences
 *
 * @author ryanli, convincedd, LA-MJ, CatzHoek
 */


// page IDs of last page are stored in array PAGEIDS
var PAGEIDS = [];

// get page IDs in Foxtrick.htPages that last page matches and store them in PAGEIDS
function getPageIds() {
	var lastUrl = new URL(Foxtrick.getLastPage());
	var lastPage = lastUrl.pathname + lastUrl.search;
	for (var p in Foxtrick.htPages) {
		// ignore PAGE all, it's shown in universal tab
		if (p === 'all')
			continue;

		if (Foxtrick.isPageHref(lastPage, Foxtrick.htPages[p]))
			PAGEIDS.push(p);
	}
}

// used to cache the searchable module items to prevent the search functionality
// from traversing the DOM all the time
var MODULES = {};

/**
 * Show message box
 *
 * @param {string} msg
 */
function notice(msg) {
	var noteContent = document.getElementById('note-content');
	var note = document.getElementById('note');
	if (noteContent)
		noteContent.textContent = msg;
	if (note) {
		note.style.display = 'block';
		note.style.transition = 'opacity 0.3s ease';
		note.style.opacity = '1';
	}
}

function baseURI() {
	return window.location.href.replace(/#.*$/, '');
}

/**
 * Generate a hash URI to an object.
 *
 * opts is {tab, module, id, search: string}, choose one.
 *
 * @param  {object} opts {tab, module, id, search: string}
 * @return {string}
 */
function generateURI(opts) {
	var location = baseURI();
	if (opts.tab)
		return location + '#tab=' + opts.tab;
	else if (opts.module)
		return location + '#module=' + opts.module;
	else if (opts.id)
		return location + '#' + opts.id;
	else if (opts.search)
		return location + '#search=' + opts.search;
}

/**
 * Index modules and other headers for search
 */
function initSearch() {
	var searchAdd = function(searchStr, item) {
		if (Array.isArray(MODULES[searchStr])) {
			MODULES[searchStr].push(item);
		}
		else if (typeof MODULES[searchStr] === 'object') {
			MODULES[searchStr] = [MODULES[searchStr], item];
		}
		else
			MODULES[searchStr] = item;
	};

	var modules = document.querySelectorAll('.module');
	modules.forEach(function(module) {
		try {
			var header;
			var name = module.id;
			var saveName;

			var prefRe = /^pref-/;
			if (name && prefRe.test(name)) {
				saveName = name.replace(/^pref-/, '');
				searchAdd(saveName, module);
			}
			else if (name) {
				header = module.querySelector('h3, h2');
				saveName = header.textContent.replace('¶', '').trim();
				searchAdd(saveName, module);

				var faqLink = header.querySelector('a');
				if (faqLink) {
					saveName = faqLink.href;
					searchAdd(saveName, module);
				}
			}
			else {
				header = module.querySelector('h3, h2');
				if (header && header.dataset.text) {
					name = Foxtrick.L10n.getString(header.dataset.text);
					searchAdd(name, module);
					searchAdd(header.dataset.text, module);
				}
				else {
					Foxtrick.log('no search support, missing header and/or data-text:', module);
				}
			}
		}
		catch (e) {
			Foxtrick.log('no search support', e);
		}
	});
}

/**
 * Reflow content to show only matching search results.
 *
 * isModule is used for breadcrumb URL generation.
 *
 * @param {string}  needle
 * @param {boolean} [isModule]
 */
function search(needle, isModule) {

	// iterate pre-cached modules
	var showModules = function(visibilityPredicate) {
		var shown = new Set();
		for (var m in MODULES) {
			var doShow = visibilityPredicate(m);
			var memo = MODULES[m];
			if (Array.isArray(memo)) {
				for (var module of memo) {
					if (doShow) {
						Foxtrick.removeClass(module, 'hidden');
						shown.add(module);
					}
					else if (!shown.has(module)) {
						// only hide if not shown in a previous iteration
						Foxtrick.addClass(module, 'hidden');
					}
				}
			}
			else {
				if (doShow) {
					Foxtrick.removeClass(memo, 'hidden');
					shown.add(memo);
				}
				else if (!shown.has(memo)) {
					// only hide if not shown in a previous iteration
					Foxtrick.addClass(memo, 'hidden');
				}
			}
		}
	};

	var breadcrumb2 = document.getElementById('breadcrumb-2');
	var breadcrumb3 = document.getElementById('breadcrumb-3');
	var breadcrumbSep1 = document.getElementById('breadcrumb-sep-1');
	var breadcrumbSep2 = document.getElementById('breadcrumb-sep-2');

	if (needle.length > 0) {
		if (breadcrumb2) {
			breadcrumb2.style.display = '';
			breadcrumb2.textContent = needle;
			var opt = isModule ? { module: needle } : { search: needle };
			breadcrumb2.href = generateURI(opt);
		}
		if (breadcrumbSep1)
			breadcrumbSep1.style.display = '';

		// README: needle not escaped => supports RegExp
		// consider escaping
		var regex = new RegExp(needle, 'i');

		// show matching
		showModules(function(name) { return regex.test(name); });
	}
	else {
		if (breadcrumb2)
			breadcrumb2.style.display = 'none';
		if (breadcrumb3)
			breadcrumb3.style.display = 'none';
		if (breadcrumbSep1)
			breadcrumbSep1.style.display = 'none';
		if (breadcrumbSep2)
			breadcrumbSep2.style.display = 'none';

		// show all
		showModules(function() { return true; });
	}
}

/**
 * Parse hash fragment into options: {tab, module, id, search: string}.
 *
 * TODO replace with URLSearchParams
 *
 * @param  {string} fragment
 * @return {object}          {tab, module, id, search: string}
 */
function parseFragment(fragment) {
	var pairs = (fragment ? fragment.toString() : '').split(/&/);

	// key - value pairs use ampersand (&) as delimiter
	var ret = {};
	for (var pair of pairs) {
		var param = pair.split(/=/); // key and value are separated by equal sign (=)
		if (param.length == 2)
			ret[decodeURIComponent(param[0])] = decodeURIComponent(param[1]);
	}
	return ret;
}

/**
 * Reflow content according to hash fragment
 *
 * @param {string} uri
 */
function locateFragment(uri) {
	// show functions
	var showTab = function(tab) {
		// if (Foxtrick.Prefs.isModuleEnabled('MobileEnhancements')) {
		// 	// mobile
		// 	document.getElementById('navigation-header').textContent =
		// 		Foxtrick.L10n.getString('tab.' + tab);
		// }

		var breadcrumb1 = document.getElementById('breadcrumb-1');
		if (breadcrumb1) {
			breadcrumb1.textContent = Foxtrick.L10n.getString('tab.' + tab);
			breadcrumb1.href = generateURI({ tab: tab });
		}

		search('', true); // search reset

		var paneDivs = document.querySelectorAll('#pane > div');
		paneDivs.forEach(function(div) {
			div.style.display = 'none';
		});

		var tabsLi = document.querySelectorAll('.tabs > li');
		tabsLi.forEach(function(li) {
			li.classList.remove('active');
		});

		var activeTab = document.getElementById('tab-' + tab);
		if (activeTab)
			activeTab.classList.add('active');

		var visiblePanes = document.querySelectorAll('#pane > div[x-on*="' + tab + '"]');
		visiblePanes.forEach(function(pane) {
			pane.style.display = '';
		});
	};

	var showFaq = function(id) {
		showTab('help');

		var div = document.getElementById('faq-' + id);
		if (div)
			div.scrollIntoView(true);
	};

	var showModule = function(module) {
		var moduleEl = document.getElementById('pref-' + (module ? String(module) : ''));
		var category = moduleEl ? moduleEl.getAttribute('x-category') : null;
		showTab(category || 'search');
		search(module, true); // direct search

		if (moduleEl) {
			moduleEl.scrollIntoView(true);
		}
	};

	// only keep the fragment of URI
	var fragment = /#/.test(uri) ? uri.replace(/^.*#/, '') : '';
	var param = parseFragment(fragment);

	if (param.module)
		showModule(param.module);
	else if (param.tab)
		showTab(param.tab);
	else if (param.search) {
		showTab('search');
		search(param.search);
	}
	else if (param.faq)
		showFaq(param.faq);
	else {
		showTab('main'); // show the main tab by default
	}

	// if (Foxtrick.Prefs.isModuleEnabled('MobileEnhancements')) {
	// 	// mobile
	// 	$('.tabs').hide();
	// 	$('#main').show();
	// }
}

/**
 * Search input event handler
 *
 * TODO: improve to batch and throttle 'requests' asynchronously
 *
 * @param {Event} ev
 */
function searchEvent(ev) {
	if (ev.target.value.length < 4)
		return;

	var here = window.location.href;
	var there = generateURI({ tab: 'search' });
	if (here !== there) {
		window.location.href = there;
		locateFragment(there);
	}

	search(encodeURIComponent(ev.target.value));
	var jsTop = document.getElementById('js-top');
	if (jsTop)
		jsTop.scrollIntoView();
}

// Permissions Management

// TODO: extract and improve

// Check if permissions are granted in init and ask for permission if needed on saving
// that's unsave since we don't check permissions right before asking for them
// but since permission request must be in the click handler and not in a callback.
// This seems to be the only way.

// Should move/get that to the resp. modules
var neededPermissions = [
	{
		modules: ['ExtraShortcuts.No9'],
		types: { origins: ['http://no9-online.de/*'] },
	},
	{
		modules: ['ExtraShortcuts.Latehome'],
		types: { origins: ['http://www.latehome.de/*'] },
	},
	{
		modules: ['EmbedMedia.EmbedModeOEmebed'],
		types: {
			origins: [
				'https://vimeo.com/api/*',
				'https://www.youtube.com/*',
				'https://www.dailymotion.com/services/*',
			],
		},
	},
	{
		modules: ['EmbedMedia.EmbedFlickrImages'],
		types: { origins: ['https://secure.flickr.com/services/oembed/*'] },
	},
	{
		modules: ['EmbedMedia.EmbedDeviantArtImages'],
		types: { origins: ['http://backend.deviantart.com/*'] },
	},
	{
		modules: ['EmbedMedia.EmbedSoundCloud'],
		types: { origins: ['https://soundcloud.com/*'] },
	},
	{
		modules: ['EmbedMedia.EmbedImageshack'],
		types: { origins: ['https://imageshack.us/*'] },
	},
	{
		modules: ['CopyYouth.AutoSendTrainingReportToHY'],
		types: { origins: ['https://*.hattrick-youthclub.org/*'] },
	},
	{
		modules: ['CopyYouth.AutoSendRejectedToHY'],
		types: { origins: ['https://*.hattrick-youthclub.org/*'] },
	},
	{
		modules: ['CopyYouth.AutoSendTrainingChangesToHY'],
		types: { origins: ['https://*.hattrick-youthclub.org/*'] },
	},
	{
		modules: ['YouthSkills'],
		types: { origins: ['https://*.hattrick-youthclub.org/*'] },
	},
	{
		modules: ['MatchWeather'],
		types: { origins: ['http://api.openweathermap.org/*'] },
	},
	{
		modules: ['Reporter.reportBug', 'Reporter.reportError', 'Reporter.sendSession'],
		types: { origins: ['https://*.sentry.io/*'] }
	},
];

/**
 * Convert module/option into element ID
 *
 * @param  {string} option
 * @return {string}
 */
function getElementIdFromOption(option) {
	var id = '#pref-' + option;

	var re = /\./g;
	if (!re.test(id))
		id = id + '-check'; // main module check
	else
		id = id.replace(re, '-'); // sub-option check

	return id;
}

/**
 * Request optional permissions.
 *
 * needed is {types: { permissions, origins: array}, modules: array}.
 *
 * showSaved: optionally show success message
 *
 * @param {object}  needed
 * @param {boolean} showSaved
 */
function getPermission(needed, showSaved) {
	// Permissions must be requested from inside a user gesture, like a button's click handler.
	chrome.permissions.request(needed.types, function(granted) {
		// The callback argument will be true if the user granted the permissions.
		for (var module of needed.modules) {
			var id = getElementIdFromOption(module);
			var el = document.querySelector(id);
			if (!granted) {
				if (el)
					el.checked = false;
				var pref = 'module.' + module + '.enabled';
				Foxtrick.Prefs.setBool(pref, false);
				Foxtrick.log('Permission declined:', module);
			}
			else {
				if (el)
					el.setAttribute('permission-granted', 'true');
				Foxtrick.log('Permission granted:', module);
			}
			if (showSaved) {
				notice(Foxtrick.L10n.getString('prefs.feedback.saved'));
			}
		}
	});
}

/**
 * Check whether optional permissions are required and ask for them if needed
 *
 * returns true if needed
 *
 * @return {boolean} isNeeded
 */
function checkPermissions() {
	var needsPermissions = false;

	if (Foxtrick.platform === 'Chrome') {
		// combine all need permissions into on request
		var combined = {
			modules: [],
			types: { permissions: [], origins: [] },
		};

		neededPermissions.forEach(function(needed) {
			needed.modules.forEach(function(module, m, modules) { // jshint ignore:line
				var id = getElementIdFromOption(module);
				var el = document.querySelector(id);
				if (!Foxtrick.Prefs.getBool('module.' + module + '.enabled') ||
				    (el && el.getAttribute('permission-granted') === 'true'))
					return;

				needsPermissions = true;
				Foxtrick.pushNew(combined.modules, modules);

				if (needed.types.permissions)
					Foxtrick.pushNew(combined.types.permissions, needed.types.permissions);

				if (needed.types.origins)
					Foxtrick.pushNew(combined.types.origins, needed.types.origins);
			});
		});

		getPermission(combined, true);
	}

	// returning true prevents save notice from being shown
	// will be shown asynchronously in getPermission
	return needsPermissions;
}

/**
 * Revoke all permissions.
 *
 * TODO: test/fix/improve
 */
function revokePermissions() {

	if (Foxtrick.platform !== 'Chrome' || !('permissions' in chrome))
	    return;

	var revokeModulePermission = function(needed) {
		chrome.permissions.remove(needed.types, function(result) {
			for (var module of needed.modules) {
				var id = getElementIdFromOption(module);
				var el = document.querySelector(id);
				if (el)
					el.setAttribute('permission-granted', 'false');
				Foxtrick.log('Permission removed:', module, result);
			}
		});
	};
	if (Foxtrick.platform === 'Chrome') {
		for (var permission of neededPermissions) {
			revokeModulePermission(permission);
		}
	}
}

/**
 * Initialize elements which need permissions, show notice if permissions are missing
 *
 * TODO: test/fix/improve
 */
function testPermissions() {
	if (Foxtrick.platform !== 'Chrome' || !('permissions' in chrome))
		return;

	var modules = [];

	var updateAlertDisplay = function() {
		var alertEl = document.getElementById('alert');
		var alertText = document.getElementById('alert-text');
		var breadcrumbs = document.getElementById('breadcrumbs');

		if (modules.length > 0) {
			var strong = document.createElement('strong');
			strong.textContent = Foxtrick.L10n.getString('prefs.needPermissions');

			var ul = document.createElement('ul');
			modules.forEach(function(mod) {
				var li = document.createElement('li');
				li.textContent = mod;
				ul.appendChild(li);
			});

			if (alertText) {
				alertText.textContent = '';
				alertText.appendChild(strong);
				alertText.appendChild(ul);
			}

			if (alertEl)
				alertEl.classList.remove('hidden');
			if (breadcrumbs)
				breadcrumbs.classList.add('hidden');
		}
		else {
			if (alertText)
				alertText.textContent = '';
			if (alertEl)
				alertEl.classList.add('hidden');
		}
	};

	var checkPermission = function(id, neededPermission, module) {
		var el = document.querySelector(id);
		if (!el)
			return;

		if (el.checked && el.getAttribute('permission-granted') === 'false')
			getPermission(neededPermission);
		else if (!el.checked) {
			modules = Foxtrick.exclude(modules, module);
			updateAlertDisplay();
		}
	};

	var makeChecker = function(id, perm, module) {
		return function() {
			checkPermission(id, perm, module);
		};
	};

	var testModulePermission = function(needed) {
		chrome.permissions.contains(needed.types, function(result) {
			needed.granted = result;

			for (var module of needed.modules) {
				var id = getElementIdFromOption(module);
				var el = document.querySelector(id);
				if (!el)
					continue;

				el.setAttribute('permission-granted', String(result));
				el.addEventListener('click', makeChecker(id, needed, module));

				if (result === false &&
				    Foxtrick.Prefs.getBool('module.' + module + '.enabled')) {

					Foxtrick.pushNew(modules, needed.modules);
					updateAlertDisplay();
				}
			}
		});
	};

	for (var permission of neededPermissions) {
		testModulePermission(permission);
	}
}

/**
 * Handle save event.
 *
 * Saves the current state of all options.
 *
 * @param {Event} ev
 */
function saveEvent(ev) {
	Foxtrick.log('save');

	var pref;

	var target = ev.target;
	var prefAttr = target.getAttribute('pref');
	if (prefAttr) {
		pref = prefAttr;

		if (target.type === 'checkbox')
			Foxtrick.Prefs.setBool(pref, target.checked);
		else if (target.nodeName.toLowerCase() === 'select') {
			// calculated just-in-time, so getAttribute('value') would fail here
			Foxtrick.Prefs.setString(pref, target.value);
		}
		else if (target.matches('input, textarea'))
			Foxtrick.Prefs.setString(pref, target.value);
	}
	else if (target.nodeName.toLowerCase() === 'option') {
		pref = target.parentElement.getAttribute('pref');
		var value = target.value;
		Foxtrick.Prefs.setString(pref, value);
	}
	else {
		var module = target.getAttribute('module');
		if (target.getAttribute('option')) {
			Foxtrick.log('option of module');
			var option = target.getAttribute('option');

			pref = module + '.' + option;
			if (target.type === 'checkbox')
				Foxtrick.Prefs.setModuleEnableState(pref, target.checked);
			else if (target.matches('input, textarea'))
				Foxtrick.Prefs.setModuleOptionsText(pref, target.value);
		}
		else if (target.type === 'radio') {
			if (target.checked)
				Foxtrick.Prefs.setModuleValue(module, target.value);
		}
		else {
			Foxtrick.Prefs.setModuleEnableState(module, target.checked);
			Foxtrick.log('setModuleEnableState');
		}
	}
	Foxtrick.Prefs.setBool('preferences.updated', true);
}

/**
 * Save button clicked.
 *
 * TODO: unused, remove?
 */
function save() {
	var needsPermissions = checkPermissions();

	// shown save notice only if no permissions needed
	// otherwise triggered in permission request callback
	if (!needsPermissions)
		notice(Foxtrick.L10n.getString('prefs.feedback.saved'));

	Foxtrick.Prefs.setBool('preferences.updated', true);
}

/**
 * Parse and add a note containing white-listed HTML markup
 * and custom, predefined linkTags.
 *
 * @param {string}  note   Raw note to be parsed.
 * @param {Element} parent Element to add the note to.
 * @param {object}  links  A map of custom linkTags and their corresponding URLs.
 */
function addNote(note, parent, links) {
	/**
	 * Create a white-listed tag or fall back to createLink
	 * @param  {string}  tagName    Name of the tag or link
	 * @param  {string}  tagContent Text content of the tag. May be recursive
	 * @return {Element}            Element created
	 */
	var createTag = function(tagName, tagContent) {
		/**
		 * Create specific DOM elements.
		 * This should be called for white-listed elements only.
		 *
		 * @param  {string}  nodeName    Name of the element to create.
		 * @param  {string}  textContent Text content of the element.
		 * @param  {object}  options     Map of properties and values of the element.
		 * @return {Element}             Element created.
		 */
		var createNode = function(nodeName, textContent, options) {
			var node = document.createElement(nodeName);
			if (textContent !== null)
				node.textContent = textContent;

			return Object.assign(node, options);
		};
		var createNestedNode = function(nodeName, tagContent, options) {
			var el = createNode(nodeName, null, options);
			// recursively parse and add content to nodes with nesting enabled
			addNote(tagContent, el, links);
			return el;
		};
		var createLink = function(linkName, linkText) {
			if (typeof links === 'object' && links.hasOwnProperty(linkName)) {
				if (linkName.slice(0, 6) === 'FTlink') {
					// links starting with 'FTlink'
					// are assumed to be internal
					// and open in the same tab
					return createNode('a', linkText, { href: links[linkName] });
				}
				else
					return createNode('a', linkText, { href: links[linkName], target: '_blank' });
			}
			else {
				// default to creating text nodes so no evil tags are actually rendered
				return document.createTextNode(linkText);
			}
		};
		switch (tagName) {
			// simple white-listed HTML
			case 'em':
			case 'strong':
				return createNode(tagName, tagContent);
			// custom simple tags
			case 'module':
				return createNode('a', tagContent, { href: '#module=' + tagContent });
			// white-listed tags allowed to have other tags in them
			case 'ul':
			case 'li':
			case 'p':
				return createNestedNode(tagName, tagContent);
			case 'header':
				return createNestedNode('h5', tagContent);
			default:
				// defaults to links with predefined URLs, e. g. <linkHome>
				return createLink(tagName, tagContent);
		}
	};

	if (note === '')
		return;

	// create a container to add all nodes before appending them to DOM in one go
	var noteContainer = document.createDocumentFragment();

	// tokenize into text and outer tags, nesting will be dealt with recursion
	// allow only word characters for tag names and match only properly paired tags
	// tags have no attributes and are thus safe
	var noteTokens = note.match(/<(\w+)>[\s\S]*?<\/\1>|[\s\S]+?(?=<(\w+)>[\s\S]*?<\/\2>|$)/mg);
	var tagRegex = /^<(\w+)>([\s\S]*?)<\/\1>$/m;
	noteTokens.forEach(function(token) {
		if (tagRegex.test(token)) {
			// 0: whole token, 1: tagName, 2: tagContent
			var tag = tagRegex.exec(token);
			noteContainer.appendChild(createTag(tag[1], tag[2]));
		}
		else
			noteContainer.appendChild(document.createTextNode(token));
	});
	parent.appendChild(noteContainer);
}

/**
 * Run core module init functions
 *
 * @param {boolean} reInit
 * @return {Promise<any[]>} Resolves when all core modules are initialized
 */
async function initCoreModules(reInit) {
	// add MODULE_NAME to modules
	for (var m in Foxtrick.modules)
		Foxtrick.modules[m].MODULE_NAME = m;

	// core functions needed for preferences, localization, etc.
	var coreModules = [Foxtrick.Prefs, Foxtrick.L10n, Foxtrick.XMLData];
	let corePromises = coreModules.map(core => {
			return core.init(reInit);
	});
	return Promise.all(corePromises);
}

/**
 * Add auto save listeners to all elements that require it.
 *
 * Used for custom options as well
 */
function initAutoSaveListeners() {
	var parent = document.getElementById('pane');
	if (!parent)
		return;

	var listener = function(ev) {
		var target = ev.target;

		if (target.dataset.listen === 'false')
			return;

		saveEvent(ev);
	};

	parent.addEventListener('change', function(ev) {
		var target = ev.target;
		if (target.matches('input[type="checkbox"], input[type="radio"], select')) {
			listener(ev);
		}
	});

	parent.addEventListener('input', function(ev) {
		var target = ev.target;
		if (target.matches('input, textarea')) {
			listener(ev);
		}
	});
}

/**
 * Add save, search and click listeners
 */
function initListeners() {
	initAutoSaveListeners();

	var navToggle = document.getElementById('nav-toggle');
	var navigation = document.getElementById('navigation');

	if (navToggle) {
		navToggle.addEventListener('click', function() {
			if (navigation)
				navigation.classList.toggle('hidden');
		});
	}

	if (navigation) {
		navigation.addEventListener('click', function(ev) {
			if (ev.target.matches('a')) {
				if (navToggle && navToggle.offsetWidth > 0 && navToggle.offsetHeight > 0) {
					navToggle.click();
				}

				var jsTop = document.getElementById('js-top');
				if (jsTop)
					jsTop.scrollIntoView();
			}
		});
	}

	var searchInput = document.getElementById('search-input');
	if (searchInput)
		searchInput.addEventListener('input', searchEvent);

	var saveBtn = document.getElementById('save');
	if (saveBtn) {
		saveBtn.addEventListener('click', function() {
			save();
			var alertEl = document.getElementById('alert');
			var breadcrumbs = document.getElementById('breadcrumbs');
			if (alertEl)
				alertEl.classList.add('hidden');
			if (breadcrumbs)
				breadcrumbs.classList.remove('hidden');
		});
	}

	document.body.addEventListener('click', function(ev) {
		var nodeName = ev.target.nodeName.toLowerCase();
		if (nodeName !== 'a' && nodeName !== 'xhtml:a')
			return;

		if (ev.target.href.indexOf(baseURI()) === 0 ||
		    ev.target.getAttribute('href')[0] === '#') {
			locateFragment(ev.target.href);
		}
		else if (Foxtrick.isHtUrl(ev.target.href)) {
			// we redirect Hattrick links to last Hattrick host
			var url = Foxtrick.goToUrl(ev.target.href);
			ev.target.href = url;
		}
	});
}

/**
 * Make module div container with module options and their descriptions
 *
 * @param  {object}         module
 * @return {HTMLDivElement}
 */
function makeModuleDiv(module) {
	// var getScreenshot = function(link) {
	// 	var a = document.createElement('a');
	// 	a.className = 'screenshot';
	// 	a.href = link;
	// 	a.title = Foxtrick.L10n.getString('module.screenshot');
	// 	a.setAttribute('target', '_blank');
	// 	return a;
	// };

	var entry = document.createElement('div');
	entry.id = 'pref-' + module.MODULE_NAME;
	entry.className = 'module';
	entry.setAttribute('x-category', module.MODULE_CATEGORY);

	var title = document.createElement('h3');
	title.id = entry.id + '-title';
	entry.appendChild(title);

	var container = document.createElement('div');
	container.className = 'module-content';

	var label = document.createElement('label');
	var check = document.createElement('input');
	check.id = entry.id + '-check';
	check.type = 'checkbox';

	// do not allow disabling core modules
	if (module.CORE_MODULE) {
		check.setAttribute('checked', 'checked');
		check.setAttribute('disabled', 'disabled');
	}
	else {
		check.setAttribute('module', module.MODULE_NAME);
	}

	label.appendChild(check);
	label.appendChild(document.createTextNode(module.MODULE_NAME));
	title.appendChild(label);

	// link to module
	var link = document.createElement('a');
	link.className = 'module-link';
	link.textContent = '¶';
	link.href = generateURI({ module: module.MODULE_NAME });
	link.title = Foxtrick.L10n.getString('module.link');
	title.appendChild(link);

	// screenshot
	// if (false) {
	// 	var screenshotLink = Foxtrick.L10n.getScreenshot(module.MODULE_NAME);
	// 	if (screenshotLink)
	// 		title.appendChild(getScreenshot(screenshotLink));
	// }

	var desc = document.createElement('p');
	desc.id = entry.id + '-desc';
	desc.textContent = Foxtrick.Prefs.getModuleDescription(module.MODULE_NAME);
	container.appendChild(desc);

	// options container
	var options = document.createElement('div');
	options.id = entry.id + '-options';
	options.setAttribute('depends-on', check.id);
	container.appendChild(options);

	// module-provided function for generating options. will be appended
	// OPTION_FUNC either returns an HTML object or an array of HTML objects
	// or purely initializes them and returns null
	var customOptions = [];
	if (typeof module.OPTION_FUNC == 'function') {
		var genOptions = module.OPTION_FUNC(document);
		if (genOptions) {
			if (Array.isArray(genOptions)) {
				for (var field of genOptions)
					customOptions.push(field);
			}
			else
				customOptions.push(genOptions);
		}
	}

	var item;

	// checkbox options
	if (module.OPTIONS) {
		var checkboxes = document.createElement('ul');
		options.appendChild(checkboxes);
		checkboxes.id = module.MODULE_NAME + '-checkboxes';

		var checkbox, textDiv, textInput;

		var appendOptionToList = function(key, list) {
			item = document.createElement('li');
			list.appendChild(item);

			var label = document.createElement('label');
			item.appendChild(label);

			checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = entry.id + '-' + key;
			checkbox.setAttribute('module', module.MODULE_NAME);
			checkbox.setAttribute('option', key);
			label.appendChild(checkbox);

			var desc = Foxtrick.Prefs.getModuleElementDescription(module.MODULE_NAME, key);
			label.appendChild(document.createTextNode(desc));

			// screenshot
			// if (false) { // README: disabled
			// 	var screenshotLink = Foxtrick.L10n.getScreenshot(module.MODULE_NAME + '.' + key);
			// 	if (screenshotLink)
			// 		label.appendChild(getScreenshot(screenshotLink));
			// }
		};

		var appendOptionsArrayToList = function(optionsArray, parentList) {
			for (var k = 0; k < optionsArray.length; ++k) {
				if (k == 1) {
					// first subOption, create subOption list and redirect all options to it
					item = document.createElement('li');
					parentList.appendChild(item);

					parentList = document.createElement('ul');
					parentList.id = module.MODULE_NAME + '-' + optionsArray[0] + '-checkboxes';
					parentList.setAttribute('depends-on', entry.id + '-' + optionsArray[0]);

					item.appendChild(parentList);
				}

				if (Array.isArray(optionsArray[k]))
					appendOptionsArrayToList(optionsArray[k], parentList);
				else
					appendOptionToList(optionsArray[k], parentList);
			}
		};
		var makeTextListener = function(input) {
			return function(text) {
				input.value = text;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			};
		};
		var makePlayListener = function(input) {
			return function() {
				Foxtrick.playSound(input.value);
			};
		};

		var makeDataListener = function(input, isSound) {
			return function(url) {
				input.value = url;
				input.dispatchEvent(new Event('input', { bubbles: true }));

				if (isSound)
					Foxtrick.playSound(url);
			};
		};

		for (var i = 0; i < module.OPTIONS.length; ++i) {
			// super easy way to create subgroups for options, just supply an array
			// first element will toggle visibility for entries 1->n
			// supports nested subgroups
			if (Array.isArray(module.OPTIONS[i])) {
				var parentlist = checkboxes;
				appendOptionsArrayToList(module.OPTIONS[i], parentlist);
				continue;
			}

			var key = module.OPTIONS[i];
			appendOptionToList(key, checkboxes);

			if (module.OPTION_EDITS &&
				(!module.OPTION_EDITS_DISABLED_LIST || !module.OPTION_EDITS_DISABLED_LIST[i])) {

				textDiv = document.createElement('div');
				textDiv.id = checkbox.id + '-text-div';
				textDiv.setAttribute('depends-on', checkbox.id);
				item.appendChild(textDiv);

				textInput = document.createElement('input');
				textInput.id = checkbox.id + '-text';
				textInput.setAttribute('module', module.MODULE_NAME);
				textInput.setAttribute('option', module.OPTIONS[i] + '_text');
				textDiv.appendChild(textInput);

				var load;

				if (module.OPTION_EDITS_TEXTFILE_LOAD_BUTTONS &&
				    module.OPTION_EDITS_TEXTFILE_LOAD_BUTTONS[i]) {

					var loadTextlistener = makeTextListener(textInput);
					load = Foxtrick.util.load.filePickerForText(document, loadTextlistener);
					textDiv.appendChild(load);
				}

				if (module.OPTION_EDITS_DATAURL_LOAD_BUTTONS &&
				    module.OPTION_EDITS_DATAURL_LOAD_BUTTONS[i]) {

					var isSound = module.OPTION_EDITS_DATAURL_IS_SOUND &&
						module.OPTION_EDITS_DATAURL_IS_SOUND[i];

					var loadDatalistener = makeDataListener(textInput, isSound);
					load = Foxtrick.util.load.filePickerForDataUrl(document, loadDatalistener);
					textDiv.appendChild(load);

					if (isSound) {
						var playButton = document.createElement('button');
						playButton.setAttribute('data-text', 'button.play');
						playButton.id = checkbox.id + '-playButton';
						Foxtrick.onClick(playButton, makePlayListener(textInput));
						textDiv.appendChild(playButton);
					}
				}
			}

			if (module.OPTION_TEXTS &&
				(!module.OPTION_TEXTS_DISABLED_LIST || !module.OPTION_TEXTS_DISABLED_LIST[i])) {

				textDiv = document.createElement('div');
				textDiv.id = checkbox.id + '-text-div';

				textDiv.setAttribute('depends-on', checkbox.id);
				item.appendChild(textDiv);

				textInput = document.createElement('textarea');
				textInput.id = checkbox.id + '-text';
				textInput.setAttribute('module', module.MODULE_NAME);
				textInput.setAttribute('option', module.OPTIONS[i] + '_text');
				textDiv.appendChild(textInput);
			}
		}
	}

	// radio options
	if (module.RADIO_OPTIONS) {
		var radios = document.createElement('ul');
		radios.id = entry.id + '-radios';
		options.appendChild(radios);

		Foxtrick.forEach(function(rOpt, i) {
			item = document.createElement('li');
			radios.appendChild(item);

			label = document.createElement('label');
			item.appendChild(label);

			var radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = entry.id + '-radio';
			radio.value = i;
			radio.setAttribute('module', module.MODULE_NAME);
			label.appendChild(radio);

			var radioDesc = Foxtrick.Prefs.getModuleDescription(module.MODULE_NAME + '.' + rOpt);
			label.appendChild(document.createTextNode(radioDesc));
		}, module.RADIO_OPTIONS);
	}

	Foxtrick.appendChildren(options, customOptions);

	entry.appendChild(container);
	return entry;
}

/**
 * Create module containers and initialize their attributes
 */
function initModules() {
	var modules = [];
	for (var m in Foxtrick.modules)
		modules.push(Foxtrick.modules[m]);

	// remove modules without categories
	modules = Foxtrick.filter(function(m) {
		return typeof m.MODULE_CATEGORY !== 'undefined';
	}, modules);

	// Sort modules in alphabetical order. Links modules to the end
	var linksRe = /^Links/;
	modules.sort(function(a, b) {
		if (linksRe.test(a.MODULE_NAME)) {
			if (linksRe.test(b.MODULE_NAME))
				return a.MODULE_NAME.localeCompare(b.MODULE_NAME);
			else
				return 1;
		}
		else if (linksRe.test(b.MODULE_NAME))
			return -1;
		else
			return a.MODULE_NAME.localeCompare(b.MODULE_NAME);
	});

	for (var module of modules) {
		var obj = makeModuleDiv(module);

		// show on view-by-category tab
		var xOn = module.MODULE_CATEGORY + 'search all';

		// show on view-by-page tab
		if (module.PAGES) {
			if (Foxtrick.has(module.PAGES, 'all'))
				xOn += ' universal';
			else if (Foxtrick.intersect(module.PAGES, PAGEIDS).length > 0)
				xOn += ' on_page';
		}

		obj.setAttribute('x-on', xOn);

		var pane = document.getElementById('pane');
		if (pane)
			pane.appendChild(obj);
	}
}

/**
 * Setup main tab options and listeners
 */
function initMainTab() {
	var desc = document.getElementById('pref-setup-desc');
	var ISSUES_URL = 'https://www.hattrick.org/goto.ashx?path=%2FForum%2FOverview.aspx%3Ff%3D173635%26v%3D0';
	Foxtrick.L10n.appendLink('prefs.setup.desc', desc, ISSUES_URL);

	// add links to main tab prefs
	var mainHeaders = document.querySelectorAll('#pane > div[x-on*="main"] h3');
	mainHeaders.forEach(function(header) {
		if (header.id) {
			var link = document.createElement('a');
			link.className = 'module-link';
			link.textContent = '¶';
			link.href = generateURI({ id: header.id });
			link.title = Foxtrick.L10n.getString('module.link');
			header.appendChild(link);
		}
	});

	// save preferences
	var prefSaveDo = document.getElementById('pref-save-do');
	if (prefSaveDo) {
		prefSaveDo.addEventListener('click', function() {
			var prefSavePref = document.getElementById('pref-save-pref');
			var prefSaveData = document.getElementById('pref-save-data');
			var prefSaveToken = document.getElementById('pref-save-token');
			var prefSaveText = document.getElementById('pref-save-text');

			var savePrefs = prefSavePref ? prefSavePref.checked : false;
			var saveNotes = prefSaveData ? prefSaveData.checked : false;
			var saveToken = prefSaveToken ? prefSaveToken.checked : false;

			if (prefSaveText) {
				prefSaveText.value = Foxtrick.Prefs.save({
					prefs: savePrefs,
					notes: saveNotes,
					oauth: saveToken,
					defaults: true,
				});
			}
		});
	}

	// load preferences
	var prefLoadDo = document.getElementById('pref-load-do');
	if (prefLoadDo) {
		prefLoadDo.addEventListener('click', function() {
			var prefLoadText = document.getElementById('pref-load-text');
			if (prefLoadText) {
				Foxtrick.Prefs.load(prefLoadText.value);
				prefLoadText.value = '';
			}

			window.location.reload();
		});
	}

	// restore to default
	var prefStoredRestore = document.getElementById('pref-stored-restore');
	if (prefStoredRestore) {
		prefStoredRestore.addEventListener('click', function() {
			if (Foxtrick.confirmDialog(Foxtrick.L10n.getString('prefs.restoreDefault.ask'))) {

				Foxtrick.Prefs.restore();

				window.location.reload();
			}
		});
	}

	// delete OAuth token/secret
	var prefDeleteToken = document.getElementById('pref-delete-token');
	if (prefDeleteToken) {
		prefDeleteToken.addEventListener('click', function() {
			var selectDeleteToken = document.getElementById('select-delete-token-teamIds');
			var teamId = selectDeleteToken ? selectDeleteToken.value : '';
			var delToken = Foxtrick.L10n.getString('prefs.deleteToken.ask').replace('%s', teamId);
			if (Foxtrick.confirmDialog(delToken)) {
				var keys = Foxtrick.Prefs.getAllKeysOfBranch('oauth.' + teamId);
				for (var key of keys) {
					Foxtrick.Prefs.deleteValue(key);
				}

				window.location.reload();
			}
		});
	}

	// disable all
	var prefStoredDisable = document.getElementById('pref-stored-disable');
	if (prefStoredDisable) {
		prefStoredDisable.addEventListener('click', function() {
			if (Foxtrick.confirmDialog(Foxtrick.L10n.getString('prefs.disableAllModules.ask'))) {

				Foxtrick.log('preferences: disable all');
				Foxtrick.Prefs.disableAllModules();

				window.location.reload();
			}
		});
	}

	// revoke permissions
	var prefRevokePermissions = document.getElementById('pref-revoke-permissions');
	if (prefRevokePermissions) {
		prefRevokePermissions.addEventListener('click', function() {
			if (Foxtrick.confirmDialog(Foxtrick.L10n.getString('prefs.revokePermissions.ask'))) {

				Foxtrick.log('preferences: revoke permissions');
				revokePermissions();

				window.location.reload();
			}
		});
	}

	// clear cache
	var prefStoredClearCache = document.getElementById('pref-stored-clear-cache');
	if (prefStoredClearCache) {
		prefStoredClearCache.addEventListener('click', function() {
			Foxtrick.clearCaches();
			window.location.reload();
		});
	}
}

/**
 * Setup changes tab layout and release notes
 */
function initChangesTab() {
	var lang = Foxtrick.Prefs.getString('htLanguage');

	var changesLink = document.createElement('a');
	changesLink.href = '#tab=changes';
	changesLink.className = 'module-link';
	changesLink.textContent = '¶';
	changesLink.title = Foxtrick.L10n.getString('module.link');
	var changesHeader = document.querySelector('div[x-on*="changes"] > h2');
	if (changesHeader)
		changesHeader.appendChild(changesLink);

	var parseNotes = function(obj) {
		if (!obj) {
			return {};
		}

		var versions;
		for (var locale in obj) {
			// yaml obj has only one property: locale code
			// ignoring it and taking versions sub-property directly
			versions = obj[locale].versions;
		}

		return versions;
	};

	// version format: x.y[.z[.j]]
	// major version format: x.y.z, adds or removes parts as needed
	var getMajorVersion = function(version) {
		var parts = version.split(/\./).slice(0, 3);
		while (parts.length < 3)
			parts.push(0);

		return parts.join('.');
	};

	var isMajorVersion = function(version) {
		var parts = version.split(/\./);
		return parts.length < 4;
	};

	var updateNotepad = function(selected, versionMap, data) {
		var list = document.getElementById('pref-notepad-list');
		if (!list)
			return;
		list.textContent = ''; // clear list

		var versionL10n = Foxtrick.L10n.getString('releaseNotes.version');

		var versions = data.versions;
		var versionsLocalized = data.versionsLocalized;
		var rNotesLinks = data.rNotesLinks;

		var major = getMajorVersion(selected);
		var minorVersions = versionMap[major];

		for (var version of minorVersions) {
			var notes = versions[version];
			if (!notes)
				continue;

			var versionHeader = versionL10n + ' ' + version;
			var isMajor = isMajorVersion(version);
			if (isMajor) {
				// set main title
				var notepadTitle = document.getElementById('pref-notepad-title');
				if (notepadTitle)
					notepadTitle.textContent = versionHeader;
			}

			if (!isMajor || minorVersions.length > 1) {
				// add sub-headers where needed
				var header = document.createElement('h4');
				header.textContent = versionHeader;
				list.appendChild(header);
			}

			var notesLocalized = versionsLocalized[version];
			for (var n in notes) {
				var note = notes[n];
				if (notesLocalized && typeof notesLocalized[n] !== 'undefined' &&
				    notesLocalized[n] !== null)
					note = notesLocalized[n];

				if (note) {
					var item = document.createElement('li');
					item.id = 'pref-note-' + version + '-' + n;
					addNote(note, item, rNotesLinks);
					list.appendChild(item);
				}
			}
		}
	};

	var addBetaNote = function(statusText, data) {
		var versions = data.versions;
		var versionsLocalized = data.versionsLocalized;
		var rNotesLinks = data.rNotesLinks;

		// add nightly and beta notes
		for (var version in versions) {
			if (Foxtrick.branch.indexOf(version) !== 0)
				continue;

			var notes = versions[version];
			var notesLocalized = versionsLocalized[version];
			if (!notes)
				continue;

			// README: branch note must always be 'note_0'
			var note = notesLocalized && notesLocalized['note_0'] || notes['note_0'];
			if (!note)
				continue;

			var noteEl = document.getElementById('translator_note');
			if (!noteEl)
				continue;

			addNote(note, noteEl, rNotesLinks);

			if (version === 'beta')
				noteEl.appendChild(document.createTextNode(' ' + statusText));

			noteEl.style.display = 'block';
		}
	};

	var addVersions = function(select, versions) {
		var majorVersions = {};
		for (var version in versions) {
			if (!/^\d/.test(version)) {
				// beta / nightly notes
				continue;
			}

			// sort all versions into buckets by major version
			var major = getMajorVersion(version);
			majorVersions[major] = majorVersions[major] || [];
			majorVersions[major].push(version);

			if (!isMajorVersion(version)) {
				// don't add subversions to select box
				continue;
			}

			var item = document.createElement('option');
			item.textContent = version;
			item.value = major; // setting value to major
			select.appendChild(item);
		}

		var currentVersion = getMajorVersion(Foxtrick.version);
		Foxtrick.any(function(opt, i) {
			if (opt.value == currentVersion) {
				select.selectedIndex = i;
				return true;
			}
			return false;
		}, select.options);

		return majorVersions;
	};

	var statusL10n = Foxtrick.L10n.getString('releaseNotes.translationStatus');
	var status = Foxtrick.load(Foxtrick.InternalPath + 'locale/status.json')
		.then(Foxtrick.parseJSON)
		.then(function(statusData) {
			var statusText = '';
			try {
				if (lang !== 'en') {
					var langStatus = Foxtrick.nth(function(item) {
						return item.code == lang;
					}, statusData.status);
					var pctg = langStatus.translated_progress;
					statusText = statusL10n.replace(/%s/, pctg);
				}
			}
			catch (e) {}

			return statusText;
		});

	var rNotesLinks = Foxtrick.load(Foxtrick.InternalPath + 'release-notes-links.yml')
		.then(Foxtrick.parseYAML);

	var rNotesLocalSrc = Foxtrick.InternalPath + 'locale/' + lang + '/release-notes.yml';
	var releaseNotesLocal = Foxtrick.load(rNotesLocalSrc).then(Foxtrick.parseYAML);

	var releaseNotes = Foxtrick.load(Foxtrick.InternalPath + 'release-notes.yml')
		.then(Foxtrick.parseYAML);

	return Promise.all([releaseNotes, releaseNotesLocal, rNotesLinks, status])
		.then(function(resp) {

			var versions = parseNotes(resp[0]);
			var versionsLocalized = parseNotes(resp[1]);
			var rNotesLinks = resp[2];
			var statusText = resp[3];

			if (!versions) {
				Foxtrick.log(new Error('NO RELEASE NOTES!!!'));
				return;
			}

			var data = {
				versions: versions,
				versionsLocalized: versionsLocalized,
				rNotesLinks: rNotesLinks,
			};

			addBetaNote(statusText, data);

			var select = document.getElementById('pref-version-release-notes');
			if (!select)
				return;

			var majorVersions = addVersions(select, versions);

			var update = function() {
				updateNotepad(select.value, majorVersions, data);
			};

			update();
			select.addEventListener('change', update);

		}).catch(Foxtrick.catch('changes'));

}

/**
 * Setup help tab and FAQ layout
 * @return {Promise<void>}
 */
function initHelpTab() {
	// external links
	Foxtrick.load(Foxtrick.InternalPath + 'data/foxtrick_about.json')
		.then(function(aboutJSON) {

			/** @type {AboutJSONSchema} */
			// @ts-ignore
			var aboutData = JSON.parse(aboutJSON);
			var category = aboutData.links;

			var externalLinksList = document.getElementById('external-links-list');
			Foxtrick.forEach(function(a) {
				var item = document.createElement('li');
				if (externalLinksList)
					externalLinksList.appendChild(item);

				var link = document.createElement('a');
				item.appendChild(link);
				link.textContent = Foxtrick.L10n.getString('link.' + a.id);
				link.href = a.href;
				link.relList.add('noopener');
				link.target = '_blank';
			}, category);

		}).catch(Foxtrick.catch('help-external-links'));

	var parseFaq = function(src) {
		if (!src)
			return {};

		for (var locale in src) {
			// yaml obj has only one property: locale code
			// ignoring it and taking faq sub-property directly
			src = src[locale];
		}

		return src.faq;
	};

	var addFAQItem = function(item, itemLocal, i, faqLinks) {
		// container for question and answer
		var block = document.createElement('div');
		block.id = 'faq-' + i;
		block.className = 'module';
		block.setAttribute('x-on', 'help search');
		var pane = document.getElementById('pane');
		if (pane)
			pane.appendChild(block);

		// question
		var header = document.createElement('h3');
		var question = itemLocal && typeof itemLocal === 'object' && itemLocal.question ?
			itemLocal.question : item.question;

		addNote(question, header, faqLinks);
		block.appendChild(header);

		// link to question
		var link = document.createElement('a');
		link.textContent = '¶';
		link.className = 'module-link';
		link.href = '#faq=' + i;
		header.appendChild(link);

		// answer
		var content = document.createElement('p');
		var answer = itemLocal && typeof itemLocal === 'object' && itemLocal.answer ?
			itemLocal.answer : item.answer;

		addNote(answer, content, faqLinks);

		var container = document.createElement('div');
		container.className = 'module-content';
		container.appendChild(content);
		block.appendChild(container);
	};

	// FAQ (faq.yml or localized locale/code/faq.yml
	var faqLinks = Foxtrick.load(Foxtrick.InternalPath + 'faq-links.yml').then(Foxtrick.parseYAML);
	var faq = Foxtrick.load(Foxtrick.InternalPath + 'faq.yml').then(Foxtrick.parseYAML);

	var lang = Foxtrick.Prefs.getString('htLanguage');
	var faqLocalSrc = Foxtrick.InternalPath + 'locale/' + lang + '/faq.yml';
	var faqLocal = Foxtrick.load(faqLocalSrc).then(Foxtrick.parseYAML);

	return Promise.all([faqLinks, faq, faqLocal]).then(function(resp) {
		var faqLinks = resp[0];
		var items = parseFaq(resp[1]);
		var itemsLocal = parseFaq(resp[2]);

		if (!items) {
			Foxtrick.log(new Error('NO FAQ!!!'));
			return;
		}

		for (var i in items) {
			var item = items[i];

			// prefer localized ones
			var itemLocal = itemsLocal ? itemsLocal[i] : null;

			addFAQItem(item, itemLocal, i, faqLinks);
		}

	}).catch(Foxtrick.catch('help'));
}

/**
 * Setup about page and contributor layout
 * @return {Promise<void>}
 */
function initAboutTab() {
	var addItem = function(person, list) {
		var item = document.createElement('li');

		var id = person.id || null;
		var name = person.name;
		item.appendChild(document.createTextNode(name));

		if (id) {
			item.appendChild(document.createTextNode(' '));
			var link = document.createElement('a');
			link.href = 'https://www.hattrick.org/goto.ashx?path=/Club/Manager/?userId=' + id;
			link.textContent = Foxtrick.format('({})', [id]);
			item.appendChild(link);
		}

		list.appendChild(item);
	};

	return Foxtrick.load(Foxtrick.InternalPath + 'data/foxtrick_about.json')
		.then(function(aboutJSON) {

			/** @type {AboutJSONSchema} */
			// @ts-ignore
			var aboutData = JSON.parse(aboutJSON);

			var containers = document.querySelectorAll('.about-list');
			containers.forEach(function(container) {
				var type = container.getAttribute('path');

				/** @type {AboutJSONPerson[]|AboutJSONTranslation[]} */
				// @ts-ignore
				var category = aboutData[type];
				Foxtrick.map(function(data) {
					if (type === 'translations') {
						/** @type {unknown} */
						let foo = data;
						let trData = /** @type {AboutJSONTranslation}*/ (foo);
						var item = document.createElement('li');
						var header = document.createElement('h4');
						header.textContent = String(trData.language);
						item.appendChild(header);

						var list = document.createElement('ul');
						item.appendChild(list);

						Foxtrick.map(function(translator) {
							addItem(translator, list);
						}, trData.translators);

						container.appendChild(item);
					}
					else {
						addItem(data, container);
					}

				// @ts-ignore
				}, category);
			});

		}).catch(Foxtrick.catch('about'));

}

/**
 * Setup all tabs
 * @return {Promise<void[]>}
 */
function initTabs() {
	// attach each tab with corresponding pane
	var tabLinks = document.querySelectorAll('.tabs li a');
	tabLinks.forEach(function(link) {
		var tab = link.parentElement.id.replace(/^tab-/, '');
		link.href = generateURI({ tab: tab });
	});

	// initialize the tabs

	initMainTab();

	var changes = initChangesTab();
	var help = initHelpTab();
	var about = initAboutTab();

	initModules();

	return Promise.all([changes, help, about]);
}

/**
 * Setup localized descriptions, initial option values and option dependencies
 */
function initTextAndValues() {
	if (Foxtrick.L10n.getString('direction') === 'rtl')
		document.documentElement.setAttribute('dir', 'rtl');

	document.title = Foxtrick.L10n.getString('prefs.title');
	var versionEl = document.getElementById('version');
	if (versionEl)
		versionEl.textContent = Foxtrick.version + ' ' + Foxtrick.branch;

	// initialize text
	var textElements = document.querySelectorAll('body [data-text]');
	textElements.forEach(function(el) {
		if (el.dataset.text) {
			var text = Foxtrick.L10n.getString(el.dataset.text);
			var node = document.createTextNode(text);
			el.insertBefore(node, el.firstChild);
		}
	});

	// initialize modules
	var moduleElements = document.querySelectorAll('#pane [module]');
	moduleElements.forEach(function(el) {
		var module = el.getAttribute('module');
		if (el.getAttribute('option')) {
			// module option
			var option = el.getAttribute('option');
			if (el.type === 'checkbox') {
				if (Foxtrick.Prefs.isModuleOptionEnabled(module, option))
					el.checked = true;
			}
			else if (el.matches('input, textarea')) {
				// text input
				el.value = Foxtrick.Prefs.getString('module.' + module + '.' + option);
			}
		}
		else if (el.type === 'radio') {
			// radio input
			var selected = Foxtrick.Prefs.getModuleValue(module);
			if (el.value == selected)
				el.checked = true;
		}
		else if (Foxtrick.Prefs.isModuleEnabled(module)) {
			// module itself
			el.checked = true;
		}
	});

	// initialize inputs
	var prefInputs = document.querySelectorAll('#pane input[pref]');
	prefInputs.forEach(function(el) {
		if (el.type === 'checkbox') {
			// checkbox
			if (Foxtrick.Prefs.getBool(el.getAttribute('pref')))
				el.checked = true;
		}
		else {
			// text input
			el.value = Foxtrick.Prefs.getString(el.getAttribute('pref')) || '';
		}
	});

	var prefTextareas = document.querySelectorAll('#pane textarea[pref]');
	prefTextareas.forEach(function(el) {
		el.textContent = Foxtrick.Prefs.getString(el.getAttribute('pref'));
	});

	// initialize elements with blockers, disable if blocker enabled
	var blockedElements = document.querySelectorAll('body [blocked-by]');
	blockedElements.forEach(function(blockee) {
		var blockerId = blockee.getAttribute('blocked-by');
		var blocker = document.getElementById(blockerId);

		var updateStatus = function() {
			if (blocker && blocker.checked)
				blockee.disabled = true;
			else
				blockee.disabled = false;
		};

		if (blocker)
			blocker.addEventListener('click', updateStatus);

		updateStatus();
	});

	// initialize elements with dependency, show only if dependency met
	var dependerElements = document.querySelectorAll('#pane [depends-on]');
	dependerElements.forEach(function(depender) {
		var dependeeId = depender.getAttribute('depends-on');
		var dependee = document.getElementById(dependeeId);

		var updateStatus = function() {
			if (dependee && dependee.checked)
				Foxtrick.removeClass(depender, 'hidden');
			else
				Foxtrick.addClass(depender, 'hidden');
		};

		if (dependee)
			dependee.addEventListener('click', updateStatus);

		updateStatus();
	});

	// TODO: move oAuth and currency setup to initMainTab

	// delete-token description
	var CHPP_URL = Foxtrick.goToUrl('/MyHattrick/Preferences/ExternalAccessGrants.aspx');
	var delDesc = document.getElementById('pref-delete-token-desc');
	Foxtrick.L10n.appendLink('prefs.storedData.oauth.delete.desc', delDesc, CHPP_URL);

	// initialize delete-token
	var oauthKeys = Foxtrick.Prefs.getAllKeysOfBranch('oauth');
	if (oauthKeys) {
		var teamIds = Foxtrick.map(function(n) {
			return n.match(/^oauth\.(.+?)\./)[1];
		}, oauthKeys);
		teamIds = Foxtrick.unique(teamIds);

		var selectDeleteTokenTeamIds = document.getElementById('select-delete-token-teamIds');
		for (var teamId of teamIds) {
			var id = parseInt(teamId, 10);

			if (!isNaN(id)) {
				var item = document.createElement('option');
				item.value = id;
				item.textContent = id;

				if (selectDeleteTokenTeamIds)
					selectDeleteTokenTeamIds.appendChild(item);
			}
			else {
				// delete invalid
				var keys = Foxtrick.Prefs.getAllKeysOfBranch('oauth.' + teamId);
				for (var key of keys) {
					Foxtrick.Prefs.deleteValue(key);
				}
			}
		}
	}

	// initialize currency display
	var currencyKeys = Foxtrick.Prefs.getAllKeysOfBranch('Currency.Code');
	var rmText = Foxtrick.L10n.getString('button.remove');
	var prefSetupCurrency = document.getElementById('pref-setup-currency');
	Foxtrick.forEach(function(key) {
		var id = parseInt(key.match(/\d+$/), 10);
		if (isNaN(id) || !id) {
			Foxtrick.Prefs.deleteValue(key);
			return;
		}

		var code = Foxtrick.Prefs.getString('Currency.Code.' + id);
		var rate = Foxtrick.util.currency.getRateByCode(code);

		var row = document.createElement('tr');
		row.id = 'team-currency-row-' + id;

		var tdId = row.appendChild(document.createElement('td'));
		var aId = tdId.appendChild(document.createElement('a'));
		aId.href = Foxtrick.goToUrl('/Club/?TeamID=' + id);
		aId.target = '_blank';
		aId.textContent = id;

		row.appendChild(document.createElement('td')).textContent = code;
		row.appendChild(document.createElement('td')).textContent = rate || '-';

		var rmCell = row.appendChild(document.createElement('td'));
		var rmBtn = rmCell.appendChild(document.createElement('button'));
		rmBtn.textContent = rmText;
		rmBtn.dataset.id = id;
		Foxtrick.onClick(rmBtn, function(ev) {
			var id = this.dataset.id;
			Foxtrick.Prefs.deleteValue('Currency.Code.' + id);
			var row = ev.target.ownerDocument.getElementById('team-currency-row-' + id);
			row.parentNode.removeChild(row);
			Foxtrick.Prefs.setBool('preferences.updated', true);
		});

		if (prefSetupCurrency)
			prefSetupCurrency.appendChild(row);

	}, currencyKeys);
}

/**
 * Main pref logic sequence
 */
async function init() {
	try {
		await initCoreModules(false);
		getPageIds();

		await initTabs();

		initSearch();
		initListeners();
		initTextAndValues();

		locateFragment(window.location.href);

		testPermissions();

		var spinner = document.getElementById('spinner');
		var subheader = document.getElementById('subheader');
		var content = document.getElementById('content');

		if (spinner)
			spinner.classList.add('hidden');
		if (subheader)
			subheader.classList.remove('hidden');
		if (content)
			content.classList.remove('hidden');


		// if (Foxtrick.Prefs.isModuleEnabled('MobileEnhancements')) {
		// 	// mobile
		// 	var tabs = document.querySelectorAll('.tabs');
		// 	tabs.forEach(function(t) { t.style.display = 'none'; });
		// 	if (content) content.classList.add('ft-mobile');
		// 	Foxtrick.log(Foxtrick, 'MobileEnhancements');
		// 	var navHeader = document.getElementById('navigation-header');
		// 	if (navHeader) {
		// 		Foxtrick.onClick(navHeader, function() {
		// 			tabs.forEach(function(t) {
		// 				t.style.display = t.style.display === 'none' ? '' : 'none';
		// 			});
		// 			var main = document.getElementById('main');
		// 			if (main)
		// 				main.style.display = main.style.display === 'none' ? '' : 'none';
		// 		});
		// 	}
		// }

		/* Run a test. */
		// if (window.location.href.search(/saved=true/) !== -1) {
		// 	notice(Foxtrick.L10n.getString('prefs.feedback.saved'));
		// 	window.location.href = window.location.href.
		// 		slice(0, window.location.href.search(/\&saved=true/));
		// }
		// else if (window.location.href.search(/imported=true/) !== -1) {
		// 	notice(Foxtrick.L10n.getString('prefs.feedback.loaded'));
		// 	window.location.href = window.location.href.
		// 		slice(0, window.location.href.search(/\&imported=true/));
		// }
	}
	catch (e) {
		Foxtrick.logFatalError('Preferences init:', e);
	}
}

/**
 * Start up
 */
function initLoader() {
	var w = document.location.href.match(/width=(\d+)/);
	if (w)
		document.body.setAttribute('style', 'width:' + w[1] + 'px;');

	if (document.URL.startsWith('moz-extension://')) {
		var main = document.getElementById('main');
		if (main)
			main.setAttribute('gecko', ''); // sigh mozilla
	}

	// Fennec runs init() from injected entry.js (injected)
	// called directly, it'll run and save actually for some reason

	// gecko, chrome
	if (Foxtrick.arch === 'Gecko' || Foxtrick.context === 'background') {
		init();
	}
	else {
		// safari prefs runs in content context for some people?!!
		// add needed resources first
		Foxtrick.SB.ext.sendRequest({ req: 'optionsPageLoad' }, (data) => {
			try {
				Foxtrick.entry.contentScriptInit(data);
				init();
			}
			catch (e) {
				Foxtrick.log('initLoader:', e);
			}
		});
	}
}

// this is the preference script entry point for Sandboxed arch
initLoader();
