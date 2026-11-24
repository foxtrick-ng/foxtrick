'use strict';
/**
 * new-mail.js
 * Script which makes the new mails more visible
 * @author htbaumanns, ryanli
 */

Foxtrick.modules['NewMail'] = {
	MODULE_CATEGORY: Foxtrick.moduleCategories.ALERT,
	OUTSIDE_MAINBODY: true,
	PAGES: ['all'],
	OPTIONS: ['NotifyMail', 'NotifyMailSound', 'NotifyForum', 'NotifyForumSound'],
	OPTION_EDITS: true,
	OPTION_EDITS_DISABLED_LIST: [true, false, true, false],
	OPTION_EDITS_DATAURL_LOAD_BUTTONS: [false, true, false, true],
	OPTION_EDITS_DATAURL_IS_SOUND: [false, true, false, true],


	CSS: Foxtrick.InternalPath + 'resources/css/new-mail.css',

	// eslint-disable-next-line complexity
	exec: function(doc, mailCount, forumCount, tickerForumNotified) {
		const MODULE = this;

		// the flag only covers forum replies notified by TickerAlert since the previous page load
		Foxtrick.sessionSet('tickerForumNotified', false);

		const MAIL_URL = doc.location.origin + '/MyHattrick/Inbox/';
		const FORUM_URL = doc.location.origin + '/Forum/?actionType=refresh';

		const OPEN = Foxtrick.L10n.getString('notify.open');
		const MAIL_OPTS = {
			id: 'mail',
			buttons: [{ title: OPEN }],
		};
		const FORUM_OPTS = {
			id: 'forum',
			buttons: [{ title: OPEN }],
		};

		var oldMailCount = mailCount || 0;
		var oldForumCount = forumCount || 0;

		// mail count within My Hattrick link
		var newMailCount = 0;

		let menu = doc.getElementById('menu');
		let myHt = menu.querySelector('a[href^="/MyHattrick/"]');
		if (!myHt)
			return;

		if (myHt.getElementsByTagName('span').length) {
			let mailCountSpan = myHt.getElementsByTagName('span')[0];
			newMailCount = parseInt(mailCountSpan.textContent.match(/\d+/)[0], 10) || 0;
		}

		Foxtrick.sessionSet('mailCount', newMailCount);
		if (Foxtrick.Prefs.isModuleOptionEnabled('NewMail', 'NotifyMail')
			&& newMailCount > oldMailCount) {

			let mailL10n = Foxtrick.L10n.getString('notify.newMail', newMailCount);
			let mailMsg = mailL10n.replace(/%s/, newMailCount);

			Foxtrick.util.notify.create(mailMsg, MAIL_URL, MAIL_OPTS)
				.catch(e => e.message != Foxtrick.TIMEOUT_ERROR ? Promise.reject(e) : e)
				.catch(Foxtrick.catch(MODULE));

			// play sound if enabled
			if (Foxtrick.Prefs.isModuleOptionEnabled('NewMail', 'NotifyMailSound')) {
				let sound = Foxtrick.Prefs.getString('module.NewMail.NotifyMailSound_text');
				Foxtrick.playSound(sound);
			}
		}

		// new forum message
		var newForumCount = 0;

		// unread forum replies are shown as a badge inside the Forum menu link
		let forum = menu.querySelector('a[href^="/Forum/"]');
		let forumBadge = forum && forum.querySelector('.unread-badge');
		if (forumBadge) {
			let count = forumBadge.textContent.match(/\d+/);
			newForumCount = count ? parseInt(count[0], 10) : 0;
		}

		// TickerAlert notifies supporters about forum replies shown as new in the ticker
		let hasNewForumTicker = function() {
			if (!Foxtrick.util.layout.isSupporter(doc)
				|| !Foxtrick.Prefs.isModuleEnabled('TickerAlert')
				|| !Foxtrick.Prefs.getBool('module.TickerAlert.forum.enabled'))
				return false;

			let ticker = doc.getElementById('ticker');
			if (!ticker)
				return false;

			return Foxtrick.any(function(entry) {
				let link = entry.querySelector('a');
				return !!link && !!entry.querySelector('strong') && /\/Forum/i.test(link.href);
			}, ticker.getElementsByTagName('div'));
		};

		Foxtrick.sessionSet('forumCount', newForumCount);
		if (Foxtrick.Prefs.isModuleOptionEnabled('NewMail', 'NotifyForum')
			&& newForumCount > oldForumCount
			&& !tickerForumNotified
			&& !hasNewForumTicker()) {

			let forumL10n = Foxtrick.L10n.getString('notify.newMail', newForumCount);
			let forumMsg = forumL10n.replace(/%s/, newForumCount);

			Foxtrick.util.notify.create(forumMsg, FORUM_URL, FORUM_OPTS)
				.catch(e => e.message != Foxtrick.TIMEOUT_ERROR ? Promise.reject(e) : e)
				.catch(Foxtrick.catch(MODULE));

			// play sound if enabled
			if (Foxtrick.Prefs.isModuleOptionEnabled('NewMail', 'NotifyForumSound')) {
				let sound = Foxtrick.Prefs.getString('module.NewMail.NotifyForumSound_text');
				Foxtrick.playSound(sound);
			}
		}
		// Foxtrick.log('oldCount', oldCount)
		// Foxtrick.log('newCount', newForumCount, newMailCount)
	},

	run: function(doc) {
		const MODULE = this;

		Promise.all([
			Foxtrick.session.get('mailCount'),
			Foxtrick.session.get('forumCount'),
			Foxtrick.session.get('tickerForumNotified'),
		])
			.then(function(args) {
				args.unshift(doc);
				MODULE.exec.apply(MODULE, args);
			})
			.catch(Foxtrick.catch(MODULE));

	},
};
