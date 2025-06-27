/**
 * chromeversion.js
 * Display a Foxtrick Note when a new chrome version is available.
 * Temporary module while chrome users are installing in developer mode.
 * @author UnnecessaryDave
 */

'use strict';

Foxtrick.modules['NotifyChromeVersion'] = {
    MODULE_CATEGORY: Foxtrick.moduleCategories.ALERT,
    PAGES: ['dashboard'],

    /**
     * Firefox update.json url used to find the latest release version number
     * - Chrome and Firefox version numbers are in sync.
     */
    UPDATE_JSON_URL: 'https://foxtrick-ng.github.io/download/release/firefox/update.json',
    
    /** Extension GUID */
    GUID: '{bcfe9090-dfc6-41d6-a49c-127432ec04ea}', // release branch

    /** Chrome update instructions url */
    CHROME_UPDATE_URL: 'https://foxtrick-ng.github.io/chromeupgrade.html',

    /** How often to check for updates (milliseconds) */
    CHECK_INTERVAL: Foxtrick.util.time.MSECS_IN_DAY,

    /**
     * Session store key
     * - Associated value is timestamp when update note was displayed.
     */
    SEEN_NOTE_KEY: `NotifyChromeVersion.seenUpdateNote`,

    /**
     * Session store key
     * - Associated value is timestamp after which another check may be performed.
     */
    NEXT_CHECK_KEY: `NotifyChromeVersion.nextCheck`,

    run: async function(doc) {
        /** @ts-ignore */
        if (!navigator.userAgentData) // only defined in chromium browsers
            return;

        const MODULE = this;
        const log = MODULE.log.bind(MODULE);

        /**
         * Timestamp representing the current time
         * - Foxtrick.load() uses UTC HT_TIME for comparisons, so we do the same.
         */
        const NOW = Foxtrick.modules.Core.HT_TIME || Date.now();

        try {
            // Only show note once per session.
            const seenNoteTs = await Foxtrick.session.get(MODULE.SEEN_NOTE_KEY);
            if (seenNoteTs) {
                log(`Update note seen on ${new Date(seenNoteTs).toUTCString()}`);
                return;
            }

            // Return if next check is not due.
            const nextCheck = await Foxtrick.session.get(MODULE.NEXT_CHECK_KEY);
            if (nextCheck && NOW <= nextCheck) {
                log(`Next check: ${new Date(nextCheck).toUTCString()} | Now: ${new Date(NOW).toUTCString()}`);
                return;
            }

            // Load update.json
            log(`Loading ${MODULE.UPDATE_JSON_URL}`);
            let jsonText;
            try {
                jsonText = await Foxtrick.load(MODULE.UPDATE_JSON_URL, undefined, NOW);
            } catch (e) {
                log(`Failed to load ${MODULE.UPDATE_JSON_URL}: ${e}`);
                return;
            }
            Foxtrick.session.set(MODULE.NEXT_CHECK_KEY, NOW + MODULE.CHECK_INTERVAL);

            // Parse updates array in json.
            let updates;
            try {
                /** @ts-ignore - if jsonText is not a string, FetchError will be caught in try/catch above */
                const json = JSON.parse(jsonText);
                updates = json.addons?.[MODULE.GUID]?.updates;
                if (!updates) throw new TypeError(`json.addons.[${MODULE.GUID}].updates not found`);
            } catch (e) {
                log(`Error parsing updates: ${e}`);
                return;
            }

            // Find latest version.
            let latestVersion = updates.reduce((maxVer, v) =>
                v.version && v.version.localeCompare(maxVer) > 0 ? v.version : maxVer, '0');

            // Display note if update available.
            if (Foxtrick.version.localeCompare(latestVersion) < 0) {
                MODULE.showUpdateNote(doc, latestVersion, NOW);
            }
        } catch (e) {
            log(`Unexpected error: ${e}`);
        }
    },

    // TODO: Internationalise once we can add new l10n keys.
    showUpdateNote: function(doc, latestVersion, now) {
        const MODULE = this;

        const container = doc.createElement('div');
        const p = doc.createElement('p');
        container.appendChild(p);

        const a = doc.createElement('a');
        a.href = MODULE.CHROME_UPDATE_URL;
        a.textContent = 'here';
        a.target = '_blank';

        p.innerHTML =
            `A new version of Foxtrick is available: ${latestVersion}` +
            doc.createElement('br').outerHTML +
            ` - Click ${a.outerHTML} for update instructions.`;

        Foxtrick.util.note.add(doc, container, 'ft-notify-chrome-version');
        Foxtrick.session.set(MODULE.SEEN_NOTE_KEY, now);
    },

    /**
     * Logging helper function
     * - Uses Foxtrick.log() to log messages with the module name as prefix.
     * @param {String} text - The message to log.
     */
    log: function(text) {
        Foxtrick.log(`${this.MODULE_NAME || 'NotifyChromeVersion'}: ${text}`);
    }
};