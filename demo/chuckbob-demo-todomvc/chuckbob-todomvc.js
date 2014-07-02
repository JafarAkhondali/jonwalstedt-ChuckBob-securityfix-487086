/*jslint */
/* Sample test for the pure javascript todomvc app with chuckbob.

Load the index-chuckbob.html page in your browser, click on the "All" button to run tests.
The index-chuckbob file is the same file as index.html but with two more javascript
includes.
*/

(function () {
	function addTests(chuckbob) {

		function enterTaskSteps(bob, taskText) {
			// javascript functions can help keeping copy/paste down.
			bob.comment('we select the text input field')
				.pick('#new-todo')
				.write(taskText)
				.comment('Now we need to do a trick to simulate the enter key')
				.run(function ($element) {
					var e = document.createEvent('Event'),
							domNode = $element.get(0);

					e.initEvent('change', true, true)
					domNode.dispatchEvent(e); // jQuery trigger does not work
				})
				.comment('Now it should appear in the todo list')
				.pick('label:contains(' + taskText +')');
		};

		chuckbob.addTest('Add a single task', function (bob) {
			bob.clearLocalStorage().navigate();
			enterTaskSteps(bob, 'Improve documentation');
		});

		chuckbob.addTest('Add two tasks', function (bob) {
			bob.gosub('Add a single task');
			enterTaskSteps(bob, 'Make a proxy that adds chuckbob to pages.');
			bob.comment('We should now have "2 items left" ');
			bob.pick('#todo-count strong:contains(2)');
		});

		chuckbob.addTest('Delete a task', function () {
			this.gosub('Add two tasks')
				.pick('button.destroy:first')
				.click()
				.comment('We should now have "1 item left" ')
				.pick('#todo-count strong:contains(1)');
		});

		chuckbob.addTest('Complete a task', function () {
			this.gosub('Add two tasks')
				.pick('#todo-list input.toggle:first')
				.click()
				.comment('We should now have "1 item left" ')
				.pick('#todo-count strong:contains(1)')
				.comment('We still see two tasks')
				.count('#todo-list li')
				.equals(2)
				.comment('We see 1 completed task')
				.count('#todo-list li.completed')
				.equals(1)
				.comment('We still see the "Improve documentation" text even tough it is completed')
				.pick('label:contains(Improve documentation):visible');
		});

		chuckbob.addTest('The filter', function () {
			var triggerClick = function ($element) {
					var e = document.createEvent('Event'),
							domNode = $element.get(0);

					e.initEvent('click', true, true);
					domNode.dispatchEvent(e); // jQuery trigger does not work
			};
			this.gosub('Complete a task')

				.comment('Select the Active filter')
				.pick('#filters li a:eq(1)') // eq(1) means second
				.run(triggerClick)
				.comment('Active is selected')
				.pick('#filters li a:eq(1).selected')
				.comment('We see "Make a proxy"')
				.pick('label:contains(Make a proxy):visible')

				.comment('Select the Completed filter')
				.pick('#filters li a:eq(2)')
				.run(triggerClick)
				.comment('Active is not selected')
				//Normally use CountNow instead of count when you expect 0
				.sleep(200) // Sometimes you need to wait first though
				.countNow('#filters li a:eq(1).selected')
				.equals(0)
				.comment('But Completed is')
				//Count works fine here, it attempts to count for five seconds
				.count('#filters li a:eq(2).selected')
				.equals(1)
				.comment('We dont see "Make a proxy"')
				.countNow('label:contains(Make a proxy):visible')
				.equals(0)
				.comment('We see "Improve documentation"')
				// In this testcase countNow works as well as count
				.countNow('label:contains(Improve documentation):visible')
				.equals(1)

				.comment('Select the All filter')
				.pick('#filters li a:eq(0)')
				.run(triggerClick)
				//Pick can be used instead of count followed by equals 1
				.pick('label:contains(Improve documentation):visible')
				.pick('label:contains(Make a proxy):visible');
		});

		chuckbob.initialize();
	}


	if (window.chuckbob) {
		addTests(window.chuckbob);
	} else {
		window.afterChuckbob = addTests;
	};

})();
