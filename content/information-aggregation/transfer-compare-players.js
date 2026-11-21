/**
 * transfer-compare-players.js
 * Show some math in player transfer compare section.
 * @author bummerland, tasosventouris, LA-MJ
 */

'use strict';

/* eslint-disable complexity, indent */

Foxtrick.modules.TransferComparePlayers = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['playerDetails', 'transfersPlayer'],
	OPTIONS: ['ShowProfit'],

	// CSS: Foxtrick.InternalPath + 'resources/css/transfercompareplayers.css',

	/** @param {document} doc */
	run: function(doc) {
		const module = this;
		const isDetails = Foxtrick.isPage(doc, 'playerDetails');
		const isHistory = Foxtrick.isPage(doc, 'transfersPlayer');

		const MSECS_IN_DAY = Foxtrick.util.time.MSECS_IN_DAY;
		const DAYS_IN_SEASON = Foxtrick.util.time.DAYS_IN_SEASON;

		const AGE_TITLE = Foxtrick.L10n.getString('TransferComparePlayers.transferAge');

		if (isHistory || isDetails) {
			if (!Foxtrick.Prefs.isModuleOptionEnabled('TransferComparePlayers', 'ShowProfit'))
				return;

			/** @type {HTMLTableElement} */
			var hTable;
			if (isDetails) {
				hTable = doc.querySelector('#transferHistory > table');
				if (!hTable)
					return;
			}
			else if (isHistory) {
				hTable = doc.querySelector('#mainBody > table');
				if (!hTable)
					return;

				let headerRow = hTable.rows[0];
				if (headerRow.cells.length < 2)
					return;
			}

			var ct = hTable.rows.length;

			/**
			 * Add price difference to transfer rows.
			 * Uses only data present in the page table (prices and dates).
			 */
			const addDifference = () => {
				// need at least two transfers to compare
				// eslint-disable-next-line no-magic-numbers
				if (ct < 3)
					return;

				let currCell = hTable.rows[1].cells[3];
				let currMatch = currCell && currCell.firstChild &&
					currCell.firstChild.textContent.match(/\D+$/);
				if (!currMatch) {
					Foxtrick.log('TransferComparePlayers: currency not found');
					return;
				}

				const DIFF_TMPL = '{sign}{val} {curr} ({sign}{pctg} %)';
				const SEASON_TMPL = '{sign}{season} {curr} {per}';

				var diff = {
					curr: currMatch[0].trim(),
					per: Foxtrick.L10n.getString('ExtendedPlayerDetails.perseason'),
				};

				if (isHistory) {
					let headerRow = hTable.rows[0];
					let diffTh = Foxtrick.createFeaturedElement(doc, module, 'th');
					diffTh.textContent = Foxtrick.L10n.getString('TransferComparePlayers.difference');
					Foxtrick.addClass(diffTh, 'center');
					headerRow.insertBefore(diffTh, headerRow.cells[4]);
				}

				for (let i = 1; i < ct; i++) {
					let transferRow = hTable.rows[i];
					let prevRow = hTable.rows[i + 1];

					// always insert the cell to keep columns aligned
					let diffCell = isHistory ?
						// eslint-disable-next-line no-magic-numbers
						transferRow.insertCell(4) :
						doc.createElement('span');

					Foxtrick.makeFeaturedElement(diffCell, module);
					if (isHistory)
						Foxtrick.addClass(diffCell, 'center');

					if (typeof prevRow == 'undefined')
						break;

					let priceCell = isHistory ? transferRow.cells[3] : [...transferRow.cells].pop();
					let prevPriceCell = isHistory ? prevRow.cells[3] : [...prevRow.cells].pop();
					if (!priceCell || !priceCell.firstChild ||
					    !prevPriceCell || !prevPriceCell.firstChild)
						continue;

					let price = Foxtrick.trimnum(priceCell.firstChild.textContent);
					let prevPrice = Foxtrick.trimnum(prevPriceCell.firstChild.textContent);
					if (!Number.isFinite(price) || !Number.isFinite(prevPrice))
						continue;

					if (price == prevPrice) {
						Foxtrick.addClass(diffCell, 'ft-player-transfer-history');
						continue;
					}

					let positive = price > prevPrice;
					Foxtrick.addClass(diffCell,
						'ft-player-transfer-history ' + (positive ? 'positive' : 'negative'));
					diff.sign = positive ? '+' : '-';

					let val = Math.abs(price - prevPrice);
					diff.val = Foxtrick.formatNumber(val, '\u00a0');

					let span = doc.createElement('span');
					if (prevPrice > 0) {
						diff.pctg = Math.round(val / prevPrice * 100);
						span.textContent = Foxtrick.format(DIFF_TMPL, diff);
					}
					else {
						span.textContent = `${diff.sign}${diff.val} ${diff.curr}`;
					}
					diffCell.appendChild(span);

					// README: user time only => +-1 day
					let trDate = Foxtrick.util.time.getDateFromText(transferRow.cells[0].textContent);
					let prevDate = Foxtrick.util.time.getDateFromText(prevRow.cells[0].textContent);
					let daysInClub = trDate && prevDate ?
						(trDate.getTime() - prevDate.getTime()) / MSECS_IN_DAY :
						0;

					// per-season value only with valid dates and at least one day in club
					if (daysInClub >= 1) {
						let season = Math.round(val / daysInClub * DAYS_IN_SEASON);
						diff.season = Foxtrick.formatNumber(season, '\u00a0');

						diffCell.appendChild(doc.createElement('br'));
						let seasonSpan = doc.createElement('span');
						seasonSpan.textContent = Foxtrick.format(SEASON_TMPL, diff);
						diffCell.appendChild(seasonSpan);
					}

					if (isDetails) {
						priceCell.appendChild(doc.createElement('br'));
						priceCell.appendChild(diffCell);
					}
				}
			};

			addDifference();

			// player age at transfer time requires CHPP data (history page only)
			if (!isHistory || ct < 2)
				return;

			var playerId = Foxtrick.Pages.All.getId(doc);

			/** @type {CHPPParams} */
			var detailsArgs = [
				['file', 'playerdetails'],
				['version', '2.1'],
				['playerId', playerId],
			];
			Foxtrick.util.api.retrieve(doc, detailsArgs, { cache: 'session' }, (xml, errorText) => {
				if (!xml || errorText) {
					Foxtrick.log(errorText);
					return;
				}

				var age = xml.num('Age');
				var agedays = xml.num('AgeDays');
				var fetchDate = xml.date('FetchedDate');

				// add Age column only when player age data is available
				if (!Number.isFinite(age) || !Number.isFinite(agedays) || !fetchDate)
					return;

				let headerRow = hTable.rows[0];
				let ageTh = Foxtrick.createFeaturedElement(doc, module, 'th');
				ageTh.textContent = Foxtrick.L10n.getString('Age.abbr');
				ageTh.title = Foxtrick.L10n.getString('Age');
				headerRow.insertBefore(ageTh, headerRow.cells[1]);

				for (let i = 1; i < ct; i++) {
					let transferRow = hTable.rows[i];

					// always insert the cell to keep columns aligned
					let ageCell = transferRow.insertCell(1);
					ageCell.textContent = '';
					Foxtrick.makeFeaturedElement(ageCell, module);

					// README: user time only => +-1 day
					let trDate = Foxtrick.util.time.getDateFromText(transferRow.cells[0].textContent);
					if (!trDate)
						continue;

					let days = age * DAYS_IN_SEASON + agedays;
					let diffDays = (fetchDate.getTime() - trDate.getTime()) / MSECS_IN_DAY;
					days -= Math.round(diffDays);
					let years = Foxtrick.Math.div(days, DAYS_IN_SEASON);
					days %= DAYS_IN_SEASON;

					let ageSpan = doc.createElement('span');
					ageSpan.textContent = years + '.' + days;
					ageSpan.title = AGE_TITLE;
					ageCell.appendChild(ageSpan);
				}
			});
		}
	},

};
