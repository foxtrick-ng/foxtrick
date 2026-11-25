/**
 * highlight-ownerless.js
 * Highlight ownerless teams
 * @author ljushaff, ryanli
 */

'use strict';

Foxtrick.modules.HighlightOwnerless = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.PRESENTATION,
	PAGES: ['series'],

	/** @param {document} doc */
	run: function(doc) {
		const module = this;
		let table = Foxtrick.Pages.Series.getTable(doc);
		if (table) {
			let ownerless = table.getElementsByClassName('shy');
			for (let shy of ownerless) {
				Foxtrick.addClass(shy, 'ft-ownerless');

				// league table: group icons after the team name
				let box = Foxtrick.Pages.Series.getTeamIconBox(shy, module);
				if (!box || box.querySelector('.ft-ownerless-icon'))
					continue;

				let img = doc.createElement('img');
				img.src = '/Img/Icons/transparent.gif';
				img.alt = '';
				img.className = 'ft-ownerless-icon';
				box.appendChild(Foxtrick.makeFeaturedElement(img, module));
			}
		}
	},
};
