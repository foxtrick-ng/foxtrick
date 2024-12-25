/**
 * xml-load.js
 * xml loading
 * 
 * @author convinced, LA-MJ
 */

'use strict';

if (!this.Foxtrick)
	// @ts-ignore
	var Foxtrick = {};

Foxtrick.XMLData = {
	MODULE_NAME: 'XMLData',
	PAGES: ['all'],

	/** @type {Record<number, LeagueDefinition>} */
	League: {},

	/** @type {Record<number, number>} */
	countryToLeague: {},

	/** @type {Partial<AboutJSONSchema>} */
	aboutJSON: {},

	/** @type {Partial<HTCurrencySchema>} */
	htCurrencyJSON: {},

	/** @type {Partial<WorldDetailsSchema>} */
	worldDetailsJSON: {},
	
	/** @type {Partial<NationalTeamsSchema>} */
	nationalTeamsJSON: {},

	/**
	 * @param {boolean} _ reInit
	 */
	/* eslint-disable-next-line no-unused-vars */
	init: function(_) {
		var module = this;

		var currency = Foxtrick.util.load.sync(Foxtrick.InternalPath + 'data/htcurrency.json');
		module.htCurrencyJSON = JSON.parse(currency);
		var about = Foxtrick.util.load.sync(Foxtrick.InternalPath + 'data/foxtrick_about.json');
		module.aboutJSON = JSON.parse(about);
		var world = Foxtrick.util.load.sync(Foxtrick.InternalPath + 'data/worlddetails.json');
		module.worldDetailsJSON = JSON.parse(world);
		var nationalTeams = Foxtrick.util.load.sync(Foxtrick.InternalPath + 'data/nationalteams.json');
		module.nationalTeamsJSON = JSON.parse(nationalTeams);

		if (!module.worldDetailsJSON) {
			Foxtrick.log(new Error('loading world failed'));
			return;
		}

		var leagueList = module.worldDetailsJSON.HattrickData.LeagueList;
		Foxtrick.forEach(function(league) {
			let leagueId = parseInt(league.LeagueID, 10);
			module.League[leagueId] = league;
			if (league.Country.CountryID) {
				let countryId = parseInt(league.Country.CountryID, 10);
				module.countryToLeague[countryId] = leagueId;
			}
		}, leagueList);
	},

	/**
	 * Get League ID from Country ID
	 *
	 * @param  {number} id
	 * @return {number}
	 */
	getLeagueIdByCountryId: function(id) {
		if (this.countryToLeague[id])
			return this.countryToLeague[id];

		return 0;
	},

	/**
	 * Get Country ID from League ID
	 *
	 * @param  {number} id
	 * @return {number}
	 */
	getCountryIdByLeagueId: function(id) {
		var league = this.League[id];
		if (league)
			return parseInt(league.Country.CountryID, 10) || 0;

		return 0;
	},

	/**
	 * Get the name of National Team for a certain league
	 *
	 * @param  {number} id
	 * @return {string}
	 */
	getNTNameByLeagueId: function(id) {
		let teams = Foxtrick.XMLData.nationalTeamsJSON.HattrickData.NationalTeams;
		let team = Foxtrick.nth((team) => {
			return team.LeagueId === id.toString();
		}, teams);

		if (team)
			return team.NationalTeamName;

		// team not in local nationalTeamsJSON, fallback to league name
		return Foxtrick.L10n.getCountryNameNative(id);
	},
};

/**
 * @typedef CupDefinition
 * @prop {string} CupID
 * @prop {string} CupLeagueLevel
 * @prop {string} CupLevel
 * @prop {string} CupLevelIndex
 * @prop {string} CupName
 * @prop {string} MatchRound
 * @prop {string} MatchRoundsLeft
 */

/** 
 * @typedef Countrydefinition
 * @prop {string} Available
 * @prop {string} CountryCode
 * @prop {string} CountryID
 * @prop {string} CountryName
 * @prop {string} CurrencyName
 * @prop {string} CurrencyRate
 * @prop {string} DateFormat
 * @prop {string} TimeFormat
 */

/**
 * @typedef LeagueDefinition
 * @prop {string} ActiveTeams
 * @prop {string} ActiveUsers
 * @prop {string} Continent
 * @prop {Countrydefinition} Country
 * @prop {string} CupMatchDate
 * @prop {CupDefinition[]} Cups
 * @prop {string} EconomyDate
 * @prop {string} EnglishName
 * @prop {string} LanguageId
 * @prop {string} LanguageName
 * @prop {string} LeagueID
 * @prop {string} LeagueName
 * @prop {string} MatchRound
 * @prop {string} NationalTeamId
 * @prop {string} NumberOfLevels
 * @prop {string} Season
 * @prop {string} SeasonOffset
 * @prop {string} Sequence1
 * @prop {string} Sequence2
 * @prop {string} Sequence3
 * @prop {string} Sequence5
 * @prop {string} Sequence7
 * @prop {string} SeriesMatchDate
 * @prop {string} ShortName
 * @prop {string} TrainingDate
 * @prop {string} U20TeamId
 * @prop {string} WaitingUsers
 * @prop {string} ZoneName
 * @typedef { { HattrickData: { LeagueList: LeagueDefinition[] } } } WorldDetailsSchema
 */

/**
 * @typedef CurrencyDefinition
 * @prop {string} code
 * @prop {string} eurorate
 * @prop {Record<string, string>} leagues
 * @prop {string} name
 * @prop {string} symbol
 * @typedef { { hattrickcurrencies: CurrencyDefinition[] } } HTCurrencySchema
 */

/**
 * @typedef { { id: string, href: string } } AboutJSONLink
 * @typedef { { id?: string, name: string } } AboutJSONPerson
 * @typedef { { language: string, translators: AboutJSONPerson[] }} AboutJSONTranslation
 * @typedef AboutJSONSchema
 * @prop {AboutJSONLink[]} links
 * @prop {AboutJSONPerson[]} maintainers
 * @prop {AboutJSONPerson[]} developers
 * @prop {AboutJSONPerson[]} designers
 * @prop {AboutJSONPerson[]} donators
 * @prop {AboutJSONTranslation[]} translations
 */

/**
 * @typedef NationalTeamDefinition
 * @prop {string} Dress
 * @prop {string} LeagueId
 * @prop {string} NationalTeamID
 * @prop {string} NationalTeamName
 * @prop {string} RatingScores
 * @typedef { { HattrickData: { NationalTeams: NationalTeamDefinition[] } } } NationalTeamsSchema
 */
