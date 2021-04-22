/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
	"use strict";

	var XMLWriter	= require("xml-writer"),
		fs			= require("fs-extra"),
		filesizeParser = require('filesize-parser'),
		filesize	= require('file-size'),
		utils;//		= require("./utils"); // utils has dependency on TMP directory, it will be initialized in _init

	/**
	 * Arguments passed to the node process.
	 * locale, os, platform, license, currentUpdateId, updatesDir
	 */
	var options = {};

	var newLine = "\r\n";

	function _init() {
		process.argv.forEach(
			function (element, index, array) {
				// Argument is passed as a name-value pair with '=' as a delimiter eg. locale=en_US
				var option = element.split("=");
				if (option.length === 2) {
					// options[name] = value;
					options[option[0]] = option[1];
				}
			}
		);

		try {
			if (!options.updatesDir || !fs.existsSync(options.updatesDir)) {
				return false;
			}

			// Make sure that Log directory exists.
			fs.ensureDirSync(options.updatesDir + "/Log");
			options.logFile = options.updatesDir + "/Log/log.txt";

			// Make sure that 'Iam/Strings' directory exists.
			fs.ensureDirSync(options.updatesDir + "/Iam");
			fs.ensureDirSync(options.updatesDir + "/Iam/Strings");
			options.updatesPropertiesFile = options.updatesDir + "/Iam/Strings/updatesInfo.properties";
			options.patchPropertiesFile = options.updatesDir + "/Iam/Strings/patchInfo.properties";
            options.notificationPropertiesFile = options.updatesDir + "/Iam/Strings/notificationInfo.properties";

			// Make sure that 'Marker' directory exists.
			fs.ensureDirSync(options.updatesDir + "/Marker");
			options.markerFile = options.updatesDir + "/Marker/processComplete";

			// Make sure that 'Tmp' directory exists.
			fs.ensureDirSync(options.updatesDir + "/Tmp");
            process.env.TMPDIR = options.updatesDir + "/Tmp";

            // Initialize utils
    		utils = require("./utils");
        } catch (e) {
			return false;
		}

		options.locale = options.locale || "en_US";
		return true;
	}

	function _log(msg) {
		try {
			if (options.logFile) {
				var ts = new Date();
				var tsStr = ts.toDateString() + " " + ts.toLocaleTimeString('en-US', { hour12: false });
				fs.appendFileSync(options.logFile, tsStr + ": " + msg + newLine, {encoding : 'utf8'});
			}
		} catch (e) {}
	}

	function _writeMarkerFile(success) {
		try {
			if (options.markerFile) {
				var str = success ? "Success" : "Error";
				fs.appendFileSync(options.markerFile, str, {encoding : 'utf8'});
			}
		} catch (e) {}
	}

	/**
	 * Write mentioned updates' information to a properties file.
	 *
	 * @param {Array.<Update>, Patch, Notification, String}
	 * Update - Object contains id, url, checksum, locales (optional), oses (optional), platforms (optional), licenses (optional)
	 * Patch - Object contains title, description
	 */
	function _toPropertiesFile(updates, patch, notification) {
		var count = 0,
			size = 0,
			i = 0,
			j = 0;

		if (updates.length > 0) {

			// If updates are not downloaded then log count.
			if (!updates.downloaded) {
				_log("Total " + updates.length + " update(s) available.");
			}

			// 1. Mark duplicate updates based on the title
			for (i = updates.length - 1; i >= 0; i--) {
				if (!updates[i].duplicate) {
					updates[i].duplicate = false;
					if (updates[i].title) {
						for (j = 0; j < i; j++) {
							if (updates[i].title === updates[j].title) {
								updates[j].duplicate = true;
							}
						}
					}
				}
			}

			// 2. Write properties of updates to a file
			updates.forEach(
				function (update, index, array) {

					// Sizes of all updates, including duplicates, need to be considered
					if (update.size) {
						var updateSize = parseInt(filesizeParser(update.size), 10) || 0;
						size = size + updateSize;
					}

					// If its not duplicate, write its properties
					if (!update.duplicate) {
						var prefix = newLine + "UPDATE_" + count + "_";
						var str = newLine;

						if (update.title) {
							str = str + prefix + "TITLE = " + update.title;
						}
						if (update.version) {
							str = str + prefix + "VERSION = " + update.version;
						}
						if (update.description) {
							str = str + prefix + "DESC = " + update.description;
						}
						if (update.link) {
							str = str + prefix + "LINK = " + update.link;
						}
						try {
							fs.appendFileSync(options.updatesPropertiesFile, str, {encoding : 'utf8'});
						} catch (e1) {}

						// Increment total count of updates
						count++;
					}
				}
			);

			// 3. Write size and count of all updates
			try {

				// Convert KIB -> KB and MIB -> MB
				var sizeStr = filesize(size).human();
				sizeStr = sizeStr.replace(/KIB/i, "KB");
				sizeStr = sizeStr.replace(/MIB/i, "MB");
                if (options.locale === "pl_PL" || options.locale === "cs_CZ") {
                    sizeStr = sizeStr.replace(/\./i, ",");
                }

				var str = newLine;
				str =  str + newLine + "UPDATES_SIZE = " + sizeStr;
				str =  str + newLine + "UPDATES_COUNT = " + count;
				str =  str + newLine + "UPDATES_LOCALE = " + options.locale;
				fs.appendFileSync(options.updatesPropertiesFile, str, {encoding : 'utf8'});
			} catch (e2) {}
		}

		if (patch) {

			// 4. Write properties of a patch to a file
			try {
				if (patch.title && patch.description) {

					// Log info
					_log("Dreamweaver patch available.");

					var patchStr = newLine + "PATCH_TITLE = " + patch.title;
					patchStr = patchStr + newLine + "PATCH_DESC = " + patch.description;

					fs.appendFileSync(options.patchPropertiesFile, patchStr, {encoding : 'utf8'});
				}

			} catch (e3) {}
		}

        if (notification) {
		    // 5. Write properties of a notification to a file
            try {
				if (notification.id && notification.title && notification.description) {
                    var notificationStr = newLine + "NOTIFICATION_TITLE = " + notification.title;
                    notificationStr = notificationStr + newLine + "NOTIFICATION_ID = " + notification.id;
                    notificationStr = notificationStr + newLine + "NOTIFICATION_DESC = " + notification.description;
                    
                    if (notification.image_url) {
                        notificationStr = notificationStr + newLine + "NOTIFICATION_IMG_URL = " + notification.image_url;
                    }
                    if (notification.link) {
                        notificationStr = notificationStr + newLine + "NOTIFICATION_IMG_CALL_TO_ACTION = " + notification.link;
                    }
                    if (notification.button_desc) {
                        notificationStr = notificationStr + newLine + "NOTIFICATION_BTN_DESC = " + notification.button_desc;
                    }
                    
                    if (notification.script) {
                        notificationStr = notificationStr + newLine + "NOTIFICATION_CALL_TO_ACTION = " + notification.script;
                    }
                    
                    
                    fs.appendFileSync(options.notificationPropertiesFile, notificationStr, {encoding : 'utf8'});
                    // Log info
					_log("Dreamweaver notification available.");
				}

			} catch (e4) {}
        }

		// 6. Mark that process is complete
		_writeMarkerFile(true);
	}

	/**
	 * Download mentioned updates.
	 *
	 * @param {Array.<Update>} array of updates
	 * Update - Object contains id, url, checksum, locales (optional), oses (optional), platforms (optional), licenses (optional)
	 */
	function _downloadAll(updates) {
		var index = -1;

		// Log ingo
		if (updates.length > 0) {
			_log("Downloading " + updates.length + " update(s).");
		}

		// Export successful ids to install.xml. 
		function _export() {

			// When this function gets called, index will always be 
			// pointing to one after the last successful element. 
			if (index > 0) {

				// 1. Start document
				var xw = new XMLWriter(true);
				xw.startDocument();
				xw.startElement("updates");

				var i;
				for (i = 0; i < index; i++) {
					// 2. Add update elements
					xw.startElement("update");
					xw.writeAttribute("id", updates[i].id);
					xw.endElement();
				}

				// 3. End document
				xw.endElement();
				xw.endDocument();

				// 4. Write xml
				var installXml = options.updatesDir + "/Install/install.xml";
				fs.writeFile(installXml, xw.toString(), {encoding: "utf8"}, function (err) {});
			}

			// 5. If download is successful, then write to properties file, else mark process complete.
			var success = (index === updates.length);
			if (success) {
				updates.downloaded = true;
				_toPropertiesFile(updates, null);
			} else {
				_writeMarkerFile(false);
			}
		}

		// Merge contents of srcDir into desDir. Its a sync function.
		function _mergeSync(srcDir, dstDir) {

			var files = fs.readdirSync(srcDir);
			files.forEach(function (file) {

				var srcPath = srcDir + "/" + file;
				var dstPath = dstDir + "/" + file;

				var stats = fs.statSync(srcPath);
				if (stats.isFile()) {

					if (fs.existsSync(dstPath)) {
						fs.removeSync(dstPath);
					}
					fs.ensureDirSync(dstDir);
					fs.renameSync(srcPath, dstPath);

				} else if (stats.isDirectory()) {
					_mergeSync(srcPath, dstPath);
				}
			});
		}

		// Process extracted update directory. Its a sync function.
		function _processDirSync(dir) {

			try {
				// 1. Merge locale configuration directory
				var config = dir + "/Configuration";
				var localeConfig = dir + "/" + options.locale + "/Configuration";
				if (fs.existsSync(localeConfig)) {
					_mergeSync(localeConfig, config);
				}

				// 2. Remove update directory, if exists
				var installDir = options.updatesDir + "/Install";
				var updateDir = installDir + "/" + updates[index].id;
				fs.ensureDirSync(installDir);
				if (fs.existsSync(updateDir)) {
					fs.removeSync(updateDir);
				}

				// 3. Move update to final location
				fs.renameSync(dir, updateDir);

			} catch (e) {
				_log("Error: " + e.message);
				return false;
			}
			return true;
		}

		// Download next update
		function _downloadNext() {
			index++;

			if (index >= updates.length) {
				_export();

				if (updates.length > 0) {
					_log("Process completed successfully.");
				}
				return;
			}

			if (updates[index].id) {
				_log("Downloading update with id " + updates[index].id);
			}

			utils.downloadUpdate(updates[index], function (error, dir) {
				if (error) {
					_log("Error: " + error);
					_export();
					return;
				}

				if (!_processDirSync(dir)) {
					_export();
					return;
				}

				_downloadNext();
			});
		}

		// Start download
		_downloadNext();
	}

	// 1. Initialization
	if (!_init()) {
		_writeMarkerFile(false);
		return;
	}

	// 2. Get list of applicable updates
	utils.listUpdates(options, function (error, updates, patch, notification) {
	    if (error) {
			_writeMarkerFile(false);
			_log("Error: An error occurred while checking for updates - " + error);
			return;
		}

		// 3. Download updates or info
		if (options.download === "info") {
			_toPropertiesFile(updates, patch, notification);
		} else {
			_downloadAll(updates);
		}
	});

}());
