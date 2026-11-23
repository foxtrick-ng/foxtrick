'use strict';
/**
 * popup.js
 *
 * @author LA-MJ
 */

/* global chrome */

// jscs:disable disallowFunctionDeclarations

var BackgroundPage, isChrome = false, Foxtrick;
if (Foxtrick && Foxtrick.Manifest.manifest_version == 3) {
	if (typeof window.chrome == 'object')
		isChrome = true;
		Foxtrick.entry.init(false).then(() => {
			init();
	});
} else {
	if (typeof window.chrome == 'object') {
		BackgroundPage = chrome.extension.getBackgroundPage();
		isChrome = true;
		Foxtrick = BackgroundPage.Foxtrick;
		init();
	}
}

function shutDown() {
	window.close();
}
function visitLink() {
	if (isChrome) {
		// jshint -W040
		let url = this.href;
		chrome.tabs.create({ url: url });
		this.href = '';
		// jshint +W040

		window.close();

		return false;
	}

	shutDown();
}

/**
 * Reload the active Hattrick tab so that the changed option takes effect,
 * then close the popup.
 */
function reloadHattrickAndClose() {
	const RELOAD_DELAY = 150; // ms, let the pref write settle

	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		let tab = tabs && tabs[0];
		let isHT = tab && (!tab.url || /^https?:\/\/[^/]*\.hattrick\.org\//.test(tab.url));
		if (!isHT) {
			window.close();
			return;
		}
		setTimeout(() => {
			chrome.tabs.reload(tab.id);
			window.close();
		}, RELOAD_DELAY);
	});
}

function toggleEnabled() {
	var checked = document.getElementById('foxtrick-toolbar-deactivate').checked;
	Foxtrick.Prefs.setBool('disableTemporary', checked);
	Foxtrick.Prefs.setBool('preferences.updated', true);
	reloadHattrickAndClose();
}
function toggleHighlight() {
	var checked = document.getElementById('foxtrick-toolbar-highlight').checked;
	Foxtrick.Prefs.setBool('featureHighlight', checked);
	Foxtrick.Prefs.setBool('preferences.updated', true);
	reloadHattrickAndClose();
}
function toggleTranslationKeys() {
	var checked = document.getElementById('foxtrick-toolbar-translationKeys').checked;
	Foxtrick.Prefs.setBool('translationKeys', checked);
	Foxtrick.Prefs.setBool('preferences.updated', true);
	reloadHattrickAndClose();
}

function clearCache() {
	if (Foxtrick.Manifest.manifest_version == 3) {
		Foxtrick.context = 'content';
	}
	Foxtrick.clearCaches();
	window.close();
}

function openPrefs() {
	document.location.href = 'preferences.html?width=700&context=popup#tab=on_page';
}

function init() {
	var checkbox, label;
	checkbox = document.getElementById('foxtrick-toolbar-deactivate');
	checkbox.checked = Foxtrick.Prefs.getBool('disableTemporary');
	checkbox.addEventListener('click', toggleEnabled);

	checkbox = document.getElementById('foxtrick-toolbar-highlight');
	checkbox.checked = Foxtrick.Prefs.getBool('featureHighlight');
	checkbox.addEventListener('click', toggleHighlight);

	checkbox = document.getElementById('foxtrick-toolbar-translationKeys');
	checkbox.checked = Foxtrick.Prefs.getBool('translationKeys');
	checkbox.addEventListener('click', toggleTranslationKeys);

	document.getElementById('foxtrick-toolbar-deactivate-label').textContent =
		Foxtrick.L10n.getString('toolbar.disableTemporary');
	document.getElementById('foxtrick-toolbar-highlight-label').textContent =
		Foxtrick.L10n.getString('toolbar.featureHighlight');
	document.getElementById('foxtrick-toolbar-translationKeys-label').textContent =
		Foxtrick.L10n.getString('toolbar.translationKeys');

	label = document.getElementById('foxtrick-toolbar-options-label');
	label.textContent = Foxtrick.L10n.getString('toolbar.preferences');
	label.addEventListener('click', openPrefs);

	label = document.getElementById('foxtrick-toolbar-homepage-label');
	label.textContent = Foxtrick.L10n.getString('link.homepage');
	label.addEventListener('click', visitLink);

	label = document.getElementById('foxtrick-toolbar-contribute-label');
	var temp = document.createElement('div');
	var link = Foxtrick.L10n.appendLink('changes.support', temp, label.href);
	if (link) {
		label.textContent = link.textContent;
	}
	label.addEventListener('click', visitLink);

	label = document.getElementById('foxtrick-toolbar-clearCache-label');
	label.textContent = Foxtrick.L10n.getString('api.clearCache');
	label.title = Foxtrick.L10n.getString('api.clearCache.title');
	label.addEventListener('click', clearCache);
}
