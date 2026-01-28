/**
 * copy-player-ad.js
 * Copies a player ad to the clipboard
 * @author larsw84, ryanli, UnnecessaryDave
 */

'use strict';

Foxtrick.modules.CopyPlayerAd = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.SHORTCUTS_AND_TWEAKS,
	PAGES: ['playerDetails', 'youthPlayerDetails'],
	OPTIONS: [ ['UseOldBehaviour', 'Sorted', 'NonTableStyle'],
		'mod-birthday',
		'mod-u21-eligibility',
		'mod-wage-bonus-season',
		'mod-split-attributes',
		'mod-htms',
		'mod-best-position',
		'mod-deadline-ends-in',
		'mod-youth-promotes',
		'mod-hyc-specialty',
		'mod-hyc-skills',
	],
	CSS: Foxtrick.InternalPath + 'resources/css/copy-player-ad.css',
	OPTION_FUNC: function(doc) {
		var init = function() {
			var useOld = doc.getElementById('pref-CopyPlayerAd-UseOldBehaviour');
			if (!useOld)
				return;

			var modInputs = doc.querySelectorAll('#pref-CopyPlayerAd-options input[option^="mod-"]');
			if (!modInputs.length)
				return;

			var toggle = function() {
				var hide = useOld.checked;
				for (var i = 0; i < modInputs.length; ++i) {
					var input = modInputs[i];
					var item = input;
					while (item && item.nodeName.toLowerCase() !== 'li')
						item = item.parentNode;

					if (!item)
						continue;

					if (hide)
						Foxtrick.addClass(item, 'hidden');
					else
						Foxtrick.removeClass(item, 'hidden');
				}
			};

			Foxtrick.onClick(useOld, toggle);
			toggle();
		};

		//FIXME: This is a lazy (and unreliable) way to get init
		// to run after prefs has created the module div for us.
		// Refactor - generate module div from OPTIONS:
		setTimeout(init);
	},

	/** @param {document} doc */
	run: function(doc) {
		// skip non-existent and free agents
		let header = Foxtrick.Pages.All.getMainHeader(doc);
		let id = Foxtrick.util.id.findTeamId(header);
		if (!id)
			return;

		if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'UseOldBehaviour')
		   || Foxtrick.Pages.All.isLegacy(doc)) {
			let button = Foxtrick.util.copyButton.add(doc, Foxtrick.L10n.getString('copy.playerad'));
			if (button) {
				Foxtrick.addClass(button, 'ft-copy-player-ad');
				Foxtrick.onClick(button, this.createPlayerAd);
			}
		} else {
			const copyWrapper = doc.querySelector('.copyWrapper');
			void this.updateHtAd(doc, copyWrapper);
		}
	},

	/**
	 * @param {Document} doc
	 * @param {Element} el - Element containing hattrick's copy-player-ad elements
	 * @returns {Promise<void>}
	 */
	updateHtAd: async function(doc, el) {
		/**
		 * Ad modifiers.
		 *
		 * Applied line by line to HT ad.
		 * exec fn called if the line matches lineNumber or regex.
		 *
		 * Note:
		 * - If both regex and lineNumber are specified, both must match.
		 * - Cannot match on lineNumber alone after line 8 because of specialty.
		 * - If replace type modifiers match they will override any prepend/append.
		 *
		 * @type {CopyPlayerAdModifier[]}
		 */
		let modifiers = [
			{
				name: 'birthday',
				regex: '^\\d\\d?.+\\d\\d?.+:.*$',
				type: 'append',
				exec: async (str, data) => {
					const match = str.match('^\\d\\d?.+\\d\\d?.+:(.*)$');

					if (match?.[1]) {
						const deadline = Foxtrick.util.time.getDateFromText(match[1].trim());
						if (deadline) {
							// ht (week/season)
							let weekOffsetText =
								Foxtrick.Prefs.getString(`HTDateFormat.FirstDayOfWeekOffset_text`);

							const WEEK_OFFSET = parseInt(weekOffsetText, 10) || 0;
							const USE_LOCAL = Foxtrick.Prefs.isModuleOptionEnabled('HTDateFormat', 'LocalSeason');

							const { week, season } =
								Foxtrick.util.time.gregorianToHT(deadline, WEEK_OFFSET, USE_LOCAL);

							// time remaining
							const MSECS = Foxtrick.util.time.MSECS_IN_SEC;

							const userTime = Foxtrick.util.time.getDate(doc).getTime();
							let timeRemaining = Math.floor((deadline.getTime() - userTime) / MSECS);
							let span = await Foxtrick.util.time.timeDiffToSpan(doc, timeRemaining, { useDHM: false, locale: data.locale });

							return ` (${week}/${season}) (${span.textContent})`;
						}
					}
				},
			},
			{
				name: 'youth-promotes',
				playerType: 'youth',
				regex: '^\\d\\d?.+\\d\\d?.+:.*$',
				type: 'after',
				exec: async (str, data) => {
					const promotionInfo = Foxtrick.modules.YouthPromotes.getPromotionInfo(doc);
					if (promotionInfo.status === 'future') {
						let retVal = await Foxtrick.L10n.getStringInLocale('YouthPromotes.future', data.locale, promotionInfo.daysToPromote);
						retVal = retVal.replace(/%1/, promotionInfo.daysToPromote.toString())
							.replace(/%2/, promotionInfo.promotionDate);

						retVal += '[br]';

						let years = promotionInfo.promotionAge.years;
						let yearsL10n = await Foxtrick.L10n.getStringInLocale('datetimestrings.years', data.locale, years);
						let yearsString = `${years} ${yearsL10n}`;

						let days = promotionInfo.promotionAge.days;
						let daysL10n = await Foxtrick.L10n.getStringInLocale('datetimestrings.days', data.locale, days);
						let daysString = `${days} ${daysL10n}`;

						let yearsDays = await Foxtrick.L10n.getStringInLocale('datetimestrings.years_and_days', data.locale);
						yearsDays = yearsDays.replace('%1', yearsString).replace('%2', daysString);
						retVal += (await Foxtrick.L10n.getStringInLocale('YouthPromotes.age', data.locale)).replace('%1', yearsDays);

						return retVal;
					} else {
						return await Foxtrick.L10n.getStringInLocale('YouthPromotes.today', data.locale);
					}
				},
			},
			{
				name: 'u21-eligibility',
				regex: '^\\d\\d?.+\\d\\d?.+:.*$',
				type: 'after',
				exec: async (str, data) => {
					const module = Foxtrick.modules.U21LastMatch;
					let age = Foxtrick.Pages.Player.getAge(doc);
					if (!age || age.years > 21)
						return;

					const TITLE_STR = await Foxtrick.L10n.getStringInLocale('U21LastMatch.title', data.locale);
					const WC_STR = await Foxtrick.L10n.getStringInLocale('U21LastMatch.worldcup', data.locale);
					const TMPL_STR = await Foxtrick.L10n.getStringInLocale('U21LastMatch.templateWithoutTable', data.locale);

					let { worldCupNumber, lastMatch,} =
						await module.calculate(doc, age, data.locale);

					let wcNum = Foxtrick.decToRoman(worldCupNumber);

					let text = TMPL_STR;
					text = text.replace(/%1/, TITLE_STR);
					text = text.replace(/%2/, WC_STR);
					text = text.replace(/%3/, wcNum);
					text = text.replace(/%4/, lastMatch);
					return text;
				},
			},
			{
				name: 'wage-bonus-season',
				playerType: 'senior',
				regex: '^.+:\\s?\\[money\\].+\\[/money\\]/.+',
				type: 'append',
				exec: async (str, data) => {
					const match = str.match('^.+:\\s?\\[money\\](.+)\\[/money\\]/.+');
					const wageCell = Foxtrick.Pages.Player.getWageCell(doc);
					if (!wageCell || match?.length != 2)
						return;

					let retVal = '';
					const wage = parseInt(match[1].trim(), 10);
					const withoutBonus = Math.round(wage / 1.2);

					if (wageCell.querySelector('#ft_bonuswage') ||  wageCell.querySelector('span[title]')) {
						retVal += ` ([money]${withoutBonus}[/money] +20%)`;
					}

					let season = await Foxtrick.L10n.getStringInLocale('ExtendedPlayerDetails.perseason', data.locale);
					retVal += ` ([money]${wage * 16}[/money]${season})`;

					return retVal;
				},
			},
			{
				name: 'split-attributes',
				playerType: 'senior',
				regex: '^.+\\..+\\..+\\.',
				type: 'replace',
				exec: (str) => {
					const match = str.match('^(.+\\.)\\s?(.+\\..+\\.)');
					if (match?.length == 3)
						return `${match[1]}[br]${match[2]}`;
				},
			},
			{
				name: 'hyc-specialty',
				playerType: 'youth',
				regex: '^[^\\d].+:.+\\d\\d?.+\\d\\d?',
				type: 'after',
				exec: async (str, data) => {
					/** @type {HYPlayer} */
					let player = getHyPlayer(data.playerId);
					if (!player)
						return;

					const htSpecSelector = '#ctl00_ctl00_CPContent_CPMain_ucPlayerSkills_trSpeciality:not(:has(.ft-hy-spec))';
					if (player.speciality && !doc.querySelector(htSpecSelector)) {
						// player has a spec in hyc, but no spec displayed by ht
						const specText = await Foxtrick.L10n.getStringInLocale('Specialty', data.locale);
						const enSpec = Foxtrick.L10n.getEnglishSpecialtyFromNumber(player.speciality);
						const query = {
							category: 'specialties',
							filter: 'type',
							value: enSpec,
							property: 'value',
						};
						const specTypeText = Foxtrick.L10n.getHTLangProperty(query, data.locale);
						// const specTypeText = Foxtrick.L10n.htLanguagesJSON[data.locale]?.language?.specialties[player.speciality]?.value;
						return `${specText}: ${specTypeText}`;
					}
				}
			},
			{
				name: 'htms',
				playerType: 'senior',
				//match: 'TSI: \\d+', // can't use - 'TSI' string localised in some locales
				lineNumber: 7,
				type: 'after',
				exec: async (str, data) => {
					const module = Foxtrick.modules.HTMSPoints;

					let skills = /**@type {PlayerSkills}*/ (Foxtrick.Pages.Player.getSkills(doc));
					if (skills === null)
						return;

					let age = Foxtrick.Pages.Player.getAge(doc);
					if (!age)
						return;

					/** @type {HTMSSkills} */
					let def = Object.assign(age, skills);
					let [current, potential] = module.calc(def).map(String);
					let title = await Foxtrick.L10n.getStringInLocale('HTMSPoints', data.locale);
					let points= await Foxtrick.L10n.getStringInLocale('HTMSPoints.AbilityAndPotential', data.locale);
					points = points.replace(/%1/, current).replace(/%2/, potential);
					return `${title} [b]${points}[/b]`;
				}
			},
			{
				name: 'best-position',
				playerType: 'senior',
				//match: 'TSI: \\d+', // can't use - 'TSI' string localised in some locales
				lineNumber: 7,
				type: 'after',
				exec: async (str, data) => {
					const skills = /**@type {PlayerSkills}*/(Foxtrick.Pages.Player.getSkills(doc));
					if (!skills)
						return;

					const attrs = Foxtrick.Pages.Player.getAttributes(doc);
					//@ts-expect-error
					const contributions = Foxtrick.Pages.Player.getContributions(skills, attrs);

					const best = Foxtrick.Pages.Player.getBestPosition(contributions);
					if (best.position) {
						const title = await Foxtrick.L10n.getStringInLocale('BestPlayerPosition.title', data.locale);
						const str = await Foxtrick.L10n.getStringInLocale(best.position + 'Position', data.locale);
						return `${title} ${str} (${best.value.toFixed(2)})`;
					}
				},
			},
			{
				name: 'hyc-skills',
				playerType: 'youth',
				regex: '^\\[table\\].+\\[/table\\]$',
				type: 'replace',
				exec: async (str, data) => {
					/** @type {HYPlayer} */
					let player = getHyPlayer(data.playerId);
					if (!player)
						return;

					const hySkills = player.skills;
					// hyc skill id mapping
					const skillMap = [
						6,  // 'keeper'
						8,  // 'defending'
						3,  // 'playmaking'
						4,  // 'winger'
						7,  // 'passing'
						5,  // 'scoring'
						9,  // 'setPieces'
					];
					const unknownChar = await Foxtrick.L10n.getStringInLocale('status.unknown.abbr', data.locale);

					let inputRows = str.split('[tr]');
					inputRows.shift(); // when split on '[tr]' - first entry doesn't contain a skill
					if (inputRows.length != 7)
						return; // unexpected table format

					/** @type {HTYouthSkill[]} */
					let inputSkills = [];
					let regex = new RegExp('\\[th\\](.+)\\[/th\\]\\[td\\](.+?)(\\((.)/(.)\\))?\\[/td\\]', '');
					let matchKeys = ['matched', 'name', 'denomStr', 'valuesStr', 'ability', 'potential'];
					// parse each table row
					for (let i=0; i < 7; ++i) {
						let row = inputRows[i];
						const matches = row.match(regex);

						/** @type {HTYouthSkill} */
						let skill = {};
						matchKeys.forEach((key, index) => {
							skill[key] = matches[index];
						});

						if (skill.denomStr) {
							// strip out ht bold tags - top 3 skills will be bolded
							skill.denomStr = skill.denomStr
								.replaceAll('[b]', '')
								.replaceAll('[/b]', '');

							const denomSplit = skill.denomStr.split('/');
							if (denomSplit.length == 2) {
								skill.abilityDenom = denomSplit[0].trim();
								skill.potentialDenom = denomSplit[1].trim();
							} else {
								// skill 'unknown' in ht
								skill.abilityDenom = skill.denomStr.trim();
								skill.potentialDenom = skill.denomStr.trim();
							}
						}

						skill.hyIndex = skillMap[i];
						inputSkills[i] = skill;
					}

					// re-build table
					let output = '[table]';
					for (let skill of inputSkills) {
						/** @type {HYSkill} */
						const hySkill = hySkills[skill.hyIndex];
						output += `[tr][th]${skill.name}[/th]`;

						let [ability, potential] = [skill.ability, skill.potential];
						let isUnknown = !skill.valuesStr // nothing at all known about skill in ht

						if (hySkill) {
							if (hySkill.current)
								ability = hySkill.current.toString();

							if (hySkill.current_estimation)
								ability = '~ ' + hySkill.current_estimation.toString();

							if (hySkill.cap_maximal) {
								if (isUnknown)
									potential = '\u2264 ' + hySkill.cap_maximal; // <= x
								else
									potential = Math.floor(hySkill.cap_maximal).toString();
							}
						}

						let cellContent;
						if (isUnknown) {
							cellContent = `${skill.denomStr}`;
							if (potential)
								cellContent += ` (${potential})`;
						} else {
							if (!ability)
								ability = unknownChar;
							if (!potential)
								potential = unknownChar;
							cellContent = `${skill.abilityDenom} / ${skill.potentialDenom} (${ability} / ${potential})`;
						}

						if (hySkill && hySkill.top3)
							cellContent = `[b]${cellContent}[/b]`;
						if (hySkill && hySkill.maxed)
							cellContent = `[i][/i][i]${cellContent}[/i]`; // empty [i] used to set cell bg-color with css

						output += `[td]${cellContent}[/td][/tr]`;
					}

					// experience
					if (hySkills[10]) {
						let exp = (hySkills[10]);
						exp = Math.round(exp *10) / 10;

						let query = {
							category: 'skills',
							filter: 'type',
							value: 'Experience',
							property: 'value',
						};
						const expName =  Foxtrick.L10n.getHTLangProperty(query, data.locale);

						query = {
							category: 'levels',
							filter: 'value',
							value: Math.floor(exp).toString(),
							property: 'text',
						};
						const expDenom =  Foxtrick.L10n.getHTLangProperty(query, data.locale);

						output += `[tr][th]${expName}[/th][td]${expDenom} (~ ${exp})[/td][/tr]`;
					}

					output += '[/table]';
					return output;
				},
			},
			{
				name: 'deadline-ends-in',
				playerType: 'senior',
				regex: '^[^,]+: \\d',
				type: 'append',
				exec: async (str, data) => {
					const match = str.match('^[^,]+: (.*)$');

					if (match[1]) {
						const MSECS = Foxtrick.util.time.MSECS_IN_SEC;

						let deadline;
						// Ads don't seem to localise date formats, so we don't need the code
						// below. Just as well, as dateformats in worlddetails are wrong.
						//
						// if (data.leagueId) {
						// 	const dateFormat = Foxtrick.XMLData.League[data.leagueId].Country.DateFormat;
						// 	deadline = Foxtrick.util.time.getDateFromText(match[1], dateFormat);
						// } else
						// 	deadline = Foxtrick.util.time.getDateFromText(match[1])
						deadline = Foxtrick.util.time.getDateFromText(match[1].trim())

						if (deadline) {
							const userTime = Foxtrick.util.time.getDate(doc).getTime();
							let timeRemaining = Math.floor((deadline.getTime() - userTime) / MSECS);
							let span = await Foxtrick.util.time.timeDiffToSpan(doc, timeRemaining, { locale: data.locale });
							return ` (${span.textContent})`;
						}
					}
				},
			},
		];

		/**
		 * Cached hyc skills. Null if we can't access hyc.
		 * @type {?HYPlayers}
		 */
		let _hySkills;

		/**
		 * Connect to HYC and retrieve all youth player skills.
		 * @returns {Promise<HYPlayers>} - hyPlayers - undefined if no data for any reason
		 */
		const _hycInit = async function() {

			const disableAndExit = function() {
				if (_hySkills)
					_hySkills = null;
				return null;
			}

			if (_hySkills === null)
				return; // no HYC access, or an error occurred in a previous run

			let hyPerm = { origins: ['https://*.hattrick-youthclub.org/*'] };
			/** @type {HYPlayers} */
			let skills;

			let perm = await new Promise((resolve) => {
				Foxtrick.containsPermission(hyPerm, async perm => resolve(perm));
			});

			if (!perm)
				return disableAndExit(); // no browser {origins:} permission
			if (!(await Foxtrick.api.hy.isHYUser()))
				return disableAndExit(); // not an hyc user

			try {
				skills = await Foxtrick.api.hy.getYouthSkills();

			} catch (err) {
				_hySkills = null; // don't run again
				let { text, status } = err ||
					{ status: 0, text: `unknown error: ${typeof err}` };
				throw new Error(`Error: CopyPlayerAd - hycInit ${text} ${status}`);
			}

			_hySkills = skills;
			return _hySkills;
		}

		/**
		 * Get hyc skill info for a player.
		 * @param {number} id - playerId
		 * @returns {?HYPlayer}
		 */
		const getHyPlayer = function(id) {
			if (!_hySkills)
				return null;
			/** @type {HYPlayer} */
			const playerSkills = _hySkills[id];
			return playerSkills;
		}

		/**
		 * @param {Element}node - parent node
		 * @param {string} attr - element attribute to be updated
		 * @param {UpdateAttributeData} args - player and locale data
		 * @returns {Promise<void>}
		 */
		const updateAttribute = async function(node, attr, args) {
			if (!node || !args.locale)
				return;

			/** @type {CopyPlayerAdModifierData} */
			let data = {
				attrName: attr,
				lineNumber: undefined,
				modifier: undefined,
				...args,
			};

			const anchor = node.querySelector(`[${attr}]`)
			if (!anchor)
				return;

			let current = anchor.getAttribute(attr).split('[br]').map(s => s.trim());
			let updated = [];

			// keep track of modifiers that threw an exception
			// we skip them for subsequent lines
			let disabledModifiers = new Set();

			// iterate through each line of the ad
			for (let i = 0; i < current.length; ++i) {
				let currentLine = current[i];
				data.lineNumber = i;

				// filter array to only include modifiers that match on this line
				let matching = modifiers.filter(modifier => {
					if (disabledModifiers.has(modifier.name))
						return false;

					// if modifier.LineNumber and modifier.regex, both must match
					let matchedLineNumber = true;
					let matchedString = true;
					if (typeof modifier.lineNumber !== 'undefined' && modifier.lineNumber !== i)
						matchedLineNumber = false;
					if (typeof modifier.regex !== 'undefined' && !currentLine.match(modifier.regex))
						matchedString = false;

					return (matchedLineNumber && matchedString);
				});

				if (!matching.length) {
					// no matches for this line
					updated.push(currentLine);
					continue;
				}

				let output = {
					prepend: [],
					append: [],
					before: [],
					after: [],
					replace: [],
				};

				// call the exec function for each modifier
				for (let modifier of matching) {
					let text;
					data.modifier = modifier;
					if (modifier.exec) {
						try {
							text = await modifier.exec(currentLine, data);
							if (text)
								output[modifier.type].push(text);
						} catch (e) {
							Foxtrick.log(`Error: CopyPlayerAd modifier ${modifier.name}. Skipping further executions.`, e);
							disabledModifiers.add(modifier.name);  // ← CLEANER
						}
					}
				}

				// add modified strings to output
				if (output.prepend.length) {
					currentLine = output.prepend.join('') + currentLine;
				}
				if (output.append.length) {
					currentLine = currentLine + output.append.join('');
				}
				if (output.before.length) {
					for (let item of output.before)
						updated.push(item);
				}
				if (output.replace.length) {
					for (let item of output.replace)
						updated.push(item);
				} else {
					updated.push(currentLine);
				}
				if (output.after.length) {
					for (let item of output.after)
						updated.push(item);
				}
			}

			anchor.setAttribute(attr, updated.join('[br]'));
		};

		/**
		 * execution starts here
		 */
		if (!el)
			return;

		// player info
		/** @type {UpdateAttributeData} */
		let data = {
			playerId: Foxtrick.Pages.Player.getId(doc),
			isYouth: Foxtrick.Pages.Player.isYouth(doc),
			locale: null,
			leagueId: Foxtrick.Pages.Player.getNationalityId(doc),
		};
		let leagueLocale = null;
		if (data.leagueId)
			leagueLocale = await Foxtrick.L10n.getLocaleByLeagueId(data.leagueId);
		// user locale info
		const userLocale = Foxtrick.Prefs.getString('htLanguage');
		// everyone gets an english option
		let enLocale = 'en-GB';
		let enLeague = 2;
		if (userLocale === 'en-US') {
			// special case for en-US users
			enLocale = 'en-US';
			enLeague = 8;
		}

		// filter out modifiers that are disabled in prefs or do not apply
		modifiers = modifiers.filter(modifier => {
			if (!Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', `mod-${modifier.name}`))
				return false;

			if (typeof modifier.lineNumber === 'undefined' && typeof modifier.regex === 'undefined')
				return false;

			if (modifier.playerType === 'youth' && !data.isYouth)
				return false;
			if (modifier.playerType === 'senior' && data.isYouth)
				return false;

			return true;
		});
		if (modifiers.length == 0)
			return; // nothing to do

		// pull hyc data
		if (data.isYouth)
			await _hycInit();

		// apply FT presentation
		el.classList.add('ft-dummy');
		const menuEntries = el.querySelectorAll('li');
		for (let entry of menuEntries) {
			entry.classList.add('ft-copy-player-ad');
		}

		// finally, we update each of the data attributes
		Promise.all([
			updateAttribute(el, 'data-forum-player', {...data, locale: userLocale, leagueId: null}),
			updateAttribute(el, 'data-forum-player1', {...data, locale: userLocale, leagueId: null}),
			updateAttribute(el, 'data-forum-player2', {...data, locale: enLocale, leagueId: enLeague}),
			updateAttribute(el, 'data-forum-player3', {...data, locale: leagueLocale}),
		]).catch(e => Foxtrick.log('Error updating player ad attributes:', e));
	},

	/** @type {Listener<HTMLAnchorElement,MouseEvent>} */
	createPlayerAd: function() {
		var doc = this.ownerDocument;
		var isSenior = Foxtrick.Pages.Player.isSenior(doc);
		try {
			var ad = '';

			ad += Foxtrick.Pages.Player.getName(doc);
			if (isSenior)
				ad += ' [playerid=' + Foxtrick.Pages.Player.getId(doc) + ']\n';
			else
				ad += ' [youthplayerid=' + Foxtrick.Pages.Player.getId(doc) + ']\n';

			// nationality, age and next birthday
			var byLine = doc.querySelector('.byline');

			// add new lines before <p> so that textContent would have breaks
			// at <p>s.
			let byLinePars = byLine.getElementsByTagName('p');
			Foxtrick.forEach(function(p) {
				p.parentNode.insertBefore(doc.createTextNode('\n'), p);
			}, byLinePars);
			ad += byLine.textContent.trim() + '\n\n';

			let nationality = Foxtrick.Pages.Player.getNationalityName(doc);
			if (nationality)
				ad += Foxtrick.L10n.getString('Nationality') + ': ' + nationality + '\n\n';

			let { isNewDesign, isYouth, table: infoTable } =
				Foxtrick.Pages.Player.getInfoTable(doc);

			let playerInfo;
			if (isNewDesign || isYouth) {
				playerInfo = doc.createDocumentFragment();
				let el = byLine.nextElementSibling;
				while (el && !el.classList.contains('playerInfo') &&
				       !el.querySelector('.playerInfo')) {
					// let text = el.textContent.trim();
					playerInfo.appendChild(Foxtrick.cloneElement(el, true));
					if (el.nodeName == 'P')
						playerInfo.appendChild(doc.createTextNode('\n'));

					el = el.nextElementSibling;
				}

				/** @type {Element} */
				let infoParent = infoTable;
				let prev = null;
				let pInfo = null;
				while (infoParent) {
					if (infoParent.matches('.playerInfo'))
						break;

					let children = [...infoParent.children].filter(c => c.matches('.playerInfo'));
					if (children.length) {
						[pInfo] = children;
						break;
					}

					prev = infoParent;
					infoParent = infoParent.parentElement;
				}
				if (infoParent) {
					let child = infoParent.firstChild;
					while (child && child != pInfo && child != prev) {
						playerInfo.appendChild(child.cloneNode(true));
						child = child.nextSibling;
					}
				}

				playerInfo.appendChild(Foxtrick.cloneElement(infoTable, true));
			}
			else {
				playerInfo = doc.querySelector('.playerInfo');
			}

			// basic information
			// for senior players:
			// (coach), form, stamina, experience, leadership, personality (always there)
			// for youth players:
			// specialty (only when he has a specialty)

			/** @type {Element | DocumentFragment} */
			var basicInfo;

			/** @type {HTMLTableRowElement} */
			var specialtyRow;
			if (isSenior) {
				// add new lines before <br> so that textContent would have breaks
				// at <br>s.
				basicInfo = Foxtrick.cloneElement(playerInfo, true);
				let tables = Foxtrick.toArray(basicInfo.querySelectorAll('table'));
				for (let tbl of tables)
					tbl.remove();

				let basicInfoBreaks = basicInfo.querySelectorAll('br');
				Foxtrick.forEach(function(br) {
					br.parentNode.insertBefore(doc.createTextNode('\n'), br);
				}, basicInfoBreaks);
				ad += basicInfo.textContent.trim() + '\n\n';
			}
			else {
				// sometime it's a string tag sometimes a paragraph seemingly
				basicInfo = playerInfo.querySelector('p') ||
					playerInfo.querySelector('strong');

				if (basicInfo) {
					let specialty = basicInfo.textContent.trim();

					// we will bold the specialty part, right after
					// colon plus space
					let colonRe = /:\s*/;
					let match = specialty.match(colonRe);
					if (match) {
						let colonIndex = match.index;
						let [colonText] = match;
						let colonLength = colonText.length;
						let colonEndIdx = colonIndex + colonLength;
						ad += specialty.slice(0, colonEndIdx) +
							'[b]' + specialty.slice(colonEndIdx) + '[/b]\n\n';
					}
					else {
						ad += `${specialty}\n\n`;
					}
				}
				else {
					specialtyRow = infoTable.querySelector('tr[id$="trSpeciality"]');
				}
			}

			// owner, TSI wage, etc.
			let tables = Foxtrick.toArray(playerInfo.querySelectorAll('table'));
			let table = tables.shift();
			if (table) {
				const SPECIALTY_ROW_IDX = 5;
				for (let [r, row] of [...table.rows].entries()) {
					let [header, data] = row.cells;
					ad += header.textContent.trim();

					if (typeof data === 'undefined') {
						ad += '\n\n';
						continue;
					}

					// remove teampopuplinks
					let teamLink;
					let cellCopy = Foxtrick.cloneElement(data, true);
					let popupLinks = Foxtrick.toArray(cellCopy.querySelectorAll('a'));
					if ((teamLink = popupLinks.shift()))
						teamLink.textContent = '[b]' + teamLink.textContent.trim() + '[/b]';

					for (let link of popupLinks)
						link.textContent = '';

					// bolding for specialty
					let part = cellCopy.textContent.replace(/\n/g, '').replace(/\s+/g, ' ').trim();
					if (r === SPECIALTY_ROW_IDX)
						part = '[b]' + part + '[/b]';

					ad += ' ' + part + '\n';
				}
				if (specialtyRow) {
					let [header, data] = specialtyRow.cells;
					ad += header.textContent.trim();
					let part = data.textContent.replace(/\n/g, '').replace(/\s+/g, ' ').trim();
					ad += ' [b]' + part + '[/b]\n';
				}
				ad += '\n';

				if ((table = tables.shift()) && !isYouth) {
					const SPECIALTY_ROW_IDX = 2;
					const HTMS_ROW_IDX = 5;
					for (let [r, row] of [...table.rows].entries()) {
						let [header, data] = row.cells;

						ad += header.textContent.trim();
						if (!data) {
							ad += '\n';
							continue;
						}

						let copy = Foxtrick.cloneElement(data, true);
						for (let tNode of Foxtrick.getTextNodes(copy)) {
							if (tNode.parentElement.closest('.bar-max'))
								tNode.textContent = ''; // prevent dupes

							let text = tNode.textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ');
							if (!text.trim()) {
								tNode.textContent = text;
								continue;
							}

							let parent = tNode.parentElement;
							if (!Foxtrick.hasClass(parent, 'ft-skill') &&
							    !Foxtrick.hasClass(parent, 'ft-skill-number') &&
							    parent.id != 'ft_bonuswage' &&
							    !text.startsWith(' '))
								text = ' ' + text;

							tNode.textContent = text.trimEnd();
						}

						let brs = copy.querySelectorAll('br');
						for (let br of Foxtrick.toArray(brs))
							br.parentNode.replaceChild(doc.createTextNode('\n'), br);

						let text = copy.textContent.trim();

						if (parseInt(text, 10).toString() == text) {
							/** @type {HTMLElement} */
							let level = copy.querySelector('.bar-level');
							if (level)
								text = level.title.trim() + ` (${text})`;
						}

						// bolding for specialty+htms
						if (r === SPECIALTY_ROW_IDX || r === HTMS_ROW_IDX)
							text = '[b]' + text + '[/b]';

						ad += ' ' + text + '\n';
					}

					ad += '\n';
				}
			}

			var formatSkill = function(text, value) {
				const IMPORTANT_SKILL_THRESHOLD = 5;

				let skillText = /\d/.test(text) ? text : `${text} (${value})`;
				if (value > IMPORTANT_SKILL_THRESHOLD)
					return '[b]' + skillText + '[/b]';
				else if (value == IMPORTANT_SKILL_THRESHOLD)
					return '[i]' + skillText + '[/i]';

				return skillText;
			};

			// skills
			var skills = Foxtrick.Pages.Player.getSkillsWithText(doc);
			if (skills !== null) {
				var skillArray = [];
				if (isSenior) {
					for (let n in skills.names) {
						skillArray.push({
							name: skills.names[n],
							value: skills.values[n],
							text: skills.texts[n],
						});
					}
					if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'Sorted') ||
					    doc.getElementsByClassName('percentImage').length > 0 ||
					    doc.getElementsByClassName('ft-percentImage').length > 0) {
						// if skills are sorted or skill bars are enabled,
						// the skills are arranged in a table with one cell
						// in each row
						if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'Sorted')) {
							var skillSort = function(a, b) {
								return b.value - a.value;
							};

							// sort skills by level, descending
							skillArray.sort(skillSort);
						}

						if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'NonTableStyle')) {
							ad += '\n';
							for (let s = 0; s < skillArray.length; ++s) {
								ad += skillArray[s].name + ': ' +
									formatSkill(skillArray[s].text, skillArray[s].value) + '\n';
							}
							ad += '\n';
						}
						else {
							ad += '[table]\n';
							for (let s = 0; s < skillArray.length; ++s) {
								ad += '[tr]' +
									'[th]' + skillArray[s].name + '[/th]' +
									'[td]' +
									formatSkill(skillArray[s].text, skillArray[s].value) +
									'[/td]' +
									'[/tr]\n';
							}
							ad += '[/table]';
						}
					}

					// otherwise, they are arranged in a table with two
					// cells in each row
					else if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd',
					                                              'NonTableStyle')) {
						ad += '\n';
						for (let s = 0; s < skillArray.length; ++s) {
							if (s % 2 == 1)
								ad += ' ';
							ad += skillArray[s].name + ': ' +
								formatSkill(skillArray[s].text, skillArray[s].value);
							if (s % 2 == 1)
								ad += '\n';
						}
						ad += '\n';
					}
					else {
						ad += '[table]\n';
						for (let [s, skill] of skillArray.entries()) {
							if (s % 2 === 0)
								ad += '[tr]';

							ad += '[th]' + skill.name + '[/th]';
							ad += `[td]${formatSkill(skill.text, skill.value)}[/td]`;

							if (s % 2 == 1)
								ad += '[/tr]\n';
						}
						if (skillArray.length % 2 == 1)
							ad += '[/tr]\n';

						ad += '[/table]';
					}
				}
				else {
					// for youth players, always in a table with one cell
					// in each row
					for (let n in skills.names) {
						skillArray.push({
							name: skills.names[n],
							current: {
								value: skills.values[n].current,
								text: skills.texts[n].current,
							},
							max: { value: skills.values[n].max, text: skills.texts[n].max },
							maxed: skills.values[n].maxed,
						});
					}

					if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'Sorted')) {
						var sorter = function(a, b) {
							if (a.current.value !== b.current.value)
								return b.current.value - a.current.value;
							else if (a.max.value !== b.max.value)
								return b.max.value - a.max.value;

							return b.maxed - a.maxed;
						};

						// sort skills by current level, maximum level,
						// and whether the skill has reached the potential,
						// descending
						skillArray.sort(sorter);
					}
					if (Foxtrick.Prefs.isModuleOptionEnabled('CopyPlayerAd', 'NonTableStyle')) {
						ad += '\n';
						for (let s = 0; s < skillArray.length; ++s) {
							skillArray[s].max = skillArray[s].max ||
								{ text: 'undefined', value: -1 };
							ad += skillArray[s].name + ': ' +
								(skillArray[s].maxed ? '[b]' : '') +
								skillArray[s].current.text + ' / ' + skillArray[s].max.text +
								(skillArray[s].maxed ? '[/b]' : '') +
								'\n';
						}
						ad += '\n';
					}
					else {
						ad += '[table]\n';
						for (let s = 0; s < skillArray.length; ++s) {
							skillArray[s].max = skillArray[s].max ||
								{ text: 'undefined', value: -1 };

							ad += '[tr]' +
								'[th]' + skillArray[s].name + '[/th]' +
								'[td]' + (skillArray[s].maxed ? '[b]' : '') +
								skillArray[s].current.text + ' / ' + skillArray[s].max.text +
								(skillArray[s].maxed ? '[/b]' : '') +
								'[/td]' +
								'[/tr]\n';
						}
						ad += '[/table]';
					}
				}
			}

			// current bid information
			let bidDiv = Foxtrick.Pages.Player.getBidInfo(doc);
			if (bidDiv) {
				ad += '\n';
				let paragraphs = bidDiv.querySelectorAll('p');
				for (let para of paragraphs) {
					let parCopy = Foxtrick.cloneElement(para, true);
					let links = parCopy.querySelectorAll('a');
					for (let link of [...links].slice(1))
						link.textContent = '';

					ad += parCopy.textContent.trim();
					ad += '\n';
				}
			}

			Foxtrick.copy(doc, ad);
			const COPIED = Foxtrick.L10n.getString('copy.playerad.copied');
			Foxtrick.util.note.add(doc, COPIED, 'ft-playerad-copy-note');
		}
		catch (e) {
			Foxtrick.alert('createPlayerAd');
			Foxtrick.log(e);
		}
	},
};

