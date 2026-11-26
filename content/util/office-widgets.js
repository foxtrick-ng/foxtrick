/**
 * office-widgets.js
 * Helpers for the Angular-rendered widgets on the office (My Office) page.
 */

'use strict';

/* eslint-disable */
if (!this.Foxtrick)
	// @ts-ignore
	var Foxtrick = {};
/* eslint-enable */

if (!Foxtrick.util)
	Foxtrick.util = {};

Foxtrick.util.officeWidgets = {};

/**
 * Call callback(el) for every element matching selector inside the office
 * widgets, both now and whenever Angular (re)renders them later.
 *
 * Each element instance is handled only once per call; a re-rendered widget
 * is a new element and is handled again.
 *
 * Widgets must be matched by their component tag/classes
 * (e.g. 'ht-widget-myaccount'), never by position or ids like
 * '#office-card-<n>': the order and set of widgets is chosen by the user.
 *
 * @param {document} doc
 * @param {string}   selector e.g. 'ht-widget-myaccount .tier-expiration'
 * @param {function(HTMLElement):void} callback
 */
Foxtrick.util.officeWidgets.onWidget = function(doc, selector, callback) {
	/** @type {WeakSet<Element>} */
	let handled = new WeakSet();

	let scan = () => {
		for (let el of doc.querySelectorAll(selector)) {
			if (handled.has(el))
				continue;

			handled.add(el);
			try {
				callback(/** @type {HTMLElement} */ (el));
			}
			catch (e) {
				Foxtrick.log(e);
			}
		}
	};

	scan();

	// #mainBody is rendered by the server and hosts <ng-app>, so it exists
	// before Angular draws the widgets; fall back to body if HT changes layout
	let root = doc.getElementById('mainBody') || doc.body;
	Foxtrick.onChange(root, scan);
};
