/**
 * extended-club-details.js
 * Adds extra club information (short team names) to the manager, club and match pages
 * @author LA-maczek
 */

'use strict';

Foxtrick.modules.ExtendedClubDetails = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['managerPage', 'teamPage', 'match', 'matchesLive'],
	OPTIONS: ['ShortTeamName'],

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
				let shortName = xml.text('ShortTeamName', team);
				if (id && shortName) {
					shortNames.set(id, shortName);
					teamNames.set(id, xml.text('TeamName', team));
				}
			}
			if (shortNames.size)
				callback(shortNames, teamNames);
		});
	},

	/**
	 * Club page: append "(ShortTeamName)" after the team name in the page header and in div.teamNameTitle.
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

			let createSpan = () => {
				let span = Foxtrick.createFeaturedElement(doc, module, 'span');
				span.className = 'ft-short-team-name';
				span.textContent = ` (${shortName})`;
				return span;
			};

			let teamName = Foxtrick.Pages.All.getTeamNameFromBC(doc);

			// 1) team name link in the page header (breadcrumbs)
			let links = Foxtrick.Pages.All.getBreadCrumbs(doc) || [];
			let link = Foxtrick.nth(a => Foxtrick.util.id.getTeamIdFromUrl(a.href) === teamId, links);
			if (link && !link.dataset.ftShortName) {
				link.dataset.ftShortName = '1';
				Foxtrick.insertAfter(createSpan(), link);
			}

			// 2) team name in div.teamNameTitle
			let title = doc.querySelector('#mainBody div.teamNameTitle');
			if (title)
				module.addToTeamNameTitle(doc, title, teamName, shortName);
		});
	},

	/**
	 * Append a smaller "(ShortTeamName)" right after the team name inside an element
	 * (div.teamNameTitle on the club page, header div.boxHead on the manager page).
	 * @param {document} doc
	 * @param {Element}  title    element containing the team name
	 * @param {string}   teamName
	 * @param {string}   shortName
	 * @param {boolean}  [compact=true] smaller font + gap before the following country flag
	 *                   (club page); false = same font, no gap (manager page header)
	 */
	addToTeamNameTitle: function(doc, title, teamName, shortName, compact = true) {
		const module = this;

		if (title.dataset.ftShortName)
			return;
		title.dataset.ftShortName = '1';

		// HT styles <span>s inside .teamNameTitle (they changed size/position of our
		// span and of a wrapper span), so use an unstyled <small> right after the name
		let walker = doc.createTreeWalker(title, NodeFilter.SHOW_TEXT);
		let nameNode = null;
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			if (teamName ? n.textContent.includes(teamName) : n.textContent.trim()) {
				nameNode = n;
				break;
			}
		}

		let small = Foxtrick.createFeaturedElement(doc, module, 'small');
		small.className = 'ft-short-team-name';
		small.textContent = ` (${shortName})`;
		Object.assign(small.style, {
			fontSize: compact ? '0.75em' : 'inherit',
			display: 'inline',
			verticalAlign: 'baseline',
			position: 'static',
			float: 'none',
			// keep distance from the country flag that follows the name
			marginRight: compact ? '0.5em' : '0',
		});
		if (nameNode)
			Foxtrick.insertAfter(small, nameNode);
		else
			title.appendChild(small);
	},

	/**
	 * Manager page: append "(ShortTeamName)" after each team name owned by the manager
	 * (team links and the page header box "TeamName » ManagerName").
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

			// main page header box "TeamName » ManagerName" (div.boxHead outside #mainBody),
			// same presentation as on the club page. Sidebar boxes (team menu) are skipped:
			// only the header with the "»" separator is used.
			// Match by team name, longest first (one name may contain another).
			let byLength = [...teamNames.entries()].sort((a, b) => b[1].length - a[1].length);
			let header = Foxtrick.nth(el => el.textContent.includes('»'),
				doc.querySelectorAll('div.boxHead'));
			if (header) {
				let text = header.textContent.split('»')[0];
				let match = byLength.find(([, name]) => name && text.includes(name));
				if (match)
					module.addToTeamNameTitle(doc, header, match[1], shortNames.get(match[0]), false);
			}

			let links = main.querySelectorAll('a[href*="/Club/?TeamID="], a[href*="/Club/Default.aspx?TeamID="]');
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
				Foxtrick.stopObserver(doc);
				Foxtrick.insertAfter(span, link);
				Foxtrick.startObserver(doc);
			}

			Foxtrick.startObserver(doc);
		});
	},

	/**
	 * Match / Live page: show "(ShortTeamName)" on its own line under each team name in div.box.matchinfo.
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

		let links = Foxtrick.toArray(boxes).flatMap(box => Foxtrick.toArray(box.querySelectorAll('a[href*="/Club/?TeamID="], a[href*="/Club/Default.aspx?TeamID="]')))
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
