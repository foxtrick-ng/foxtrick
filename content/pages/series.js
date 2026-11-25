/**
 * series.js
 * utilities on series pages
 * @author LA-MJ
 */

'use strict';

/* eslint-disable */
if (!this.Foxtrick)
	// @ts-ignore
	var Foxtrick = {};
/* eslint-enable */

if (!Foxtrick.Pages)
	Foxtrick.Pages = {};

Foxtrick.Pages.Series = {};

/**
 * Get the series table
 * @param  {document} doc
 * @return {HTMLTableElement}
 */
Foxtrick.Pages.Series.getTable = function(doc) {
	var parent = Foxtrick.getMBElement(doc, 'UpdatePanel1') ||
		Foxtrick.getMBElement(doc, 'repLeagueTable');
	return parent && parent.querySelector('table');
};

/**
 * Get the live series table container
 * @param  {document} doc
 * @return {HTMLElement}
 */
Foxtrick.Pages.Series.getLiveTable = function(doc) {
	return Foxtrick.getMBElement(doc, 'UpdatePanelLiveLeagueTable');
};

/**
 * Get the series news feed container
 * @param  {document} doc
 * @return {HTMLElement}
 */
Foxtrick.Pages.Series.getNewsFeed = function(doc) {
	return Foxtrick.getMBElement(doc, 'repLLUFeed');
};

/**
 * Get or create the container for Foxtrick icons placed after a team name
 * in the league table. Icons are grouped there so the team name is never pushed
 * under neighbouring cells. Returns null for elements outside the league table.
 * @param  {Element} el     element inside the team cell (e.g. team link)
 * @param  {object}  module module creating the container (feature highlight)
 * @return {HTMLElement}
 */
Foxtrick.Pages.Series.getTeamIconBox = function(el, module) {
	let wrapper = el.closest('.league-table-team-wrapper');
	if (!wrapper)
		return null;

	/** @type {HTMLElement} */
	let box = wrapper.querySelector('.ft-team-icons');
	if (!box) {
		box = Foxtrick.createFeaturedElement(el.ownerDocument, module, 'span');
		Foxtrick.addClass(box, 'ft-team-icons');
		wrapper.appendChild(box);
		Foxtrick.addClass(wrapper, 'ft-team-wrapper');
	}
	return box;
};
