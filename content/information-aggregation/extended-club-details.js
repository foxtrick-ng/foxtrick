/**
 * extended-club-details.js
 * Adds extra club information (short team names as text or tooltip)
 * to the manager, club, match and live pages
 * @author LA-maczek
 */

'use strict';

Foxtrick.modules.ExtendedClubDetails = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['managerPage', 'teamPage', 'match', 'matchesLive'],
	OPTIONS: ['ShortTeamName'],
	CSS: Foxtrick.InternalPath + 'resources/css/extended-club-details.css',

	/** links to senior club pages (both URL forms used by HT) */
	TEAM_LINK_SELECTOR: 'a[href*="/Club/?TeamID="], a[href*="/Club/Default.aspx?TeamID="]',

	/** @param {document} doc */
	run: function(doc) {
		const module = this;

		if (!Foxtrick.Prefs.isModuleOptionEnabled(module, 'ShortTeamName'))
			return;

		if (Foxtrick.isPage(doc, 'managerPage'))
			module.addShortTeamNames(doc);
		else if (Foxtrick.isPage(doc, 'teamPage'))
			module.addShortTeamNameHeader(doc);
		else if (Foxtrick.isPage(doc, 'match') || Foxtrick.isPage(doc, 'matchesLive'))
			module.addShortTeamNamesMatch(doc);
	},

	/**
	 * Match and Live pages are rendered/re-rendered dynamically (Angular), so team
	 * links may appear or be replaced after run() → re-run on DOM changes
	 * (already processed links are marked, so this is idempotent).
	 * @param {document} doc
	 */
	change: function(doc) {
		const module = this;

		if (!Foxtrick.isPage(doc, ['match', 'matchesLive']))
			return;
		if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'ShortTeamName'))
			module.addShortTeamNamesMatch(doc);
	},

	/**
	 * Fetch short team names from CHPP teamdetails.
	 * @param {document} doc
	 * @param {CHPPParams} idParam e.g. [['userId', 123]] or [['teamId', 456]]; empty = own user
	 * @param {function(Map<number, string>, Map<number, string>):void} callback
	 *        (shortNames: teamId → ShortTeamName, teamNames: teamId → TeamName)
	 */
	fetchShortNames: function(doc, idParam, callback) {
		const module = this;

		/** @type {CHPPParams} */
		let params = [
			['file', 'teamdetails'],
			['version', '3.1'],
			...idParam,
		];

		Foxtrick.util.api.retrieve(doc, params, { cache: 'session' }, (xml, errorText) => {
			if (!xml || errorText) {
				Foxtrick.log(module.MODULE_NAME, errorText);
				return;
			}

			/** @type {Map<number, string>} */
			let shortNames = new Map();
			/** @type {Map<number, string>} */
			let teamNames = new Map();
			for (let team of Foxtrick.toArray(xml.getElementsByTagName('Team'))) {
				let id = xml.num('TeamID', team);
				let shortName = (xml.text('ShortTeamName', team) || '').trim();
				let teamName = xml.text('TeamName', team) || '';
				if (!id)
					continue;

				// keep all team names: the manager page header is matched by name
				// and must not fall back to a shorter name of another team
				teamNames.set(id, teamName);

				// show the short name only if it differs from the full team name
				if (shortName && shortName.toLowerCase() !== teamName.trim().toLowerCase())
					shortNames.set(id, shortName);
			}
			if (shortNames.size)
				callback(shortNames, teamNames);
		});
	},

	/**
	 * Club page: show ShortTeamName as a tooltip on the team name in the page header
	 * (breadcrumbs) and in div.teamNameTitle (long names must not get any longer).
	 * @param {document} doc
	 */
	addShortTeamNameHeader: function(doc) {
		const module = this;

		let teamId = Foxtrick.Pages.All.getTeamIdFromBC(doc);
		if (!teamId)
			return;

		module.fetchShortNames(doc, [['teamId', teamId]], (shortNames) => {
			let shortName = shortNames.get(teamId);
			if (!shortName)
				return;

			let teamName = Foxtrick.Pages.All.getTeamNameFromBC(doc);

			Foxtrick.stopObserver(doc);

			// 1) team name link in the page header (breadcrumbs)
			let links = Foxtrick.Pages.All.getBreadCrumbs(doc) || [];
			let link = Foxtrick.nth(a => Foxtrick.util.id.getTeamIdFromUrl(a.href) === teamId,
				links);
			if (link)
				module.addTooltip(link, shortName);

			// 2) team name in div.teamNameTitle
			let title = doc.querySelector('#mainBody div.teamNameTitle');
			if (title)
				module.addTooltipToTeamName(doc, title, teamName, shortName);

			Foxtrick.startObserver(doc);
		});
	},

	/**
	 * Add ShortTeamName to the tooltip (title) of an element and mark it as featured.
	 * An existing title is kept.
	 * @param {HTMLElement} el
	 * @param {string}      shortName
	 */
	addTooltip: function(el, shortName) {
		const module = this;

		if (el.dataset.ftShortName)
			return;
		el.dataset.ftShortName = '1';

		el.title = el.title ? `${el.title} (${shortName})` : shortName;
		Foxtrick.makeFeaturedElement(el, module);
	},

	/**
	 * Show ShortTeamName as a tooltip on the team name text inside an element
	 * (div.teamNameTitle on the club page, header div.boxHead on the manager page).
	 * The name text is wrapped in a span so that the tooltip covers only the name;
	 * if the name cannot be found, the tooltip is set on the whole element.
	 * @param {document}    doc
	 * @param {HTMLElement} container element containing the team name
	 * @param {string}      teamName
	 * @param {string}      shortName
	 */
	addTooltipToTeamName: function(doc, container, teamName, shortName) {
		const module = this;

		if (container.dataset.ftShortName)
			return;

		let textNode = null;
		if (teamName) {
			let walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (n.textContent.includes(teamName)) {
					textNode = n;
					break;
				}
			}
		}

		if (!textNode) {
			module.addTooltip(container, shortName);
			return;
		}
		container.dataset.ftShortName = '1';

		// isolate the team name in its own text node
		let nameNode = textNode.splitText(textNode.textContent.indexOf(teamName));
		nameNode.splitText(teamName.length);

		// HT styles <span>s inside .teamNameTitle; extended-club-details.css resets that
		let span = doc.createElement('span');
		span.className = 'ft-short-team-name-title';
		nameNode.parentNode.replaceChild(span, nameNode);
		span.appendChild(nameNode);
		module.addTooltip(span, shortName);
	},

	/**
	 * Manager page: append "(ShortTeamName)" after each team link owned by the manager;
	 * the page header box "TeamName » ManagerName" gets a tooltip instead.
	 * One request returns all teams of the user.
	 * @param {document} doc
	 */
	addShortTeamNames: function(doc) {
		const module = this;

		let main = doc.getElementById('mainBody');
		if (!main)
			return;

		// no userId in URL → own manager page → CHPP defaults to own user
		let userId = Foxtrick.util.id.getUserIdFromUrl(doc.location.href);
		/** @type {CHPPParams} */
		let idParam = userId ? [['userId', userId]] : [];

		module.fetchShortNames(doc, idParam, (shortNames, teamNames) => {
			Foxtrick.stopObserver(doc);

			// main page header box "TeamName » ManagerName" (div.boxHead outside #mainBody):
			// tooltip as on the club page. Sidebar boxes (team menu) are skipped:
			// only the header with the "»" separator is used.
			// Match by team name, longest first (one name may contain another).
			let byLength = [...teamNames.entries()].sort((a, b) => b[1].length - a[1].length);
			let header = Foxtrick.nth(el => el.textContent.includes('»'),
				doc.querySelectorAll('div.boxHead'));
			if (header) {
				let text = header.textContent.split('»')[0];
				let match = byLength.find(([, name]) => name && text.includes(name));
				if (match && shortNames.has(match[0]))
					module.addTooltipToTeamName(doc, header, match[1], shortNames.get(match[0]));
			}

			let links = main.querySelectorAll(module.TEAM_LINK_SELECTOR);
			for (let link of Foxtrick.toArray(links)) {
				// skip already processed and links inside box headers (handled above)
				if (link.dataset.ftShortName || link.closest('div.boxHead'))
					continue;

				let id = Foxtrick.util.id.getTeamIdFromUrl(link.href);
				let shortName = shortNames.get(id);
				// only links showing the team name (skip images, icons, etc.)
				if (!shortName || !link.textContent.trim())
					continue;

				link.dataset.ftShortName = '1';
				let span = Foxtrick.createFeaturedElement(doc, module, 'span');
				span.className = 'ft-short-team-name';
				span.textContent = ` (${shortName})`;
				Foxtrick.insertAfter(span, link);
			}

			Foxtrick.startObserver(doc);
		});
	},

	/**
	 * Match / Live page: show "(ShortTeamName)" on its own line under each team name
	 * in div.box.matchinfo.
	 * Senior teams only (links /Club/?TeamID=); one teamdetails request per team (session cache).
	 * @param {document} doc
	 */
	addShortTeamNamesMatch: function(doc) {
		const module = this;

		// there can be several div.box.matchinfo (e.g. added by other extensions);
		// take the team links from all of them
		let boxes = doc.querySelectorAll('div.box.matchinfo');
		if (!boxes.length)
			return;

		let links = Foxtrick.toArray(boxes)
			.flatMap(box => Foxtrick.toArray(box.querySelectorAll(module.TEAM_LINK_SELECTOR)))
			.filter(a => a.textContent.trim() && !a.dataset.ftShortName);

		for (let link of links) {
			let teamId = Foxtrick.util.id.getTeamIdFromUrl(link.href);
			if (!teamId)
				continue;

			link.dataset.ftShortName = '1';
			module.fetchShortNames(doc, [['teamId', teamId]], (shortNames) => {
				if (!link.isConnected)
					return;
				let shortName = shortNames.get(teamId);
				if (!shortName)
					return;

				// inline <br> + span instead of a block <div>: a block followed by HT's own
				// <br> (after the name / the ft-popup-span wrapper) produced an empty line
				let span = Foxtrick.createFeaturedElement(doc, module, 'span');
				span.className = 'ft-short-team-name';
				span.appendChild(doc.createElement('br'));
				span.appendChild(doc.createTextNode(`(${shortName})`));
				Foxtrick.stopObserver(doc);
				Foxtrick.insertAfter(span, link);
				Foxtrick.startObserver(doc);
			});
		}
	},
};
