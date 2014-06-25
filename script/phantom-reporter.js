/*global window, document */
/*global require, define */

define([
], function () {
	"use strict";
	var nop = function () {},
		showResult = function (options) {
			var opt = options || {},
				ok = opt.ok,
				logLines = opt.logLines || ['- no log. -'];
			window.toPhantomFromBob = {
				ok: ok,
				logLines: logLines,
				finished: true
			};
		},
		log = function (string, totalLogLines) {
			window.toPhantomFromBob = {
				logLines: totalLogLines
			};
		},
		api = {
			log: log,
			setTests: nop,
			showResult: showResult
		};
	return api;
});
