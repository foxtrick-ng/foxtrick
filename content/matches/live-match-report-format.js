'use strict';
/*
 * live-alert.js
 * Alerting HT Live goals
 * @author ryanli
 */

Foxtrick.modules['LiveMatchReportFormat'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.MATCHES,
	PAGES: ['matchesLive'],
	NICE: 1,

	run: function(doc) {
		var fixInjuries = function(doc) {
			var livereports = doc.getElementsByClassName('liveReport');
			for (let report of livereports)
				Foxtrick.util.matchEvent.fixInjuryIcons(report);
		};

		// highlights live outside of the live report container
		var watchedHighlights = null;
		var watchHighlights = function(doc) {
			var highlights = doc.querySelector('.liveTabsContainer');
			if (!highlights || highlights === watchedHighlights)
				return;

			watchedHighlights = highlights;
			Foxtrick.onChange(highlights, fixInjuries);
		};

		var react = function(liveReport, indicators) {
			var events = liveReport.getElementsByTagName('tr');
			Foxtrick.forEach(function(evnt) {
				// no event, stuff like the indicators or our indicators
				if (!evnt.getAttribute('data-eventtype')) {
					evnt.firstChild.colSpan = 4;
					return;
				}

				Foxtrick.util.matchEvent.addEventIcons(evnt);
			}, events);
			if (indicators)
				Foxtrick.util.matchEvent.addEventIndicators(liveReport);
		};
		var reactAll = function(doc) {
			var livereports = doc.getElementsByClassName('liveReport');
			Foxtrick.forEach(function(report) {
				react(report, true);
			}, livereports);

			fixInjuries(doc);
			watchHighlights(doc);
		};

		// firstload
		reactAll(doc);

		var livereportsContainer = Foxtrick.Pages.Match.getLiveContainer(doc);
		if (livereportsContainer)
			Foxtrick.onChange(livereportsContainer, reactAll, { subtree: false });
	},
};
