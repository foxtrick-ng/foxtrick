/**
 * context-menu-copy.js
 * Options at the context menu for copying ID and/or link and content in HT-ML
 * @author LA-MJ, convinced, ryanli
 */

'use strict';

const ContextMenuCopy = {
    // event handler that populates the menu as per the request
    // sent from the browser after right-click
    handler: async function(request) {
        const documentUrlPatterns = [
            '*://*.hattrick.org/*',
        ];

        // removeAll is only Promisified in chrome 123+
        await new Promise(resolve => chrome.contextMenus.removeAll(resolve));

        // add new entries
        for (let type in request.entries) {
            let source = request.entries[type];

            chrome.contextMenus.create({
                id: type,
                title: source.title,
                contexts: ['all'],
                documentUrlPatterns,
            });
        }
    }
}

// add menu onClick listener - sends message to content script
// telling it which entry in the menu was clicked
if (!ContextMenuCopy._onClicked) {
    ContextMenuCopy._onClicked = async function(info, tab) {
        if (tab && tab.id != null) {
        chrome.tabs.sendMessage(tab.id, { type: 'ft-context-menu-copy', menuId: info.menuItemId });
        }
    };
    chrome.contextMenus.onClicked.addListener(ContextMenuCopy._onClicked);
}

export {ContextMenuCopy};