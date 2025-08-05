'use strict';

Foxtrick.modules['LogogramPlayerNames'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.PRESENTATION,
	PAGES: ['all', 'playerDetails', 'youthPlayerDetails', 'allPlayers', 'youthPlayers', 'youthOverview', 'trainerDetails'],
	RADIO_OPTIONS: ['NO_LATIN', 'NO_LOGOGRAMS', 'NO_CHANGES'],

	run: function (doc) {
		var module = this;
		const option = Foxtrick.Prefs.getModuleValue(module);

		const nodes = [
			// Player name in player details
			{
				elements: [document.querySelector('#mainBody h1.hasByline.flex-inline')],
				getPlayerName: element => element.childNodes[2].textContent,
				updatePlayerName: (element, playerName) => {
					element.childNodes[2].textContent = playerName;
				}
			},
			// Page title
			{
				elements: [document.querySelector('head title')],
				getPlayerName: element => element.textContent.split('»')[0],
				updatePlayerName: (element, playerName) => {
					const separator = '»';
					const titleSplitted = element.textContent.split(separator)
					titleSplitted[0] = playerName;
					element.textContent = titleSplitted.join(separator);
				}
			},
			// All links to player details
			{
				elements: Array.from(document.querySelectorAll('a[href]')).filter(a => new RegExp(/https:\/\/www\d*\.hattrick\.org\/Club\/Players\/(YouthPlayer|Player)\.aspx/).test(a.href)),
				getPlayerName: element => element.textContent,
				updatePlayerName: (element, playerName) => {
					element.textContent = playerName;
					if (element.attributes['title']) {
						element.attributes['title'].textContent = playerName;
					}
				}
			},
			// Scouts
			{
				elements: document.querySelectorAll('.scout-details-text-name span b'),
				getPlayerName: element => element.textContent,
				updatePlayerName: (element, playerName) => element.textContent = playerName
			},
			// Coach
			{
				elements: document.querySelectorAll('#mainBody .hasByline'),
				getPlayerName: element => element.childNodes[0].textContent,
				updatePlayerName: (element, playerName) => element.childNodes[0].textContent = playerName
			}
		]

		console.log('LogogramPlayerNames nodes:', nodes);
		nodes.forEach(node => {
			if (!node.elements || Array.from(node.elements).filter(el => el).length === 0) {
				console.warn('LogogramPlayerNames: No elements found for player name');
				return;
			}
			node.elements.forEach(element => {
				const originalPlayerName = node.getPlayerName(element);
				if (!originalPlayerName) {
					console.warn('LogogramPlayerNames: No player name found');
					return;
				}
				const fixedPlayerName = fixLogogramPlayerName(originalPlayerName, option);
				node.updatePlayerName(element, fixedPlayerName);
			})
		})

		/**
		 * @param {string} playerName The name of the player
		 * @param {number} mode 0 = no changes, 1 = only logograms 2 = only letters 
		 * @returns {string} The name of the player fixed
		 * @description TODO
		 */
		
		// TODO: change function name
		function fixLogogramPlayerName(playerName, mode) {
			switch (mode) {
				case 0:
					return extractLogograms(playerName)
				case 1:
					return extractLetters(playerName)
				case 2:
				default:
					return playerName;		
			}
		
			/**
			 * @param {string} playerName
			 * @return {string}
			 */
			function extractLogograms(playerName) {
				return playerName.replace(/\s*\([^)]+\)/g, '');
			}
		
			/**
			 * @param {string} playerName
			 * @return {string}
			 */
			function extractLetters(playerName) {
				// FIXME: this regex is not perfect, it trim spaces after the last letter
				const regex = /\(\s*([^)]+?)\s*\)/g;		
				let match;
				const results = [];
				
				while ((match = regex.exec(playerName)) !== null) {
					results.push(match[1]);
				}
				
				return results.length > 0 ? results.join(' ') : playerName;
			}
		}

	}
};