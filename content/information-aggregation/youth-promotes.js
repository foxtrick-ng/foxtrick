/**
 * youth-promotes.js
 * Shows days to promote a youth player
 * @author: smates, ryanli, LA-MJ
 */

'use strict';

Foxtrick.modules.YouthPromotes = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['youthPlayerDetails'],

	/** @param {document} doc */
	run: function(doc) {
		const module = this;
		if (Foxtrick.Pages.YouthPlayer.wasFired(doc))
			return;

		const DAYS_IN_SEASON = Foxtrick.util.time.DAYS_IN_SEASON;
		const MSECS_IN_DAY = Foxtrick.util.time.MSECS_IN_DAY;

		const now = Foxtrick.util.time.getDate(doc);
		if (!now) {
			Foxtrick.log('User time missing');
			return;
		}

		const promoDate = Foxtrick.Pages.YouthPlayer.getPromotionDate(doc);
		if (!promoDate)
			return;

		let birthdayCell = doc.querySelector('#mainBody div.byline');

		let promotion = doc.createDocumentFragment();
		let promotionCounter = Foxtrick.createFeaturedElement(doc, module, 'p');
		promotion.appendChild(promotionCounter);

		if (promoDate > now) { // you have to wait to promote
			let date = Foxtrick.util.time.buildDate(promoDate);
			let daysToPromote = Math.ceil((promoDate.getTime() - now.getTime()) / MSECS_IN_DAY);
			const weekAndSeasonToPromote = calculateWeekAndSeason(promoDate)
			let message = Foxtrick.L10n.getString('YouthPromotes.future', daysToPromote);
			message = message
				.replace(/%1/, daysToPromote.toString())
				.replace(/%2/, date)
				.replace(/%3/,`${weekAndSeasonToPromote.week}/${weekAndSeasonToPromote.season}`);
			promotionCounter.textContent = message;

			let age = Foxtrick.Pages.Player.getAge(doc);
			if (!age)
				return;

			let days = age.years * DAYS_IN_SEASON + age.days + daysToPromote;

			let years = Foxtrick.Math.div(days, DAYS_IN_SEASON);
			let yearsL10n = Foxtrick.L10n.getString('datetimestrings.years', years);
			let yearsString = `${years} ${yearsL10n}`;

			days %= DAYS_IN_SEASON;
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
 * @param {Date} date
 */
function calculateWeekAndSeason(date) {
  const REFERENCE = {
    week: 1,
    season: 1,
    date: new Date("1997-09-27"),
  };

  const WEEKS_IN_SEASON = 16;
  const MS_IN_WEEK = 1000 * 60 * 60 * 24 * 7;
  
  function getWeek(elapsedWeeks) {
      const week = (REFERENCE.week + Math.floor(elapsedWeeks)) % WEEKS_IN_SEASON
      return  (week <= 0 ? WEEKS_IN_SEASON : 0) + (week !== 0 ? week : 0)
  }

  const elapsedWeeks = (date.getTime() - REFERENCE.date.getTime()) / MS_IN_WEEK;
  const completedSeasons = Math.floor(elapsedWeeks / WEEKS_IN_SEASON);
  const season = REFERENCE.season + completedSeasons;

  return {
      week: getWeek(elapsedWeeks),
      season
  }
}
