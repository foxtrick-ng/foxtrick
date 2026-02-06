/**
 * Transfer list deadline
 * @author spambot, ryanli
 */

'use strict';

Foxtrick.modules['TransferDeadline'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.INFORMATION_AGGREGATION,
	PAGES: ['transferSearchResult', 'playerDetails', 'transfer', 'bookmarks'],
	CSS: Foxtrick.InternalPath + 'resources/css/transfer-deadline.css',

	/** @type {WeakSet<Document> | null} */
	_runLocks: null,

	run: async function(doc) {
		if (this._runLocks?.has(doc))
			return;

		// Check if deadline already set
		if (doc.getElementsByClassName('ft-deadline').length > 0)
			return;

		if (!this._runLocks)
			this._runLocks = new WeakSet();

		this._runLocks.add(doc);
		try {
			if (Foxtrick.isPage(doc, 'transferSearchResult'))
				await this.runTransferResult(doc);
			else if (Foxtrick.isPage(doc, 'playerDetails'))
				await this.runPlayerDetail(doc);
			else if (Foxtrick.isPage(doc, 'transfer'))
				await this.runPlayerList(doc);
			else if (Foxtrick.isPage(doc, 'bookmarks'))
				await this.runTransferResult(doc);
		} catch (e) {
			Foxtrick.log(e);
		} finally {
			this._runLocks?.delete(doc);
		}
	},

	change: async function(doc) {
		if (this._runLocks?.has(doc))
			return;

		if (Foxtrick.isPage(doc, 'playerDetails'))
			await this.runPlayerDetail(doc);
		else if (Foxtrick.isPage(doc, 'bookmarks'))
			await this.runTransferResult(doc);
		else if (Foxtrick.isPage(doc, 'transfer'))
			await this.runPlayerList(doc);
	},

	processNode: async function(node, userTime) {
		const MSECS = Foxtrick.util.time.MSECS_IN_SEC;

		var dateNode;
		if (node.matches('.date, [id*="lblDeadline"]')) {
			if (node.parentNode.matches('.date, [id*="lblDeadline"]'))
				return;

			dateNode = node;
		}
		else {
			dateNode = node.querySelector('.date, [id*="lblDeadline"]');
		}

		if (!dateNode)
			return;

		if (node.querySelector('.ft-deadline'))
			return;

		var deadline;
		if (dateNode.dataset.userDate) {
			// node displays local time instead of user time as modified
			// in LocalTime, user time is saved in attribute data-user-date
			deadline = new Date();
			deadline.setTime(dateNode.dataset.userDate);
		}
		else if (dateNode.dataset.isodate) {
			deadline = Foxtrick.util.time.getDateFromText(dateNode.dataset.isodate);
		}
		else {
			deadline = Foxtrick.util.time.getDateFromText(dateNode.textContent);
		}

		if (deadline) {
			let doc = node.ownerDocument;
			let countdown = Math.floor((deadline.getTime() - userTime) / MSECS);
			if (!isNaN(countdown) && countdown >= 0) {
				let countdownNode = doc.createElement('span');
				countdownNode.className = 'smallText ft-deadline nowrap';
				let span = await Foxtrick.util.time.timeDiffToSpan(doc, countdown);
				countdownNode.textContent = '(' + span.textContent + ')';
				Foxtrick.makeFeaturedElement(countdownNode, this);
				node.appendChild(countdownNode);
			}
		}
	},

	runTransferResult: async function(doc) {
		var userDate = Foxtrick.util.time.getDate(doc);
		if (!userDate) {
			Foxtrick.log('User time missing');
			return;
		}
		var userTime = userDate.getTime();
		var dates = doc.querySelectorAll('.date, [id*="lblDeadline"]');
		for (let date of dates)
			await this.processNode(date, userTime);
	},

	runPlayerList: async function(doc) {
		// FIXME
		var userDate = Foxtrick.util.time.getDate(doc);
		if (!userDate) {
			Foxtrick.log('User time missing');
			return;
		}

		var userTime = userDate.getTime();
		var i = 0;
		var MAIN = Foxtrick.getMainIDPrefix();
		var idPrefix = MAIN + 'lstBids_ctrl';
		var element;
		while ((element = doc.getElementById(idPrefix + i++ + '_jsonDeadLine')))
			await this.processNode(element, userTime);
	},

	runPlayerDetail: async function(doc) {
		if (Foxtrick.Pages.Player.wasFired(doc))
			return;

		var userDate = Foxtrick.util.time.getDate(doc);
		if (!userDate) {
			Foxtrick.log('User time missing');
			return;
		}

		var userTime = userDate.getTime();

		var div = Foxtrick.Pages.Player.getBidInfo(doc);
		if (!div)
			return;

		var alert = div.querySelector('.alert');
		if (!alert)
			return;

		var sellTimeEl = alert.querySelector('p');
		if (!sellTimeEl)
			return;

		// remove old deadlines
		var oldDeadline = sellTimeEl.getElementsByClassName('ft-deadline');
		for (var i = 0; i < oldDeadline.length; ++i)
			oldDeadline[i].parentNode.removeChild(oldDeadline[i]);

		await this.processNode(sellTimeEl, userTime);
	},
};
