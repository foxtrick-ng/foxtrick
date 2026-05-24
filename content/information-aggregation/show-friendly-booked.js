/**
 * show-friendly-booked.js
 * Show whether a team has booked friendly on series page
 * @author ryanli, LA-MJ
 */

'use strict';

Foxtrick.modules.ShowFriendlyBooked = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['series'],
	OPTIONS: ['OnDemand'],
	CSS: Foxtrick.InternalPath + 'resources/css/show-friendly-booked.css',

	/** @param {document} doc */
	run: function(doc) {
		const module = this;
		let leagueTable = Foxtrick.Pages.Series.getTable(doc);
		if (!leagueTable)
			return;

		var show = function() {
			let rowCol = leagueTable.querySelectorAll('tr');

			// remove header row and ownerless teams
			let rows = Foxtrick.filter(function(n) {
				let isHeader = () => !!n.querySelector('th');
				let isOwnerless = () => !!n.querySelector('.shy');
				let inCup = () => !!n.querySelector('img[src*="cup"i]');

				return !isHeader() && !inCup() && !isOwnerless();
			}, rowCol);

			// see whether friendly booked
			for (let row of rows) {
				let teamCell = row.cells[3];
				let teamLink = teamCell.querySelector('a').href;
				let teamId = Foxtrick.util.id.getTeamIdFromUrl(teamLink);

				let destCell = row.cells[5];
				destCell.textContent = Foxtrick.L10n.getString('status.loading.abbr');
				destCell.title = Foxtrick.L10n.getString('status.loading');

				/** @type {CHPPParams} */
				let params = [
					['file', 'teamdetails'],
					['teamId', teamId],
				];
				Foxtrick.util.api.retrieve(doc, params, { cache: 'default' }, async (xml, errorText) => {
					if (!xml || errorText) {
						destCell.textContent = Foxtrick.L10n.getString('status.error.abbr');
						destCell.title = errorText;
						Foxtrick.log(errorText);
						return;
					}

					// reset textContent and title
					destCell.textContent = '';
					destCell.removeAttribute('title');

					let friendly = xml.node('FriendlyTeamID');
					if (friendly.getAttribute('Available') != 'True') {
						destCell.textContent = Foxtrick.L10n.getString('status.unknown.abbr');
						destCell.title = Foxtrick.L10n.getString('status.unknown');
					}
					else if (friendly.textContent != '0') {
						// friendly booked
						let img = doc.createElement('img');
						img.src = '/Img/Svgs/match-types/friendly.svg?v=1';
						img.alt = img.title = Foxtrick.L10n.getString('team.status.booked');
						img.className = 'ft_friendly';
						try {
							const matchId = await module.getMatchId(doc, teamId, parseInt(friendly.textContent));
							const anchor = doc.createElement('a');
							anchor.href = `/Club/Matches/Match.aspx?matchID=${matchId}`;
							anchor.appendChild(img);
							destCell.appendChild(anchor);
							Foxtrick.makeFeaturedElement(anchor, module);
						} catch (error) {
							Foxtrick.log('Error getting match ID for team ' + teamId + ': ' + error);
							destCell.appendChild(img);
							Foxtrick.makeFeaturedElement(img, module);
						}
						
					}
				});
			}
		};

		// add the stuffs
		if (Foxtrick.Prefs.isModuleOptionEnabled(module, 'OnDemand')) {
			// show on demand
			let link = Foxtrick.createFeaturedElement(doc, module, 'a');
			link.id = 'ft-show-friendlies';
			link.className = 'float_left ft-link';
			link.textContent = Foxtrick.L10n.getString(`${module.MODULE_NAME}.ShowFriendlies`);

			Foxtrick.onClick(link, function() {
				// eslint-disable-next-line no-invalid-this
				this.remove();
				try {
					show();
				}
				catch (e) {
					Foxtrick.catch(module)(e);
				}
			});

			if (Foxtrick.util.layout.isSupporter(doc)) {
				let updPnlLiveLeagueTable = Foxtrick.Pages.Series.getLiveTable(doc);
				let headerBr = updPnlLiveLeagueTable.querySelector('br');
				try {
					if (headerBr)
						Foxtrick.insertBefore(link, headerBr);
					else
						// no <br> in header, probably HGL during season break
						Foxtrick.prependChild(link, updPnlLiveLeagueTable.firstElementChild.firstElementChild);
				} catch {
					Foxtrick.log(this.MODULE_NAME+': Error inserting link into series table')
				}
			}
			else {
				let table = Foxtrick.Pages.Series.getTable(doc);
				let parent = table.parentNode;
				Foxtrick.insertBefore(link, parent);

				// style.clear needed before the table
				let clear = doc.createElement('div');
				clear.className = 'clear';
				Foxtrick.insertBefore(clear, parent);
			}
		}
		else {
			// show automatically
			show();
		}
	},

	/**
	 * @param {Document} doc
	 * @param {number} teamId
	 * @param {number} friendlyTeamId
	 * @returns {Promise<number>} matchId if friendly booked, 0 if not booked, -1 if unknown
	 *  */	
	getMatchId: function(doc, teamId, friendlyTeamId) {
		function getLastMatchDate() {
			const lastMatchDate = new Date()
			lastMatchDate.setDate(lastMatchDate.getDate() + 10); // 1 week later should be enough to cover the friendly
			return lastMatchDate.toISOString().replace('T', ' ').replace(/\..+/, '');
		}

		/** @type {CHPPParams} */
		let params = [
			['version', '2.9'],
			['file', 'matches'],
			['teamId', teamId],
			['LastMatchDate', getLastMatchDate()],
		];
		return new Promise((resolve, reject) => {
			Foxtrick.util.api.retrieve(doc, params, { cache: 'default' }, async (xml, errorText) => {
				if (!xml || errorText) {				
					Foxtrick.log(errorText);
					return reject(errorText);
				}
				let matchId = -1;
				const teamNodes = xml.querySelectorAll('HomeTeamID, AwayTeamID');

				for (const node of teamNodes) {
					if (parseInt(node.textContent) !== friendlyTeamId) continue;

					const matchNode = node.closest('Match');
					const matchType = matchNode.querySelector('MatchType').textContent;
					if (['4', '5', '8', '9'].includes(matchType) === false) continue; // not friendly
					const matchStatus = matchNode.querySelector('Status').textContent;
					if (matchStatus === 'FINISHED') continue; // friendly already finished
					matchId = parseInt(matchNode.querySelector('MatchID').textContent);
					break;
				}
				if (matchId === -1) {
					return reject('No match found for team ' + teamId + ' and friendly team ' + friendlyTeamId);
				}
				return resolve(matchId);
			});
		})
	}
};


