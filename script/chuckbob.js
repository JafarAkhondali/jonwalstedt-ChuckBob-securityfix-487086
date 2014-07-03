/*jslint */
/*global window, document, console, localStorage */
/*global define,require*/
"use strict";

	// Chuck = the ventriloquist of soap.
	// http://www.youtube.com/watch?v=DwDbd4jQpkA
	// Bob = the doll chuck controls, i.e. the api you tell to do stuff

var when = require('when'),
		URI = require('URIjs'),
		gui = require('./gui'),
		phantomReporter = require('./phantom-reporter'),
		
		api = {},
		reporter = gui,
		integrationApi = {},
		DOING_RELOAD_CONDITION = 'DoingReload',
		$ = null,
		loadTimeIndicator = Date.now().toString().slice(-2),
		$element, // Set by pick etc.
		$currentValueSelector, // Set by count
		currentValue, // Set by count etc.
		leavingPage,
		runningTest, // Two modes: running a test and designing in the console
		state = { // Important state information to be preserved between reloads
			currentTestNr: 0
		},
		serializeToQueryString = 'query string',
		serializeToLocalStorage = 'local storage',
		serializeMethod = serializeToLocalStorage,
		serializeState = function () {
			var stateSerialized = JSON.stringify(state);
			stateSerialized = encodeURIComponent(stateSerialized);
			return stateSerialized;
		},
		deSerializeState = function (queryStringParameter) {
			var jsonString = decodeURIComponent(queryStringParameter);
			state = JSON.parse(jsonString);
			return state;
		},
		conditions = {
			NO_HIT: 'No hit',
			NON_UNIQUE_HIT: 'More than one hit',
			VERIFY_FAILED: 'Verification failed'
		},
		statuses = {
			NOT_STARTED: 'Not started',
			FIRST_PAGE_RENDERED: 'First page rendered'
		},
		map = function (args, fn) {
			return ($ && $.map ? $.map(args, fn) : args.map(fn));
		},
		log = function () {
			var text,
				args = Array.prototype.slice.call(arguments, 0),
				toStr = function (thing) {
					return thing.toString() || '';
				};
			if (args.length && typeof args[0] === 'string') {
				args[0] = loadTimeIndicator + ":" + args[0];
			}

			if (window.console) {
				console.log.apply(console, args);
			}

			text = map(args, toStr).join('  ');

			if (state.finalResult) {
				if (!state.finalResult.logLines) {
					state.finalResult.logLines = [];
				}
				state.finalResult.logLines.push(text);
			}

			if (reporter && reporter.log) {
				reporter.log(text, state.finalResult.logLines);
			}
		},
		getLogText = function () {
			var logLines = state && state.finalResult &&
					state.finalResult.logLines,
				text = logLines ? logLines.join('\n') :  '- no log. -';
			return text;
		},
		skipNextSeparator = false,
		logSeparator = function () {
			if (skipNextSeparator) {
				skipNextSeparator = false;
			} else {
				log('--------------------');
			}
		},
		welcome = function () {
			var nl = '\n',
				s =
				"        _                   _     _             _     " + nl +
				"       | |                 | |   | |           | |    " + nl +
				"   ___ | |__   _   _   ___ | | __| |__    ___  | |__  " + nl +
				"  / __|| '_ \\ | | | | / __|| |/ /| '_ \\  / _ \\ | '_ \\ " + nl +
				" | (__ | | | || |_| || (__ |   < | |_) || (_) || |_) |" + nl +
				"  \\___||_| |_| \\__,_| \\___||_|\\_\\|_.__/  \\___/ |_.__/ " + nl +
				nl +
				"Run me like this:" + nl +
				 nl +
				"chuckbob.startSingleStepping();" + nl +
				"chuckbob.runTestByName('foo');" + nl +
				"chuckbob.step();" + nl
				+ nl +
				"Do interactive experiments like this:" + nl +
				"	bob.pick('div.with-a-class:visible');" + nl +
				"	bob.click()" + nl
				+ nl +
				"Add .breakpoint() statements to testCases to pause execution." + nl +
				nl;
			console.log(s);
		},
		showInfo = function () {
			console.log(">>> Current element (pick):", $element);
			console.log(">>> Current value selector (count etc):", $currentValueSelector);
			console.log(">>> Current value (count etc):", currentValue);
		},
		showGui = function () {
			if (gui) {
				gui.show();
			}
		},
		testsList = [],
		testsByName = {},
		testNames = [],
		addTest = function (name, testCase) {
			testCase.testCaseName = name;
			testsList.push(testCase);
			testNames.push(name);
			testsByName[name] = testCase;
		},
		getTestByName = function (name) {
			return testsByName[name];
		},
		getTestListByNames = function (namesArr) {
			return map(namesArr, getTestByName);
		},
		getTestNames = function () {
			return testNames;
		},
		getTests = function () {
			return testsList;
		},
		configurationApi = {},
		bob = {},
		fail = function (reason, extraInfo) {
			throw new Error(reason + (extraInfo ? '( ' + extraInfo + ')' : ''));
		},
		currentPromiseChain = null,
		initPromiseChain = function () {
			currentPromiseChain = when(true);
		},
		addToPromiseChain = function (nextStepPromise) {
			currentPromiseChain = currentPromiseChain.then(nextStepPromise);
		},
		getPromiseChain = function () {
			return currentPromiseChain;
		},
		currentBreakpointResolve,
		getIsSingleStepping = function () {
			return state.isSingleStepping;
		},
		setSingleStepping = function (value) {
			state.isSingleStepping = !!value;
			if (gui && gui.update) {
				gui.update();
			}
		},
		startSingleStepping = function (value) {
			setSingleStepping(true);
		},
		stopSingleStepping = function () {
			setSingleStepping(false);
		},
		toggleSingleStepping = function () {
			setSingleStepping(! getIsSingleStepping());
		},
		makeBreakpointResolver = function () {
			var resolver = function (resolve, reject, notify) {
				if (state.phantomJs) {
					log('I will ignore single-stepping for phantomjs');
					resolve();
				} else {
					showInfo();
					console.log('>>> Suggested commands for the console:');
					console.log('>>> chuckbob.resume() to continue.');
					console.log('>>> chuckbob.step() to single-step.');
					console.log('>>> other: chuckbob.getElement(), .getState()');
					startSingleStepping();
					showGui();
					if (!currentBreakpointResolve) {
						currentBreakpointResolve = resolve;
					}
				}
			};
			return resolver;
		},
		postStep = function (primaryReturnValue) {
			var resolver = makeBreakpointResolver(),
				retVal = primaryReturnValue;
			if (getIsSingleStepping()) {
				retVal = when.promise(resolver);
			}
			return retVal;
		},
		addTask = function (fn) {
			if (runningTest) {
				if (!getPromiseChain()) {
					initPromiseChain();
				}

				addToPromiseChain(function () {
					if (!leavingPage) {
						return postStep(fn());
					}
				});
			} else { // Interactive mode
				fn();
				showInfo();
			}
		},
		resume = function () {
			if (currentBreakpointResolve) {
				var go = currentBreakpointResolve;
				stopSingleStepping();
				currentBreakpointResolve = null;
				window.setTimeout(go, 10);
				return 'Resuming.';
			}
		},
		step = function () {
			if (currentBreakpointResolve) {
				var go = currentBreakpointResolve;
				startSingleStepping();
				currentBreakpointResolve = null;
				window.setTimeout(go, 10);
				return 'Stepping to next.';
			}
		},
		breakpoint = function () {
			var resolver = makeBreakpointResolver();
			addTask(function () {
				return when.promise(resolver);
			});
			return bob;
		},
		waiting = {},
		resetWaiting = function () {
			waiting = {};
		},
		DEFAULT_WAIT_TIMEOUT_SECONDS = 30,
		WAIT_FOR_PAGE = 'Page load wait',
		stopWaiting = function (waitingForId, failed) {
			var callbackObj, method = failed ? 'reject' : 'resolve';
			log('Stopped waiting (' + method + ').');
			callbackObj = waiting[waitingForId];
			if (callbackObj) {
				if (callbackObj.timeoutHandle) {
					window.clearTimeout(callbackObj.timeoutHandle);
				}
				delete waiting[waitingForId];
				callbackObj[method]();
			}
		},
		addToWaitingList = function (waitingForId, resolve, reject) {
			if (waiting[waitingForId]) {
				throw 'This should not happen, we are waiting more than once';
			}
			waiting[waitingForId] = ({
				resolve: resolve,
				reject: reject,
				timeoutHandle: window.setTimeout(function () {
					log(waitingForId + ":timeout after " +
						DEFAULT_WAIT_TIMEOUT_SECONDS + " seconds.");
					stopWaiting(waitingForId, true);
				}, DEFAULT_WAIT_TIMEOUT_SECONDS * 1000)
			});
		},
		phantomJs,
		maybeSwitchToPhantom = function () {
			if (phantomJs) {
				state.phantomJs = true;
			}
			if (state.phantomJs) {
				reporter = phantomReporter;
			}
		},
		initState = function () {
			var uri = URI(window.location),
				queryString = uri.query(),
				params = URI.parseQuery(queryString),
				ls;
			console.log("Query string: ", queryString);
			console.log("Parameters", params);

			if (serializeMethod === serializeToLocalStorage) {
				ls = localStorage.getItem('bobState');
				localStorage.removeItem('bobState');
				if (ls) {
					deSerializeState(ls);
				}
			} else if (serializeMethod === serializeToQueryString) {
				if (params.bobState) {
					deSerializeState(params.bobState);
				}
			}
			if (state && state.originalUri) {
				console.log(state);
				if ($ && $.extend) {
					console.log("Got state information from "
						+ serializeMethod + ":",
						$.extend(true, {}, state));
				}
			} else {
				state.originalUri = uri.href();
				console.log("No state info. Fresh start.");
			}
		},
		currentStatus = statuses.NOT_STARTED,
		setStatus = function (msg) {
			currentStatus = msg;
		},
		status = function () {
			console.log(currentStatus);
			return currentStatus;
		},
		beginTest = function () {
			state.currentTestNr = state.currentTestNr + 1;
			console.log('This test is:', state.currentTestNr);
		},
		callTest = function (testCase) {
			testCase.call(bob, bob);
		},
		reportTestResult = function (status, answer) {
			runningTest = false;
			if (state.testHasNavigated) {
				delete state.testHasNavigated;
			}

			if (leavingPage) {
				answer = when.resolve();
			} else {
				log("Test result: " + status);
				logSeparator();
				setStatus(status);
			}
			return answer;
		},
		runTest = function (testCase) {
			resetWaiting();

			if (leavingPage) {
				//return;
				return when.resolve();
			}
			if (testCase.disabled && !state.selectedTestNames) {
				log("Skipping test: " + testCase.testCaseName);
				return when.resolve(true);
			}

			logSeparator();
			log("Running test: " + testCase.testCaseName);
			runningTest = true;
			setStatus('Running');

			addTask(beginTest);

			try {
				callTest(testCase);
			} catch (e) {
				log("Error in testcase definition.");
				return false;
			}
			return getPromiseChain()
				.then(function () {
					return reportTestResult('OK', true);
				}, function () {
					return reportTestResult('Failed',
						when.reject(testCase.testCaseName + ' failed.'));
			});
		},
		pickElement = function (jQuerySelector, optWaitTime) {
			log((optWaitTime ? 'After ' + optWaitTime + 'ms,' : '' ) +
				'Picking  ' + jQuerySelector);
			$element = null;
			var hit = $(jQuerySelector);
			if (hit.length === 0) {
				log('Fail: Expected one element picked.');
				fail(conditions.NO_HIT);
			} else if (hit.length > 1) {
				log('Fail: Expected only one element picked, we got ' +
					hit.length + ' hits.');
				fail(conditions.NON_UNIQUE_HIT);
			} else {
				$element = hit;
				log('and got one element: ', $element.get());
			}
		},
		pollingCheck = function (resolve, reject, poll, check) {
			var polledTimeMs = 0,
				intervalMs = 100,
				pollingTimeLimitMs = 5000,
				pollAndCheck = function () {
					if (poll()) {
						try {
							check(polledTimeMs);
						} catch(e) {
							reject(e);
							return;
						}
						resolve();
					} else {
						polledTimeMs = polledTimeMs + intervalMs;
						if (polledTimeMs < pollingTimeLimitMs) {
							window.setTimeout(pollAndCheck, intervalMs);
						} else {
							log('Timeout after ' + pollingTimeLimitMs + 'ms.');
							reject();
						}
					}
				};
			pollAndCheck();
		},
		pickNow = function (jQuerySelector) {
			// Does not wait for elements to be available
			addTask(function () {
				pickElement(jQuerySelector);
			});
			return bob;
		},
		pick = function (jQuerySelector) {
			// Repeatedly try to pick element within 5 seconds,
			// so we don't fail on every little animation or delay.
			// If you don't like this behaviour, use pickNow.
			var resolver = function (resolve, reject, notify) {
				var poll = function () {
					var $elem = $(jQuerySelector);
					return $elem.length > 0;
				},
				check = function (polledTimeMs) {
					pickElement(jQuerySelector, polledTimeMs);
				};
				pollingCheck(resolve, reject, poll, check);
			};
			addTask(function () {
				return when.promise(resolver);
			});
			return bob;
		},
		write = function (text) {
			addTask(function () {
				if ($element.is('input')) {
					$element.val(text).trigger('input').trigger('change');
					log('Wrote: ' + text);
				} else {
					log('The current element is not an input-tag');
					fail();
				};
			});
			return bob;
		},
		sleep = function (ms) {
			var resolver = function (resolve, reject, notify) {
				log("Waiting (" + ms + "ms)");
				window.setTimeout(function () {
					log("Finished waiting.");
					resolve();
				}, ms);
			};
			addTask(function () {
				return when.promise(resolver);
			});
			return bob;
		},
		wait = function () {
			var resolver = function (resolve, reject, notify) {
				addToWaitingList(WAIT_FOR_PAGE, resolve, reject);
				integrationApi.onBeginWait();
			};
			addTask(function () {
				return when.promise(resolver);
			});

			return bob;
		},
		click = function () {
			var resolver = function (resolve, reject, notify) {
				if ($element) {
					log("Clicking on it.");
					$element.click();
					log("Clicked on it.");
					resolve();
				} else {
					log("Fail: There was nothing to click.");
					reject(fail(conditions.NO_HIT));
				}
			};
			addTask(function () {
				return when.promise(resolver);
			});

			return bob;
		},
		run = function (fn) {
			addTask(function () {
				log("Running some code.");
				fn.call($element, $element);
			});
			return bob;
		},
		check = function (fn) {
			addTask(function () {
				log("Running some code that checks.");
				var ok = fn.call($element, $element);
				if (!ok) {
					log("Fail: Code did not return true.");
					fail(conditions.VERIFY_FAILED);
				} else {
					log("Ok, code returned true.");
				}
			});
			return bob;
		},
		clearLocalStorage = function () {
			addTask(function () {
				if (! state.testHasNavigated) {
					log("Clearing local storage");
					localStorage.clear();
				} else {
					log("Clearing local storage was done before reload.");
				};
			});
			return bob;
		},
		gosub = function (testName) {
			var resolver = function (resolve, reject, notify) {
				var test = getTestByName(testName),
					preserveCurrentChain,
					altChain,
					testCase,
					info = "GOSUB: " + testName;
				if (!test) {
					log("Fail: Could not find " + testName);
					return reject(testName + ' is not foud.');
				}
				if (test) {
					preserveCurrentChain = currentPromiseChain;
					currentPromiseChain = null;
					testCase = getTestByName(testName);
					callTest(testCase);
					altChain = currentPromiseChain;
					currentPromiseChain = preserveCurrentChain;
				}

				log(info);
				log("Adding steps from " + testName);
				when(altChain).then(function () {
					log("Return from " + info);
					resolve();
				}, function () {
					if (leavingPage) {
						resolve();
					} else {
						log("Failure " + info);
						reject();
					}
				});
			};
			addTask(function () {
				return when.promise(resolver);
			});

			return bob;
		},
		assert = function (condition, message) {
			if (!condition) {
				throw message || "Assertion failed.";
			}
		},
		urlFromDestination = function (destination, optWinLocation) {
			var winLocation = optWinLocation || window.location,
				url,
				params,
				hash,
				buildUri = false,
				hashMatch = destination && destination.match(/^\S*(#(\w|\W)+)/),
				queryParamsMatch = destination && destination.match(/^([?][a-zA-Z0-9_&=%@]+)/);

			//relative hash
			if (hashMatch && hashMatch.length > 1) {
				hash = hashMatch[1];
				buildUri = true;
			}

			 //Add query params
			if (queryParamsMatch && queryParamsMatch.length === 2) {
				params = URI.parseQuery(queryParamsMatch[1]);
				buildUri = true;
			}
			if (buildUri) {
				url = URI(winLocation);
				if (hash) {
					url = url.hash(hash);
				}
				if (params) {
					url.removeSearch(Object.keys(params));
					url.addSearch(params);
				}
				url = url.href();
			} else {
				url = destination || winLocation; //Default
			}
			return url;
		},
		testUrlFromDestination = function () {
			var currentBase = 'http://localhost:9000/src/?customer=ub&offering=ub',
				testGotoPlainUrl = function () {
					var currentHash = '#home',
						currentLoc = currentBase + currentHash,
						wantedUrl = 'http://www.google.com',
						url = urlFromDestination(wantedUrl,  currentLoc);
					assert(url === wantedUrl, "Simple url");
				},
				testGotoHash = function () {
					var currentHash = '#starting-within',
						currentLoc = currentBase + currentHash,
						newHash = '#home',
						url = urlFromDestination(newHash, currentLoc);
					assert(url === currentBase + newHash,
						   "Expected #home to preserve current location");
				},
				testGotoHashWithSlash = function () {
					var currentHash = '#home',
						currentLoc = currentBase + currentHash,
						newHash = '#starting-within/120',
						url = urlFromDestination(newHash, currentLoc);
					assert(url === currentBase + newHash,
						   "Expected /120 to be preserved");
				},
				testGotoAddQueryParameter = function () {
					var currentHash = '#home',
						currentLoc = currentBase + currentHash,
						queryPart = '&foo=1234',
						wantedUrl = "?" + queryPart,
						expectedUrl = currentBase + queryPart + currentHash,
						url = urlFromDestination(wantedUrl,  currentLoc);
					assert(url === expectedUrl,
						'Query param added, hash preserved');
				},
				testGotoChangeQueryParameter = function () {
					// The http protocal supports more than one query parameter
					// with the same name, but it would be confusing in most cases
					// and it is a rare use anyway.
					var currentHash = '#home',
						currentLoc = currentBase + "&foo=abcd" + currentHash,
						queryPart = '&foo=1234',
						wantedUrl = "?" + queryPart,
						expectedUrl = currentBase + queryPart + currentHash,
						url = urlFromDestination(wantedUrl,  currentLoc);
					assert(url === expectedUrl,
						'Query param added, hash preserved, foo changed to 1234');
				},
				testGotoUndefined = function () {
					var currentLoc = window.location,
						url = urlFromDestination(undefined, currentLoc);
					assert(url === currentLoc,
						   "Expected undefined to mean the current location");
				};
			testGotoPlainUrl();
			testGotoHash();
			testGotoHashWithSlash();
			testGotoAddQueryParameter();
			testGotoChangeQueryParameter();
			testGotoUndefined();
		},
		safeURI = function (url) {
			return URI(url)
				.removeSearch('bobState')
				.removeSearch('chuckbob');
		},
		navigate = function (destination) {
			addTask(function () {
				var currentURI = safeURI(window.location),
					base = state.originalUri ?
						safeURI(state.originalUri).href() : currentURI.href(),
					url = urlFromDestination(destination, base),
					toUrl = URI(url),
					rightUrl = currentURI.equals(toUrl),
					forceReload = (destination === undefined),
					newUri,
					stateSerialized;
				log("Current url: " + currentURI.href());
				log("Desired url: " + toUrl.href());

				if ((rightUrl && ! state.testHasNavigated && ! forceReload) ||
					state.testHasNavigated
				   ) {
					   log("We are at the right location:" + currentURI.readable());
					   if (state.testHasNavigated) {
						   delete state.testHasNavigated;
					   }
				} else {
					// We need to reload the client from the new url.
					// Save the current state of unit testing, then continue
					// on the reloaded page
					state.currentTestNr = state.currentTestNr - 1;
					state.testHasNavigated = true;

					stateSerialized = serializeState();
					if (serializeMethod === serializeToQueryString) {
						newUri = toUrl.addSearch('bobState', stateSerialized);
						console.log(newUri.href());
					} else if (serializeMethod === serializeToLocalStorage) {
						localStorage.setItem('bobState', stateSerialized);
						console.log("Leaving with", state);
						// Phantomjs on windows seems to need a fresh url each time
						// adding a semi-random query string param seems to be needed
						newUri = toUrl.removeSearch('chuckbob')
							.addSearch('chuckbob', Date.now());
					}

					log("I am now going to another url. Bye");

					leavingPage = true;
					window.location = newUri.href();
					throw (new Error(DOING_RELOAD_CONDITION));
				}
			});
			return bob;
		},
		comment = function (message) {
			addTask(function () {
				log(message);
			});
			return bob;
		},

		// Verification

		countElements = function (jquerySelector) {
			$currentValueSelector = $(jquerySelector);
			currentValue = $currentValueSelector.size();
			log('Count on ' + jquerySelector + ' yields ' + currentValue);
		},
		countNow = function (jQuerySelector) {
			addTask(function () {
				countElements(jQuerySelector);
			});
			return bob;
		},
		count = function (jQuerySelector) {
			// Repeatedly try to count within 5 seconds,
			// so we don't fail on every little animation or delay.
			// If you don't like this behaviour, use pickNow.
			var resolver = function (resolve, reject, notify) {
				var poll = function () {
					var $elem = $(jQuerySelector);
					return $elem.length > 0;
				},
				check = function (polledTimeMs) {
					countElements(jQuerySelector, polledTimeMs);
				},
				rejected = function () {
					currentValue = 0;
					resolve();
				};
				log('Count: ' + jQuerySelector);

				pollingCheck(resolve, rejected, poll, check);
			};
			addTask(function () {
				return when.promise(resolver);
			});
			return bob;
		},
		verify = function (verificationFunction) {
			var ok = verificationFunction(currentValue);
			if (!ok) {
				fail(conditions.VERIFY_FAILED, ok);
			}
		},
		addVerifyer = function (name, binaryComparision) {
			bob[name] = function (value) {
				addTask(function () {
					var ok = binaryComparision(currentValue, value),
						okOrFail = (ok ? 'OK.' : 'FAILED');
					log('Checking if ' + currentValue + ' ' + name +
						' ' + value + ': ' + okOrFail);
					if (!ok) {
						fail(conditions.VERIFY_FAILED, ok);
					}
				});
				return bob;
			};
		},

		// startup and control

		resetRunningState = function () {
			currentPromiseChain = null;
			delete state.currentTestNr;
			delete state.selectedTestNames;
		},
		reportSuccess = function () {
			if (leavingPage) {
				return;
			}
			log('All tests OK. Stopping now, celebrate.');
			logSeparator();
			state.finalResult.ok = true;
			resetRunningState();
			reporter.showResult(state.finalResult);
		},
		reportFailure = function () {
			log('Tests finished with failures');
			state.finalResult.ok = false;
			resetRunningState();
			reporter.showResult(state.finalResult);
		},
		runTestList = function (tests) {
			var runNext = function () {
				var test = tests.shift();
				if (test) {
					return runTest(test).then(runNext, reportFailure);
				}
				return reportSuccess();
			};

			return runNext();
		},
		runTests = function () {
			var testIndex = state.currentTestNr,
				selectedTestNames = state.selectedTestNames,
				tests,
				remaining,
				skipIndex = 0;
			state.finalResult = state.finalResult || {};

			if (selectedTestNames) {
				tests = getTestListByNames(selectedTestNames);
			} else {
				tests = getTests();
			}
			if (!tests.length) {
				console.trace();
				log('No tests.');
				return;
			}
			if (!testIndex) {
				log('There are ' + tests.length + ' tests.');
				state.currentTestNr = 0;
				logSeparator();
				testIndex = 0;
			} else {
				log('Continuing testing after reload, at ' +
					testIndex + ' of ' + tests.length + ' tests.');
				skipNextSeparator = true;
			}
			remaining = tests.slice(testIndex);
			runTestList(remaining);
		},
		shouldAutoStart = function () {
			var uri = URI(window.location),
				hasLocalStorageState = localStorage.getItem('bobState') && true,
				hasPhantomjsQueryStringParam = uri.hasQuery('phantomjs');

			console.log('chuckbob.js:Line 619', hasLocalStorageState);

			phantomJs = hasPhantomjsQueryStringParam;

			return uri.hasQuery('autostart') ||
				uri.hasQuery('bobState') ||
				phantomJs ||
				hasLocalStorageState;
		},
		clearResult = function () {
			state.finalResult = {};
		},
		restart = function () {
			initState();
			maybeSwitchToPhantom();
			runTests();
		},
		runAllTests = function () {
			clearResult();
			resetRunningState();
			restart();
		},
		initialize = function () {
			reporter.setTests(getTestNames());
			if (shouldAutoStart()) {
				restart();
			} else {
				console.log("There will be no autostart of tests.");
				welcome();
				showGui();
			}
		},
		goBackToStart = function (optRestart) {
			if (state.originalUri) {
				var uri = URI(state.originalUri);
				uri.removeSearch('autostart');
				if (optRestart) {
					uri.addSearch('autostart');
				}
				window.location = uri.href();
			} else {
				gui.hide();
			}
		},
		restartFromOriginalUrl = function () {
			goBackToStart(true);
		},
		restartFromOriginalUrlNoAutostart = function () {
			goBackToStart(false);
		},

		runTestByName = function (name) {
			var testCase = getTestByName(name);
			if (testCase) {
				clearResult();
				state.selectedTestNames = [name];
				runTests();
			} else {
				console.log("Could not find test:" + name);
			}
		},
		endWaiting = function () {
			if (waiting) {
				stopWaiting(WAIT_FOR_PAGE);
			}
		},
		setReporter = function (reporterObject) {
			reporter = reporterObject;
		},
		setJQuery = function (jQuery) {
			$ = jQuery;
			api.$ = $;
			bob.$ = $;
		},
		selfTest = function () {
			testUrlFromDestination();
		},
		noop = function () {};

	bob.click = click;
	bob.comment = comment;

	bob.verify = verify;

	addVerifyer('isGreaterThan', function (current, value) {
		return current > value;
	});
	addVerifyer('isLessThan', function (current, value) {
		return current < value;
	});
	addVerifyer('equals', function (current, value) {
		return String(current) === String(value);
	});

	api.conditions = conditions;

	bob.clearLocalStorage = clearLocalStorage;
	bob.navigate = navigate;
	bob.gosub = gosub;


	integrationApi.onBeginWait = noop;
	integrationApi.endWaiting = endWaiting;
	integrationApi.setJQuery = setJQuery;

	api.integrationApi = integrationApi;

	api.conditions = conditions;

	bob.run = run;
	bob.check = check;

	bob.wait = wait;
	bob.pick = pick;
	bob.count = count;
	bob.pickNow = pickNow;
	bob.countNow = countNow;
	bob.write = write;

	bob.sleep = sleep;

	bob.breakpoint = breakpoint;

	api.bob = bob;

	api.resume = resume;
	api.startSingleStepping = startSingleStepping;
	api.stopSingleStepping = stopSingleStepping;
	api.toggleSingleStepping = toggleSingleStepping;

	api.getIsSingleStepping = getIsSingleStepping;
	api.step = step;
	api.getLogText = getLogText;

	api.status = status;
	api.stopWaiting = stopWaiting;
	api.runAllTests = runAllTests;

	api.addTest = addTest;
	api.xaddTest = function (name, testCase) {
		addTest(name, testCase);
		testCase.disabled = true;
	};
	api.XaddTest = api.xaddTest;

	api.show = showGui;
	api.gui = gui;

	api.log = log;

	api.getTestNames = getTestNames;
	api.runTestByName = runTestByName;

	api.restartFromOriginalUrl = restartFromOriginalUrl;
	api.restartFromOriginalUrlNoAutostart = restartFromOriginalUrlNoAutostart;
	api.goBackToStart = goBackToStart;


	api.getState = function () { return state; };
	api.getElement = function () { return $element; };
	api.getCurrentValueSelector = function () { return $currentValueSelector; };


	api.initialize = initialize;

	window.chuckbob = api;
	window.bob = bob;

	window.URI = URI; // Temp

	gui.registerForCallbacks(api);

	selfTest();


module.exports = api;
