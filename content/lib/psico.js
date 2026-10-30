/*
Copyright (c) 2010 Re4Ver <psicotsitool@gmail.com>, http://www.aldeaglobal.net/psicotsi/
Copyright (c) 2013 lizardopoli <lizardopoli@gmail.com>, http://psicotsi.sourceforge.net/releases/
Copyright (c) 2013 LA-MJ <4mr.minj@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

'use strict';

/* eslint-disable */
if (!this.Foxtrick)
	var Foxtrick = {};
/* eslint-enable */

Foxtrick.psico = {
	/**
	 * Hyperbolic tangent (overflows ~700)
	 * Returns [-1; 1]
	 * @param  {number} x
	 * @return {number}
	 */
	tanh: function(x) {
		return Math.tanh(x);
	},

	/**
	 * get the index of the highest skill
	 * from [frm, sta, pm, w, sco, gk, ps, df, sp]
	 * @param  {number[]} skills array of integers
	 * @return {number}          index
	 */
	getMaxSkill: function(skills) {
		var vmax = 0;
		var pmax = 0;
		for (var i = 2; i < skills.length - 1; i++) {
			if (skills[i] - vmax > 0) {
				vmax = skills[i];
				pmax = i;
			}
		}
		return pmax;
	},

	/**
	 * test whether two top skills are the same
	 * from [frm, sta, pm, w, sco, gk, ps, df, sp]
	 * @param  {number[]} vector array of integers
	 * @return {boolean}
	 */
	undefinedMainSkill: function(vector) {
		var vmax = 0;
		var pmax = 0;
		for (var i = 2; i < vector.length - 1; i++) {
			if (vector[i] - vmax > 0) {
				vmax = vector[i];
				pmax = i;
			};
		}
		for (var i = 2; i < vector.length - 1; i++) {
			if (vector[i] - vector[pmax] == 0 && i != pmax) {
				return true;
			}
		}
		return false;
	},

	/**
	 * checks if player is a goalkeeper by the index of highest skill
	 * @param  {number} maxSkill index in the skill array
	 * @return {boolean}
	 */
	isGoalkeeper: function(maxSkill) {
		return (maxSkill == 5);
	},

	/**
	 * calculate maximum GK level using TSI
	 * & form with sub {Low Avg High}
	 * @param  {number}  TSI
	 * @param  {number}  form
	 * @param  {string}	 formSubLevel {Low Avg High}
	 * @return {number}               GK Level
	 */
	calcMaxSkillGK: function(TSI, form, formSubLevel) {
		//tnx to phinetom (8430364)
		var form_factor = (form * 0.025) + 0.110655;
		var level = Math.pow(100.5 * TSI / form_factor, 1 / 3.4) / 10 + 1;

		//form sublevel adjustment
		if (formSubLevel == 'Low') {
			level = level * 1.00854;
		} else if (formSubLevel == 'High') {
			level = level * 0.99179;
		}

		//form adjustment
		switch (form) {
			case 4:
				level = level * 0.99941;
				break;
			case 5:
				level = level * 0.99964;
				break;
			case 6:
				level = level * 0.99984;
				break;
			case 7:
				level = level * 1;
				break;
			case 8:
				level = level * 1.00013;
				break;
			default:
				break;
		}

		return level.toFixed(2);
	},

	/**
	 * calculate maximum skill level
	 * from [frm, sta, pm, w, sco, gk, ps, df, sp]
	 * using TSI & form {Low Avg High}
	 * @param  {number[]} playerskills array of integers
	 * @param  {number}   TSI
	 * @param  {string}   formSubLevel {Low Avg High}
	 * @return {number}                skill Level
	 */
	/* eslint-disable complexity */
	calcMaxSkill: function(playerskills, TSI, formSubLevel) {
		var pinput = [1, 0, 0, 0, 0, 0, 0, 0];
		// Neural Network Input values
		// Form
		if (formSubLevel == 'Low') {
			pinput[1] = playerskills[0] + 0.01;
		}
		if (formSubLevel == 'Avg') {
			pinput[1] = playerskills[0] + 0.5;
		}
		if (formSubLevel == 'High') {
			pinput[1] = playerskills[0] + 0.99;
		}
		if (pinput[1] > 8) {
			pinput[1] = 8;
		}
		// Stamina
		if (playerskills[1] < 9) {
			pinput[2] = playerskills[1] + 0.25;
		} else {
			pinput[2] = playerskills[1];
		}
		pinput[3] = playerskills[2] + 0.25;
		pinput[4] = playerskills[3] + 0.25;
		pinput[5] = playerskills[4] + 0.25;
		pinput[6] = playerskills[6] + 0.25;
		pinput[7] = playerskills[7] + 0.25;
		// Main skill
		var pskillMax = this.getMaxSkill(playerskills);
		if (pskillMax > 5) {
			pskillMax = pskillMax - 1;
		}
		pskillMax = pskillMax + 1;
		if (pinput[pskillMax] > 7) {
			pinput[pskillMax] = pinput[pskillMax] - 0.2;
		} else {
			pinput[pskillMax] = pinput[pskillMax] - 0.1;
		}
		// Starting approximation
		var level = pinput[pskillMax];
		var sublevel = 0;
		var err = 10000;
		var newTSI = this.sim(pinput);
		var cont = 0;
		while (err > 1 && cont < 100) {
			if (newTSI > TSI) {
				sublevel = sublevel - Math.pow(0.5, cont);
			}
			if (newTSI < TSI) {
				sublevel = sublevel + Math.pow(0.5, cont);
			}
			pinput[pskillMax] = level + sublevel;
			newTSI = this.sim(pinput);
			err = Math.abs(newTSI - TSI);
			cont++;
		}
		// Extreme values correction
		if (sublevel < 0) {
			sublevel = sublevel / 8;
		}
		if (sublevel > 1) {
			sublevel = 1 + (sublevel - 1) / 8;
		}
		// Output
		return (level + sublevel).toFixed(2);
	},
	/* eslint-enable complexity */

	/**
	 * Predicts TSI (float) for {PM WG SC PS DF}
	 * from [1, frm, sta, pm, w, sco, ps, df]
	 * @param  {number[]} pinput    array of numbers
	 * @return {number}             TSI
	 */
	sim: function(pinput) {
		return Math.pow(
			1.03 * Math.pow(pinput[7] - 1, 3)
			+ 1.03 * Math.pow(pinput[3] - 1, 3)
			+ 1.03 * Math.pow(pinput[5] - 1, 3)
			+ 1.03 * Math.pow(pinput[6] - 1, 3)
			+ 0.825 * Math.pow(pinput[4] - 1, 3),
			2)
			* Math.pow((pinput[1]), 0.5)
			* Math.pow((pinput[2]), 0.5)
			/ 1000;
	},

	/**
	 * Predict skill using wage and age (type: Low Avg High)
	 * from [frm, sta, pm, w, sco, gk, ps, df, sp]
	 * @param  {number[]} playerskills	array of integers
	 * @param  {number}   wage
	 * @param  {number}   age
	 * @param  {string}   predictionType {Low Avg High}
	 * @param  {boolean}  debugEnabled   print to console
	 * @return {number}                  Skill
	 */
	simWage: function(playerskills, wage, age, predictionType, debugEnabled) {
		//                             0    1    2    3    4    5    6    7    8
		//var playerskills = new Array(frm, sta, pla, win, sco, goa, pas, def, sp);
		var magicNumbers = [
			'', '', 'Playmaking', 'Winger', 'Scoring', 'Keeper', 'Passing', 'Defending'
		];

		var comparing_wage = wage;
		//DEBUG
		var debug = '\n';
		debug += 'WAGE (without 20% and 10%): ' + parseInt(wage, 10) + '\n';

		//removing base salary from wage
		wage -= 250;

		//removing set pieces from wage
		wage = wage / (1 + 0.0025 * Math.max(0, playerskills[8]));
		debug += 'WAGE (without SP and base salary): ' + parseInt(wage, 10) + '\n';

		if (age >= 29 && age <= 37) {
			wage = wage / (1 - (age - 28) / 10);
			debug += 'WAGE (without AGE impact): ' + parseInt(wage, 10) + '\n';
			comparing_wage = wage * (1 + 0.0025 * Math.max(0, playerskills[8])) + 250;
		}

		var coefficients = {
			// wage = (a * (skill ^ b)) [* c, if secondary skill] [* d, if wage > 20000]
			// sk   a             b             c     d
			'5' : [ 0.0005010000, 6.4000000000, 0.50, 1.0000 ], // keeping    [PLACEHOLDER]
			'7' : [ 0.0007145560, 6.4607813171, 0.50, 0.7921 ], // defending
			'2' : [ 0.0009418058, 6.4407950328, 0.50, 0.7832 ], // playmaking
			'6' : [ 0.0004476257, 6.5136791026, 0.50, 0.7707 ], // passing
			'3' : [ 0.0004437607, 6.4641257225, 0.50, 0.7789 ], // winger
			'4' : [ 0.0009136982, 6.4090063683, 0.50, 0.7984 ]  // scoring
		};

		var subtractFromSkill;
		switch (predictionType) {
			case 'High':
				subtractFromSkill = 0.01;
				break;
			case 'Avg':
				subtractFromSkill = 0.5;
				break;
			default: // default to Low
				subtractFromSkill = 1;
				break;
		}

		//calculating mainSkill basing on wage
		var mainSkill = 0;
		var max_low = 0;
		var max_high = 0;
		var detectable = false;

		for (var loop = 2; loop <= 7; ++loop) {
			var skill = playerskills[loop];
			if (skill < 1) {
				continue;
			}

			var wage_component_low = 0;
			var wage_component_high = 0;

			if (loop != 5) { // not GK
				wage_component_low = coefficients[loop][0] *
					Math.pow(skill - 1, coefficients[loop][1]);
				wage_component_high = coefficients[loop][0] *
					Math.pow(skill - 0.01, coefficients[loop][1]);
			} else {
				wage_component_low = this.simWageKeeper(skill - 1);
				wage_component_high = this.simWageKeeper(skill - 0.01);
			}

			// > 20000 discount
			if (wage_component_low > 20000)
				wage_component_low = 20000 + (wage_component_low - 20000) * coefficients[loop][3];
			if (wage_component_high > 20000)
				wage_component_high = 20000 + (wage_component_high - 20000) * coefficients[loop][3];
			//GM_log('Testing skill: ' + magicNumbers[loop] + '\nwage_component_low: ' + wage_component_low + '\nwage_component_high: ' + wage_component_high +'\n');

			if (wage_component_low > max_low) {
				mainSkill = loop;
				max_low = wage_component_low;
				if (wage_component_low > max_high) {
					detectable = true;
					max_high = wage_component_high;
				}
				else {
					detectable = false;
				}
			}
		}

		if (!detectable) {
			return 'N/A';
		}

		debug += 'MAIN SKILL: ' + magicNumbers[mainSkill] + '\n';

		var simskill = 0;
		var simwage = 0;
		//removing secondary skills from wage
		for (loop = 2; loop <= 7; ++loop) {
			if (loop == mainSkill)
				continue;
			var subskill = playerskills[loop] - subtractFromSkill;
			var wage_sub_component = 0;

			if (loop != 5) { // not GK
				wage_sub_component = coefficients[loop][0] *
					Math.pow(subskill, coefficients[loop][1]);
			} else {
				wage_sub_component = this.simWageKeeper(subskill);
			}

			// > 20000 discount
			if (wage_sub_component > 20000)
				wage_sub_component = 20000 + (wage_sub_component - 20000) * coefficients[loop][3];

			//secondary skill 50% discount
			wage_sub_component = wage_sub_component * coefficients[loop][2];

			if (isNaN(wage_sub_component) || wage_sub_component < 0) {
				wage_sub_component = 0;
			}
			//high skill discount
			debug += 'WAGE_SECONDARY_COMPONENT (' + magicNumbers[loop] + '): ' +
				parseInt(wage_sub_component, 10) + ' (' + subskill + ')\n';
			wage -= wage_sub_component;
			if (wage < 0)
				return 'N/A';
			simwage += wage_sub_component;
		}

		var wage_main_component = 0;
		wage_main_component = coefficients[mainSkill][0] *
			Math.pow(playerskills[mainSkill] - 1, coefficients[mainSkill][1]);

		// > 20000 discount on main component
		if (wage_main_component > 20000)
			wage_main_component = 20000 + (wage_main_component - 20000) * coefficients[mainSkill][3];

		// N/A wage detection for keepers keeping_ad undefined
		// if (mainSkill == 5) {
		// 	wage_main_component = wage_main_component * keeping_adj;
		// }

		// remove > 20000 discount on wage to get proper skill prediction
		if (wage > 20000)
			wage = 20000 + (wage - 20000) / coefficients[mainSkill][3];

		simwage += wage_main_component;
		simwage = simwage * (1 + 0.0025 * Math.max(0, playerskills[8])) + 250;
		debug += 'EST. WAGE WITHOUT SECONDARIES: ' + parseInt(wage, 10) + '\n';
		debug += 'SIM_MAIN_SKILL_WAGE (0 decimals): ' + parseInt(wage_main_component, 10) + '\n';
		debug += 'SIM_WAGE (main skill + secondaries + sp + base salary): ' +
			parseInt(simwage, 10) + '\n';
		debug += 'DIFFERENCE RATIO (WAGE / SIM_WAGE): ' +
			((1 - comparing_wage / simwage) * 100).toFixed(2) + '%' + '\n';

		//make prediction
		simskill = Math.pow(wage / coefficients[mainSkill][0], 1 / coefficients[mainSkill][1]);

		debug += 'SIM_MAIN_SKILL: ' + (simskill + 1).toFixed(2) + '\n';
		if (debugEnabled) {
			Foxtrick.log(debug);
		}
		return (simskill + 1).toFixed(2);
	},

	// seems rather useless, leaving for now
	simWageKeeper: function (skill) {
		// eslint-disable-next-line no-unused-vars
		var coefficients = [ // lgtm[js/unused-local-variable]
			-3.71589339794053e-56,
			1.04009125232652e-50,
			-1.23925532612466e-45,
			8.28233101957159e-41,
			-3.44786999276044e-36,
			9.40005209607577e-32,
			-1.72062171158208e-27,
			2.13678090366430e-23,
			-1.80197689313736e-19,
			1.02533307654267e-15,
			-3.88645216393083e-12,
			9.63752335367394e-09,
			-1.53667425395314e-05,
			0.0162490281050522,
			-0.918881884002134
		];
		return 0;
	},

	/**
	 * @typedef PsicoTSIPrediction
	 * @prop {string} maxSkill
	 * @prop {boolean} isGK
	 * @prop {boolean} undef
	 * @prop {string} limit
	 * @prop {number} formLow
	 * @prop {number} formAvg
	 * @prop {number} formHigh
	 * @prop {string} wageLow
	 * @prop {string} wageAvg
	 * @prop {string} wageHigh
	 */

	/**
	 * Get PsicoTSI prediction data from playerskills
	 * [frm, sta, pm, w, sco, gk, ps, df, sp]
	 * Returns prediction object:
	 * { maxSkill, isGK, undef, limit, formLow, formAvg, formHigh, wageLow, wageAvg, wageHigh }
	 * @param  {number[]} playerskills
	 * @param  {number}   currTSI
	 * @param  {number}   currWAGE
	 * @param  {number}   age
	 * @return {PsicoTSIPrediction}
	 */
	getPrediction: function(playerskills, currTSI, currWAGE, age) {
		var frm = playerskills[0];
		var maxSkill = this.getMaxSkill(playerskills);
		// halt if player is Non - existent
		if (playerskills[maxSkill] === 0) {
			return null;
		}
		var formAvg = 0;
		var formLow = 0;
		var formHigh = 0;

		var wageLow = 'N/A';
		var wageAvg = 'N/A';
		var wageHigh = 'N/A';

		var undef = this.undefinedMainSkill(playerskills);
		var limit = 'Medium';
		var isGK = this.isGoalkeeper(maxSkill);
		if (!isGK) {
			formAvg = this.calcMaxSkill(playerskills, currTSI, 'Avg');
			formLow = this.calcMaxSkill(playerskills, currTSI, 'Low');
			formHigh = this.calcMaxSkill(playerskills, currTSI, 'High');
		} else {
			formAvg = this.calcMaxSkillGK(currTSI, frm, 'Avg');
			formLow = this.calcMaxSkillGK(currTSI, frm, 'Low');
			formHigh = this.calcMaxSkillGK(currTSI, frm, 'High');
		}
		if (currWAGE >= 270 && !isGK) {
			wageLow = this.simWage(playerskills, currWAGE, age, 'Low');
			wageAvg = this.simWage(playerskills, currWAGE, age, 'Avg');
			wageHigh = this.simWage(playerskills, currWAGE, age, 'High');
		}
		if (formLow - playerskills[maxSkill] <= 0.1) {
			limit = 'Low';
		}
		if (formHigh - playerskills[maxSkill] >= 0.8 ||
			wageHigh - playerskills[maxSkill] >= 0.8) {
			limit = 'High';
		}

		var pr = {
			maxSkill: maxSkill, isGK: isGK, undef: undef, limit: limit,
			formLow: formLow, formAvg: formAvg, formHigh: formHigh,
			wageLow: wageLow, wageAvg: wageAvg, wageHigh: wageHigh
		};

		return pr;
	}
};
