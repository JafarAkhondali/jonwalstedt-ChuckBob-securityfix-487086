/*global window, document */
/*global require */

require([
	'script/chuckbob',
	'jquery'
], function (chuckbob, $) {
	"use strict";
	$.noConflict();
	chuckbob.integrationApi.setJQuery($);


	if (window.afterChuckbob) {
		window.afterChuckbob(chuckbob);
	};
});
