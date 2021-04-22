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

"use strict";

var request			= require("request"),
	fs				= require("fs-extra"),
	temp			= require("temp").track(),
	crypto			= require("crypto"),
	DecompressZip	= require("decompress-zip");

var Errors = {
	NO_SERVER_RESPONSE: "No server response",
	BAD_HTTP_STATUS: "Bad HTTP status code",
	CANNOT_WRITE_TEMP: "Could not write to temporary file",
	INVALID_JSON: "Invalid JSON file",
	BAD_PARAM: "Invalid parameter",
	BAD_CHECKSUM: "Checksum verification failed",
	BAD_ZIP: "Invalid or corrupted zip",
	INVALID_APP_VERSION: "Invalid App version"
};

var rootURL = "https://download.macromedia.com/pub/edgetools/dreamweaver/updates/";

// Check if update is applicable as per options
function _isUpdateApplicable(update, options) {
	if (!update || !update.id) {
		return false;
	}
	var currentUpdateId = parseInt(options.currentUpdateId, 10);
	var id = parseInt(update.id, 10);

	// Consider this update, only if its id is greater than the current id.
	if (isNaN(currentUpdateId) || isNaN(id) || id <= currentUpdateId) {
		return false;
	}
	if (!update.path && !update.url) {
		return false;
	}
	if (!update.checksum) {
		return false;
	}

	// Check if locales, oses, platforms are defined.
	// If not defined or if it contains current value then update is applicable.
	return ((!options.locale || !update.locales || update.locales.indexOf(options.locale) >= 0) &&
			(!options.os || !update.oses || update.oses.indexOf(options.os) >= 0) &&
			(!options.platform || !update.platforms || update.platforms.indexOf(options.platform) >= 0) &&
			(!options.license || !update.licenses || update.licenses.indexOf(options.license) >= 0));
}

// Check if notification is applicable as per options
function _isNotificationApplicable(notification, options) {
	
	if (!notification || !notification.id) {
		return false;
	}
	var lastSeenNotificationId = parseInt(options.currentNotificationId, 10);
	var id = parseInt(notification.id, 10);

	// Consider this notification, only if its id is greater than the current id.
	if (isNaN(lastSeenNotificationId) || isNaN(id) || id <= lastSeenNotificationId) {
		return false;
	}
	
	// Check if locales, oses, platforms are defined.
	// If not defined or if it contains current value then notification is applicable.
	return ((!options.locale || !notification.locales || notification.locales.indexOf(options.locale) >= 0) &&
			(!options.os || !notification.oses || notification.oses.indexOf(options.os) >= 0) &&
			(!options.platform || !notification.platforms || notification.platforms.indexOf(options.platform) >= 0) &&
			(!options.license || !notification.licenses || notification.licenses.indexOf(options.license) >= 0));
	
}

// Determine value of a property from various options
function _determineProperties(object, locale, updatesURL) {

	// 1. Determine 'url'
	if (!object.url && object.path) {
		// Remove path separator in the beginning
		if (object.path.charAt(0) === "/") {
			object.path = object.path.slice(1);
		}
		object.url = updatesURL + object.path;
	}

	// 2. Determine title
	if (!object.title && object.titles) {
		if (object.titles.hasOwnProperty(locale)) {
			object.title = object.titles[locale];
		} else if (object.titles.hasOwnProperty("en_US")) {
			object.title = object.titles.en_US;
		}
	}

	// 3. Determine description
	if (!object.description && object.descriptions) {
		if (object.descriptions.hasOwnProperty(locale)) {
			object.description = object.descriptions[locale];
		} else if (object.descriptions.hasOwnProperty("en_US")) {
			object.description = object.descriptions.en_US;
		}
	}

	// 4. Determine link
	if (!object.link && object.links) {
		if (object.links.hasOwnProperty(locale)) {
			object.link = object.links[locale];
		} else if (object.links.hasOwnProperty("en_US")) {
			object.link = object.links.en_US;
		}
	}
	
	// 5. Determine image url
	if (!object.image_url && object.image_urls) {
		if (object.image_urls.hasOwnProperty(locale)) {
			object.image_url = object.image_urls[locale];
		} else if (object.image_urls.hasOwnProperty("en_US")) {
			object.image_url = object.image_urls.en_US;
		}
	}
	
	// 5. Determine button description
	if (!object.button_desc && object.button_descs) {
		if (object.button_descs.hasOwnProperty(locale)) {
			object.button_desc = object.button_descs[locale];
		} else if (object.button_descs.hasOwnProperty("en_US")) {
			object.button_desc = object.button_descs.en_US;
		}
	}
	
	// 6. Determine script
	if (!object.script && object.scripts) {
		if (object.scripts.hasOwnProperty(locale)) {
			object.script = object.scripts[locale];
		} else if (object.scripts.hasOwnProperty("en_US")) {
			object.script = object.scripts.en_US;
		}
	}
}

