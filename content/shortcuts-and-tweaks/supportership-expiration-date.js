/**
 * supportership-expiration-date.js
 * supplies ways to figure out what 'xyz days left' actually means
 * like translating it to an actual date etc.
 * @author CatzHoek
 */

'use strict';

Foxtrick.modules['SupportershipExpirationDate'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.SHORTCUTS_AND_TWEAKS,
	PAGES: ['dashboard', 'office', 'arenaHub'],

	/** @param {document} doc */
	run: function(doc) {
		if (!Foxtrick.util.layout.isSupporter(doc))
			return;

		if (Foxtrick.isPage(doc, 'arenaHub')) {
			this.runArenaHub(doc);
			return;
		}

		// get the content, translate days to date
		let packageType;
		if (Foxtrick.isPage(doc, 'dashboard'))
			packageType = doc.getElementById('ctl00_ctl00_CPContent_CPSidebar_ucMyAccount_pnlSubscriptionPackageType');
		else
			packageType = doc.getElementById('ctl00_ctl00_CPContent_CPMain_ucMyOfficeCalendar_ucMyAccount_pnlSubscriptionPackageType');

		if (!packageType)
			return;

		let box = packageType.closest('.sidebarBox');

		/** @type {HTMLElement} */
		let container;
		if (Foxtrick.isPage(doc, 'dashboard'))
			container = box.querySelector('#ctl00_ctl00_CPContent_CPSidebar_ucMyAccount_pnlSupporter');
		else
			container = box.querySelector('#ctl00_ctl00_CPContent_CPMain_ucMyOfficeCalendar_ucMyAccount_pnlSupporter');
		if (!container)
			return;

		// feature highlight
		Foxtrick.makeFeaturedElement(container, this);

		let dMatch = container.textContent.match(/\d+/);
		let days = parseInt(dMatch.toString(), 10);
		let now = Foxtrick.util.time.getDate(doc);
		if (!now) {
			Foxtrick.log('User time missing');
			return;
		}

		let endDate = Foxtrick.util.time.addDaysToDate(now, days);

		// get date in localized/correct format
		let printDate = Foxtrick.util.time.buildDate(endDate, { showTime: false });
		let newText = doc.createTextNode(printDate);

		// grab original text
		let img = container.querySelector('img');
		let prevText = img.nextSibling;

		// put text in containers
		let prevContainer = doc.createElement('div');
		let newContainer = doc.createElement('div');
		prevContainer.appendChild(prevText);
		newContainer.appendChild(newText);
		prevContainer.id = 'ft-supportershipexpirationdate-days';
		newContainer.id = 'ft-supportershipexpirationdate-date';

		// default visibility
		Foxtrick.addClass(newContainer, 'hidden');

		container.appendChild(prevContainer);
		container.appendChild(newContainer);

		// don't wanna have to create a css for that
		prevContainer.setAttribute('style', 'cursor:pointer;');
		newContainer.setAttribute('style', 'cursor:pointer;');

		// title l10n
		prevContainer.title =
			Foxtrick.L10n.getString('SupportershipExpirationDate.showExpirationDate');
		newContainer.title =
			Foxtrick.L10n.getString('SupportershipExpirationDate.showRemainingDayCount');

		// listener to switch
		var toggle = () => {
			let days = doc.getElementById('ft-supportershipexpirationdate-days');
			let date = doc.getElementById('ft-supportershipexpirationdate-date');
			Foxtrick.toggleClass(days, 'hidden');
			Foxtrick.toggleClass(date, 'hidden');
		};

		Foxtrick.onClick(prevContainer, toggle);
		Foxtrick.onClick(newContainer, toggle);
	},

	/**
	 * ArenaHub is an Angular page: the My Account box has no ids.
	 * Structure: div.myAccountCounter > … div.flex-grow > img + span('xyz days left').
	 * The span is owned by Angular, so we leave it in place and add a sibling.
	 * @param {document} doc
	 */
	runArenaHub: function(doc) {
		const DATE_ID = 'ft-supportershipexpirationdate-date';
		if (doc.getElementById(DATE_ID))
			return;

		let counter = doc.querySelector('.myAccountCounter .flex-grow');
		if (!counter)
			return;

		/** @type {HTMLElement} */
		let daysEl = counter.querySelector('img + span');
		if (!daysEl)
			return;

		let dMatch = daysEl.textContent.match(/\d+/);
		if (!dMatch)
			return;

		let days = parseInt(dMatch[0], 10);
		let now = Foxtrick.util.time.getDate(doc);
		if (!now) {
			Foxtrick.log('User time missing');
			return;
		}

		let endDate = Foxtrick.util.time.addDaysToDate(now, days);
		let printDate = Foxtrick.util.time.buildDate(endDate, { showTime: false });

		let dateEl = Foxtrick.createFeaturedElement(doc, this, 'span');
		dateEl.id = DATE_ID;
		dateEl.textContent = printDate;
		dateEl.title = Foxtrick.L10n.getString('SupportershipExpirationDate.showRemainingDayCount');
		dateEl.style.cursor = 'pointer';
		Foxtrick.addClass(dateEl, 'hidden');

		daysEl.title = Foxtrick.L10n.getString('SupportershipExpirationDate.showExpirationDate');
		daysEl.style.cursor = 'pointer';

		daysEl.parentNode.insertBefore(dateEl, daysEl.nextSibling);

		let toggle = () => {
			Foxtrick.toggleClass(daysEl, 'hidden');
			Foxtrick.toggleClass(dateEl, 'hidden');
		};

		Foxtrick.onClick(daysEl, toggle);
		Foxtrick.onClick(dateEl, toggle);
	},
};
