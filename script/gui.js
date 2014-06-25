/*global window, document */
/*global define */

define([
	'../bower_components/requirejs-text/text!script/gui-template.html!strip',
	'jquery',
	'script/draggable.js'
], function (html, $, makeDraggable) {
	"use strict";

	var $content,
		gui,
		controller,
		testNames,
		hide = function () {
			$content.remove();
		},
		callChuckbob = function (methodName) {
			return function (optArg) {
				if (controller && controller[methodName]) {
					controller[methodName](optArg);
				}
			};
		},
		singleTestCallback = callChuckbob('runTestByName'),
		singleTestClick = function () {
			var val = $('.chuckbob__tests-list :selected').text();
			if (val && val !== "") {
				singleTestCallback(val);
			}
		},
		updateLog = function () {
			var textLog = controller.getLogText(),
				$logArea;

			$logArea = $('.chuckbob__test-log', $content);
			$logArea.text(textLog);

			//Scroll down:
			try {
				$logArea.scrollTop(
					$logArea[0].scrollHeight - $logArea.height()
				);
			} catch(e) {} // If not shown yet
		},
		update =  function () {
			var isSingleStepping = controller.getIsSingleStepping();
			$('.chuckbob__single-step').text(isSingleStepping ? 'Off' : 'On');
			$('.chuckbob__step').prop('disabled', !isSingleStepping);
			$('.chuckbob__resume').prop('disabled', !isSingleStepping);
			updateLog();
		},
		singleStep = function () {
			controller.toggleSingleStepping();
		},
		bindEvents = function () {
			$('.chuckbob__run-button').click(callChuckbob('runAllTests'));
			$('.chuckbob__restart-button').click(
				callChuckbob('restartFromOriginalUrl'));
			$('.chuckbob__exit-button').click(
				callChuckbob('restartFromOriginalUrlNoAutostart'));
			$('.chuckbob__abort-button').click(hide);
			$('.chuckbob__run-single-button').click(singleTestClick);

			$('.chuckbob__step').click(callChuckbob('step'));
			$('.chuckbob__resume').click(callChuckbob('resume'));
			$('.chuckbob__single-step').click(singleStep);
		},
		addToggler = function () {
			var $el = $('.chuckbob__toggler', $content);
			$el.click(function(event) {
				event.preventDefault();
				$('.chuckbob__container').toggleClass('chuckbob--hidden');
				$el.html() === 'Hide' ? $el.html('Show') : $el.html('Hide');
			});
		},
		renderTests = function () {
			if ($content && testNames) {
				var $tests = $('.chuckbob__tests-list', $content);
				$tests.empty();
				$.each(testNames, function (idx, testName) {
					$('<option/>').text(testName).appendTo($tests);
				});
			}
		},
		render = function () {
			if (!$content) {
				$content = $(html);
				$content.appendTo('body');
				bindEvents();
				renderTests();
				addToggler();
				makeDraggable($content);
			}
			update();
		},
		showResult = function (options) {
			var opt = options || {},
				ok = opt.ok === true,
				failure = opt.ok === false,
				text = '';

			if (ok) {
				text = 'Success';
			}
			if (failure) {
				text = 'Failed';
			}
			render();
			if (failure) {
				$(".chuckbob__fail-sound").get(0).play();
			}
			if (ok) {
				$(".chuckbob__success-sound").get(0).play();
			}
			$('.chuckbob__result')
				.text(text)
				.toggleClass('chuckbob__result--ok', ok)
				.toggleClass('chuckbob__result--failure', failure);

			updateLog(opt.logLines);
		},
		setTests = function (tests) {
			testNames = tests;
			renderTests();
		},
		nop = function () {};

	gui = {
		setTests: setTests,
		show: showResult,
		showResult: showResult,
		hide: hide,
		update: update,
		registerForCallbacks: function (obj) {
			controller = obj;
		}

	};

	return gui;
});
