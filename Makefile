APP_NAME = foxtrick

# distribution type (used for build logic):
# hosted - direct download from foxtrick web server
# repo - download from mozilla or chrome extension repo
DIST_TYPE = hosted

# branch name (used in prefs etc):
# dev, release, prerelease
BRANCH = dev

ZIP = zip -q

VERSION := $(shell git describe --long | sed -E 's/([^-]+)-g.*/\1/;s/-/./g')
HASH := $(shell git rev-parse --short HEAD)

# URL prefix of update manifest
UPDATE_URL = https://foxtrick-ng.github.io/download

FF_ADDON_ID = '{bcfe9090-dfc6-41d6-a49c-127432ec04ea}'
ifeq ($(BRANCH),prerelease)
	FF_ADDON_ID = '{4b64746e-3984-4364-a7de-cd462be9e844}'
endif
BRANCH_FULL = $(BRANCH)-$(HASH)

MODULES = modules
#IGNORED_MODULES = ignored-modules-$(DIST_TYPE)
# for the moment we use this
IGNORED_MODULES = ignored-modules-$(BRANCH)

#
# files section
#

ifeq ($(BRANCH),dev)
BUILD_ROOT = build-dev
else
BUILD_ROOT = build
endif
chrome _ : BUILD_DIR = $(BUILD_ROOT)/chrome
clean-chrome _ : BUILD_DIR = $(BUILD_ROOT)/chrome
firefox _ : BUILD_DIR = $(BUILD_ROOT)/firefox
clean-firefox _ : BUILD_DIR = $(BUILD_ROOT)/firefox

MANIFEST_CHROME = manifest-mv3.json
MANIFEST_FIREFOX = manifest-mv2.json

ROOT_FILES = \
	COPYING \
	HACKING.md \

ifeq ($(BRANCH),dev)
ROOT_FOLDERS= \
	defaults/ \
	skin/ \
	res/
else
ROOT_FOLDERS= \
	defaults/ \
	skin/
endif

ROOT_FOLDERS_CHROME = $(ROOT_FOLDERS) \
	background/

ROOT_FOLDERS_FIREFOX = $(ROOT_FOLDERS) \

SCRIPT_FOLDERS = \
	api/ \
	lib/ \
	pages/ \
	util/ \

RESOURCES = \
	data/ \
	locale/ \
	resources/ \
	faq-links.yml \
	faq.yml \
	foxtrick.properties \
	foxtrick.screenshots \
	privacy.yml \
	release-notes-links.yml \
	release-notes.yml \

CONTENT_FILES = \
	add-class.js \
	core.js \
	entry.js \
	env.js \
	fix-links.js \
	forum-stage.js \
	l10n.js \
	pages.js \
	prefs-util.js \
	read-ht-prefs.js \
	redirections.js \
	ui.js \
	xml-load.js \
	background.html \
	background.js \
	loader-chrome.js \
	popup.html \
	popup.js \
	preferences.html \
	preferences.js \

CONTENT_FILES_CHROME = $(CONTENT_FILES) \

CONTENT_FILES_FIREFOX = $(CONTENT_FILES) \

#
# target section
#

all: firefox chrome

firefox:
	#
	############ make firefox ############
	#
	# $(VERSION) $(BRANCH)

	# create build dir
ifeq ($(BRANCH),dev)
	[ -d $(BUILD_DIR) ] || mkdir -p $(BUILD_DIR)
else
	make clean-firefox
	mkdir -p $(BUILD_DIR)
endif

	# copy root files
	cp -ur $(ROOT_FILES) $(ROOT_FOLDERS_FIREFOX) $(BUILD_DIR)

	# copy manifest
	# - note: this will not propagate manifest changes to build-dev/firefox
	# - do make clean-firefox and restart mozilla web-ext
	[ -f $(BUILD_DIR)/manifest.json ] || cp $(MANIFEST_FIREFOX) $(BUILD_DIR)/manifest.json

	# content/
	[ -d $(BUILD_DIR)/content ] || mkdir $(BUILD_DIR)/content
	cd content/; \
	cp -ur $(SCRIPT_FOLDERS) $(RESOURCES) $(CONTENT_FILES_FIREFOX) \
		../$(BUILD_DIR)/content

	# modules
	cd content/; \
	cat ../$(MODULES) | while read m; do cp --parents -u "$$m" ../$(BUILD_DIR)/content; done;

	# remove ignore modules from files
	python module-update.py build -s $(MODULES) -e $(IGNORED_MODULES) -d $(BUILD_DIR)/

ifneq ($(BRANCH),dev)
	#set branch
	cd $(BUILD_DIR); \
	sed -i -r "/extensions\\.foxtrick\\.prefs\\.branch/s|\"dev\"|\"$(BRANCH_FULL) firefox\"|" defaults/preferences/foxtrick.js;
endif

	# set id and version
	cd $(BUILD_DIR); \
	sed -i -r 's|("id": ").+(")|\1$(FF_ADDON_ID)\2|' manifest.json; \
	sed -i -r 's|("version": ").+(")|\1$(VERSION)\2|' manifest.json; \
	sed -i -r "/extensions\\.foxtrick\\.prefs\\.version/s|\"[0-9.]+\"|\"$(VERSION)\"|" defaults/preferences/foxtrick.js;

	# set name