/**
 * @typedef {object} CopyPlayerAdModifier
 * @property {string} name - Identifier used for debugging and logging.
 * @property {string} [regex] - Regex string that must match the current line for the modifier to apply.
 * @property {number} [lineNumber] - Zero-based line index to target within the data attribute.
 * @property {'prepend'|'append'|'before'|'after'|'replace'} type - How the modifier output is merged into the final text.
 * @property {'youth'|'senior'} [playerType] - Restrict application to youth or senior players; omit for both.
 * @property {(str: string, data?: CopyPlayerAdModifierData) => (string|void|Promise<string|false|void>)} exec - Generates text to include in Ad or false/void to skip.
 */

/**
 * @typedef {object} CopyPlayerAdModifierData
 * @property {string} attrName
 * @property {boolean} isYouth
 * @property {number|null} leagueId
 * @property {number} [lineNumber]
 * @property {string} locale
 * @property {CopyPlayerAdModifier} [modifier]
 * @property {number} playerId
 */

/**
 * @typedef {object} UpdateAttributeData
 * @property {boolean} isYouth - Whether this is a youth player.
 * @property {number|null} leagueId - League ID of the player.
 * @property {string} locale - Locale code for localization.
 * @property {number} playerId - Player ID.
 */

/**
 * @typedef {object} HTYouthSkill
 * [th]Keeper[/th][td]passable / unknown (6/?)[/td]
 * @property {string} [ability] - Ability or undefined, e.g. '6'.
 * @property {string} [abilityDenom] - Ability demonimation, e.g. 'passable'.
 * @property {string} [denomStr] - Skill demonimations string, e.g. 'passable / unknown '.
 * @property {number} [hyIndex] - Associated hyc skill id.
 * @property {string} [matched] - String matched from table.
 * @property {string} [name] - Skill name in table, e.g. 'Keeper.'
 * @property {string} [potential] - Potential or undefined, e.g. undefined.
 * @property {string} [potentialDenom] - Potential demonimation, e.g. 'unknown'.
 * @property {string} [valuesStr] - Skill values string, e.g. '(6/?)'.
 */