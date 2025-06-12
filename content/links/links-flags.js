'use strict';
/**
 * linksflags.js
 * Foxtrick add links to flag collection page
 * @author convinced, LA-MJ, UnnecessaryDave
 */

Foxtrick.modules['LinksFlags'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.LINKS,
	PAGES: ['flagCollection'],
	LINK_TYPES: ['flagslink'],
	/**
	 * return HTML for FT prefs
	 * @param  {document}         doc
	 * @param  {function}         cb
	 * @return {HTMLUListElement}
	 */
	OPTION_FUNC: function(doc, cb) {
		return Foxtrick.util.links.getPrefs(doc, this, cb);
	},

	run: function(doc) {
		Foxtrick.util.links.run(doc, this);
	},

	links: function(doc) {
		var teamId = Foxtrick.Pages.All.getTeamId(doc);
		var info = { teamId: teamId };

        return { info: info };
	}
};