ifeq ($(BRANCH),release)
	cd $(BUILD_DIR); \
	sed -i -r 's|("name": ").+(")|\1Foxtrick (NG)\2|' manifest.json
else
	cd $(BUILD_DIR); \
	sed -i -r 's|("name": ").+(")|\1Foxtrick ($(BRANCH))\2|' manifest.json
endif

ifeq ($(DIST_TYPE),repo)
	# remove update_url
	cd $(BUILD_DIR); \
	sed -i -r '/update_url/d' manifest.json
else
	# set update_url
	cd $(BUILD_DIR); \
	sed -i -r 's|("update_url": ").+(")|\1'$(UPDATE_URL)'/'$(BRANCH)'/firefox/update.json\2|' manifest.json
endif

	# make android-prefs after all modifications are done
	cd $(BUILD_DIR)/defaults/preferences; \
	cat foxtrick.js foxtrick.android > foxtrick.android.js; \
	rm foxtrick.android

	# strip manifest comments
	cd $(BUILD_DIR); \
	sed -i -r '/\/\/ <!--/d' manifest.json

ifeq ($(BRANCH),dev)

else
	# make xpi
	cd $(BUILD_DIR); \
	$(ZIP) -r ../$(APP_NAME)-$(VERSION).xpi *
	# clean up
	make clean-firefox
endif

	#
	# firefox build complete $(VERSION) $(BRANCH)
	#

chrome:
	#
	############ make chrome ############
	#
	# $(VERSION) $(BRANCH)

ifeq ($(BRANCH),dev)
	[ -d $(BUILD_DIR) ] || mkdir -p $(BUILD_DIR)
else
	make clean-chrome
	mkdir -p $(BUILD_DIR)
endif

	# copy root files
	cp -ur $(ROOT_FILES) $(ROOT_FOLDERS_CHROME) $(BUILD_DIR)

	# copy manifest
	cp $(MANIFEST_CHROME) $(BUILD_DIR)/manifest.json

	# remove manifest gecko info
	cd $(BUILD_DIR); \
	sed -i '/<!-- gecko-specific -->/,/<!-- end gecko-specific -->/d' manifest.json

	# content/
	[ -d $(BUILD_DIR)/content ] || mkdir $(BUILD_DIR)/content
	cd content/; \
	cp -ur $(SCRIPT_FOLDERS) $(RESOURCES) $(CONTENT_FILES_CHROME) \
		../$(BUILD_DIR)/content

	# modules
	cd content/; \
	cat ../$(MODULES) | while read m; do cp --parents -u "$$m" ../$(BUILD_DIR)/content; done;

	# remove ignore modules from files
	python module-update.py build -s $(MODULES) -e $(IGNORED_MODULES) -d $(BUILD_DIR)/

ifneq ($(BRANCH),dev)
	# set branch
	cd $(BUILD_DIR); \
	sed -i -r "/extensions\\.foxtrick\\.prefs\\.branch/s|\"dev\"|\"$(BRANCH_FULL) chrome\"|" defaults/preferences/foxtrick.js
endif

	# add version
	cd $(BUILD_DIR); \
	sed -i -r 's|("version": ").+(")|\1$(VERSION)\2|' manifest.json; \
	sed -i -r "/extensions\\.foxtrick\\.prefs\\.version/s|\"[0-9.]+\"|\"$(VERSION)\"|" defaults/preferences/foxtrick.js;

	# change name
ifeq ($(BRANCH),release)
	cd $(BUILD_DIR); \
	sed -i -r 's|("name": ").+(")|\1Foxtrick (NG)\2|' manifest.json
else
	cd $(BUILD_DIR); \
	sed -i -r 's|("name": ").+(")|\1Foxtrick ($(BRANCH))\2|' manifest.json
endif

	# strip manifest comments
	cd $(BUILD_DIR); \
	sed -i -r '/\/\/ <!--/d' manifest.json

ifeq ($(DIST_TYPE),repo)
	# make crx
	cd $(BUILD_DIR); \
	sed -i -r 's|("update_url": ").+(")|\1'$(UPDATE_URL)'/chrome/update.xml\2|' manifest.json; \
	./maintainer/crxmake.sh $(BUILD_DIR) maintainer/chrome.pem
	mv $(BUILD_DIR).crx $(APP_NAME).crx
else ifeq ($(BRANCH),dev)

else
	# make zip
	cd $(BUILD_DIR); \
	sed -i -r '/update_url/d' manifest.json; \
	$(ZIP) -r ../$(APP_NAME)-$(VERSION).zip *
	# clean up
	make clean-chrome
endif

	#
	# chrome build complete $(VERSION) $(BRANCH)
	#

clean-firefox:
	rm -rf $(BUILD_DIR)

clean-chrome:
	rm -rf $(BUILD_DIR)

clean-build:
	rm -rf $(BUILD_ROOT)

clean: clean-firefox clean-chrome clean-build
