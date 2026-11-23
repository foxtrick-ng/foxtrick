/**
 * supportership-expiration-date.js
 * supplies ways to figure out what 'xyz days left' actually means
 * like translating it to an actual date etc.
 * @author CatzHoek
 */

'use strict';

Foxtrick.modules['SupportershipExpirationDate'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.SHORTCUTS_AND_TWEAKS,
	PAGES: ['dashboard', 'office'],

	/**
	 * Office widget (Angular): HT shows the expiration date ('expires: <date>'),
	 * add a sibling with the remaining day count and toggle between them.
	 * The original element is owned by Angular, so it is left in place.
	 * @param {document}    doc
	 * @param {HTMLElement} dateEl .tier-expiration
	 */
	handleWidget: async function(doc, dateEl) {
		const { MSECS_IN_DAY } = Foxtrick.util.time;

		let endDate = Foxtrick.util.time.getDateFromText(dateEl.textContent, undefined, true);
		if (!endDate)
			return;

		let now = Foxtrick.util.time.getDate(doc);
		if (!now) {
			Foxtrick.log('User time missing');
			return;
		}

		// count like HT's 'xyz days left' (old box, ArenaHub): without the expiration day
		Foxtrick.util.time.setMidnight(now);
		let days = Math.max(Math.round((endDate.getTime() - now.getTime()) / MSECS_IN_DAY) - 1, 0);

		// use the language HT renders this page in: after switching language
		// (e.g. Language Switcher widget) content l10n still holds the previous one
		let metaLang = Foxtrick.modules.ReadHtPrefs.readLanguageFromMetaTag(doc);
		let locale = metaLang && Foxtrick.L10n.htMapping[metaLang] ||
			Foxtrick.Prefs.getString('htLanguage');

		let [daysWord, showDays, showDate] = await Promise.all([
			Foxtrick.L10n.getStringInLocale('datetimestrings.days', locale, days),
			Foxtrick.L10n.getStringInLocale('SupportershipExpirationDate.showRemainingDayCount', locale),
			Foxtrick.L10n.getStringInLocale('SupportershipExpirationDate.showExpirationDate', locale),
		]);

		// Angular may have re-rendered the widget while waiting for l10n
		if (!dateEl.isConnected)
			return;

		// shallow clone keeps Angular's scoped-style attribute and classes
		let daysEl = /** @type {HTMLElement} */ (dateEl.cloneNode(false));
		daysEl.textContent = days + ' ' + daysWord;
		Foxtrick.addClass(daysEl, 'hidden');

		dateEl.title = showDays;
		daysEl.title = showDate;
		dateEl.style.cursor = 'pointer';
		daysEl.style.cursor = 'pointer';

		dateEl.parentNode.insertBefore(daysEl, dateEl.nextSibling);

		// feature highlight
		Foxtrick.makeFeaturedElement(daysEl, this);

		let toggle = () => {
			Foxtrick.toggleClass(dateEl, 'hidden');
			Foxtrick.toggleClass(daysEl, 'hidden');
		};

		Foxtrick.onClick(dateEl, toggle);
		Foxtrick.onClick(daysEl, toggle);
	},

	/** @param {document} doc */
	run: function(doc) {
		if (!Foxtrick.util.layout.isSupporter(doc))
			return;

		// get the content, translate days to date
		let packageType;
		if (Foxtrick.isPage(doc, 'dashboard'))
			packageType = doc.getElementById('ctl00_ctl00_CPContent_CPSidebar_ucMyAccount_pnlSubscriptionPackageType');
		else
			packageType = doc.getElementById('ctl00_ctl00_CPContent_CPMain_ucMyOfficeCalendar_ucMyAccount_pnlSubscriptionPackageType');

		if (Foxtrick.isPage(doc, 'office')) {
			Foxtrick.util.officeWidgets.onWidget(doc, 'ht-widget-myaccount .tier-expiration',
				// async: errors are not caught by onWidget
				el => this.handleWidget(doc, el).catch(e => Foxtrick.log(e)));
		}

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
};
