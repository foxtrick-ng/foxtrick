/**
 * Fixes for css isues
 * @author spambot, ljushaff, ryanli
 */

'use strict';

Foxtrick.modules.FixcssProblems = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.PRESENTATION,
	OUTSIDE_MAINBODY: true,
	PAGES: ['all'],

	OPTIONS: [
		'DisableCPAFormatting',
		'RTL_Fixes',
		'MatchReportRatingsFontFix',
		'MatchinfoLegacy',
		'RemoveForumSneakPeak',
	],

	OPTIONS_CSS: [
		Foxtrick.InternalPath + 'resources/css/fixes/CopyPlayerAd_disable_formatting.css',
		Foxtrick.InternalPath + 'resources/css/fixes/RTL_Fixes.css',
		Foxtrick.InternalPath + 'resources/css/fixes/MatchReportRatingsFontFix.css',
		Foxtrick.InternalPath + 'resources/css/fixes/MatchinfoLegacy.css',
		Foxtrick.InternalPath + 'resources/css/fixes/RemoveForumSneakPeak.css',
	],
};