/**
 * Lists all applicable updates.
 *
 * @param {Object} options - locale (en_US, ja_JP etc), os (win, mac), platform (32, 64), license (trial, subscription), currentUpdateId, appVersion, coreVersion
 * @param {function(Error, Array.<Update>)} callback function to call with an error and array of updates
 * Update - Object contains id, url, checksum, locales (optional), oses (optional), platforms (optional), licenses (optional)
 */
function _listUpdates(options, callback) {
	if (!options) {
		callback(Errors.BAD_PARAM, null, null);
		return;
	}

	if (!options.appVersion) {
		callback(Errors.INVALID_APP_VERSION, null, null);
		return;
	}

	options.currentUpdateId = options.currentUpdateId || "0";
	options.currentNotificationId = options.currentNotificationId || "0";
	options.locale = options.locale || "en_US";
	options.coreVersion = options.coreVersion || "v1";

	var updatesURL = rootURL + options.appVersion + "/" + options.coreVersion + "/";
	var jsonURL = updatesURL + "updates.json";

	request.get({
		url: jsonURL,
		encoding: "utf8"
	},
		function (error, response, body) {
			if (error) {
				callback(Errors.NO_SERVER_RESPONSE, null, null);
				return;
			}
			if (response.statusCode !== 200) {
				callback(Errors.BAD_HTTP_STATUS, null, null);
				return;
			}

			var jsonObj;
			try {
				jsonObj = JSON.parse(body);
			} catch (e) {
				callback(Errors.INVALID_JSON, null, null);
				return;
			}

			var updates = [];
			if (jsonObj.updates) {
				jsonObj.updates.forEach(
					function (update, index, array) {
						if (_isUpdateApplicable(update, options)) {
							_determineProperties(update, options.locale, updatesURL);
							updates.push(update);
						}
					}
				);
			}

			var patch = null;
			if (jsonObj.patch) {
				_determineProperties(jsonObj.patch, options.locale, updatesURL);
				if (jsonObj.patch.title && jsonObj.patch.description) {
					patch = jsonObj.patch;
				}
			}

			var notification = null;
			if (jsonObj.notification) {
				_determineProperties(jsonObj.notification, options.locale, updatesURL);
				if (jsonObj.notification.id && jsonObj.notification.title && jsonObj.notification.description) {
					if (_isNotificationApplicable(jsonObj.notification, options)) {
						notification = jsonObj.notification;
					}
				}
			}

			// On success pass updates
			callback(null, updates, patch, notification);
		});
}

// Extract zip in a temp directory
function _extract(zipPath, callback) {
	var unzipper = new DecompressZip(zipPath);
	var extractDir = temp.path();

	unzipper.on('error', function (err) {
		callback(Errors.BAD_ZIP, null);
	});

	unzipper.on('extract', function (log) {
		// On success pass extract directory
		callback(null, extractDir);
	});

	unzipper.extract({
		path: extractDir,
		filter: function (file) {
			return file.type !== "SymbolicLink";
		}
	});
}

/**
 * Download an update.
 *
 * @param {Update} - Object contains id, url, checksum, locales (optional), oses (optional), platforms (optional), licenses (optional)
 * @param {function(Error, localDir)} callback function to call with an error and path to directory wherer update is available
 */
function _downloadUpdate(update, callback) {
	if (!update || !update.url || !update.checksum) {
		callback(Errors.BAD_PARAM, null);
		return;
	}

	var zipStream = temp.createWriteStream({prefix: "DreamweaverUpdate", suffix: ".zip"});
	if (!zipStream) {
		callback(Errors.CANNOT_WRITE_TEMP, null);
		return;
	}

	var zipPath = zipStream.path;
	var hash = crypto.createHash("md5");
	var req = request.get(update.url);
	var statusCode = 200;

	function _onError(error) {
		req.abort();
		zipStream.end(function () {
			fs.unlink(zipPath);
		});
		callback(error, null);
	}

	req.on("response", function (response) {
		statusCode = response.statusCode;
	});

	req.on("error", function (error) {
		_onError(Errors.NO_SERVER_RESPONSE);
	});

	req.on("data", function (data) {
		hash.update(data);
		zipStream.write(data);
	});

	req.on("end", function () {

		// Check statusCode
		if (statusCode !== 200) {
			_onError(Errors.BAD_HTTP_STATUS);
			return;
		}

		// Verify checksum
		var checksum = hash.digest("hex");
		if (checksum !== update.checksum) {
			_onError(Errors.BAD_CHECKSUM);
			return;
		}

		// Extract on success
		zipStream.end(function () {
			_extract(zipPath, callback);
		});
	});
}

exports.listUpdates = _listUpdates;
exports.downloadUpdate = _downloadUpdate;
exports.isUpdateApplicable = _isUpdateApplicable;
exports.isNotificationApplicable = _isNotificationApplicable;
