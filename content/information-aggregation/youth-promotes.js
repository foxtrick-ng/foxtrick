/**
 * youth-promotes.js
 * Shows days to promote a youth player
 * @author: smates, ryanli, LA-MJ
 */

'use strict';

Foxtrick.modules.YouthPromotes = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['youthPlayerDetails'],

	/**
	 * @param {document} doc
	 * @returns {?YouthPromotionInfo}
	 */
	getPromotionInfo: function(doc) {
		const DAYS_IN_SEASON = Foxtrick.util.time.DAYS_IN_SEASON;
		const MSECS_IN_DAY = Foxtrick.util.time.MSECS_IN_DAY;

		const promoDate = Foxtrick.Pages.YouthPlayer.getPromotionDate(doc);
		if (!promoDate)
			return null;

		const htNow = Foxtrick.util.time.getHTDate(doc);
		const promoHT = Foxtrick.util.time.toHT(doc, promoDate);
		if (!htNow || !promoHT)
			return null;

		Foxtrick.util.time.setMidnight(htNow);
		Foxtrick.util.time.setMidnight(promoHT);

		if (htNow >= promoHT)
			return {status: 'today'};

		const promotionDate = Foxtrick.util.time.buildDate(promoDate);
		const daysToPromote = Math.ceil((promoHT.getTime() - htNow.getTime()) / MSECS_IN_DAY);
		const ageDaysToPromote = Math.round((promoHT.getTime() - htNow.getTime()) / MSECS_IN_DAY);

		const age = Foxtrick.Pages.Player.getAge(doc);
		if (!age)
			return null;

		let totalDays = age.years * DAYS_IN_SEASON + age.days + ageDaysToPromote;
		let years = Foxtrick.Math.div(totalDays, DAYS_IN_SEASON);
		totalDays %= DAYS_IN_SEASON;
		let days = totalDays;

		return {
			status: 'future',
			daysToPromote: daysToPromote,
			promotionDate: promotionDate,
			promotionAge: {years: years, days: days},
		};
	},

	/** @param {document} doc */
	run: function(doc) {
		const module = this;
		if (Foxtrick.Pages.YouthPlayer.wasFired(doc))
			return;

		const promotionInfo = module.getPromotionInfo(doc);
		if (!promotionInfo)
			return;

		let birthdayCell = doc.querySelector('#mainBody div.byline');

		let promotion = doc.createDocumentFragment();
		let promotionCounter = Foxtrick.createFeaturedElement(doc, module, 'p');
		promotion.appendChild(promotionCounter);

		if (promotionInfo.status === 'future') { // you have to wait to promote
			let message = Foxtrick.L10n.getString('YouthPromotes.future', promotionInfo.daysToPromote);
			message = message.replace(/%1/, promotionInfo.daysToPromote.toString())
				.replace(/%2/, promotionInfo.promotionDate);
			promotionCounter.textContent = message;

			let years = promotionInfo.promotionAge.years;
			let yearsL10n = Foxtrick.L10n.getString('datetimestrings.years', years);
			let yearsString = `${years} ${yearsL10n}`;

			let days = promotionInfo.promotionAge.days;
			let daysL10n = Foxtrick.L10n.getString('datetimestrings.days', days);
			let daysString = `${days} ${daysL10n}`;

			let yearsDays = Foxtrick.L10n.getString('datetimestrings.years_and_days');
			yearsDays = yearsDays.replace('%1', yearsString).replace('%2', daysString);
			let old = Foxtrick.L10n.getString('YouthPromotes.age').replace('%1', yearsDays);

			let promotionAge = Foxtrick.createFeaturedElement(doc, module, 'p');
			promotionAge.textContent = old;
			promotion.appendChild(promotionAge);
		}
		else {
			// can be promoted already
			promotionCounter.textContent = Foxtrick.L10n.getString('YouthPromotes.today');
		}

		birthdayCell.appendChild(promotion);

	},
};

/**
 * @typedef YouthPromotionInfo
 * @property {'today'|'future'} status
 * @property {number} [daysToPromote]
 * @property {string} [promotionDate]
 * @property {{years:number, days:number}} [promotionAge]
 */
