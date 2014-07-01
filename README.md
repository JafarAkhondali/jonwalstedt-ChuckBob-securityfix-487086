Chuckbob
========

Chuckbob helps automatic testing of webpages. No middle-man is
required and tests are coded in javascript.

Chuckbob can simulate a user, clicking on buttons and interact with
the page in various ways, and verify that the page looks as expected.

The code for Chuckbob is included on the same html-page as the running
application. This is unlike many other frameworks for browser
automation. You are in direct connection with the running application
and there is no middle man involved. This makes chuckbob easy to run
on all sorts of devices and very easy to set up.

Since Chuckbob is written in javascript and runs on the same page as
your application, it is not black-box testing, rather something
grey. You have the possibility to connect to you application, and have
the full javascript language at your disposal so you can do all sorts
of advanced automation.

Tests for chuckbob are written in javascript. The idea is that you to
a large degress should be able to code tests interactively with your
developer console. Chuckbob includes a debugger with breakpoints and
single stepping. There is also a GUI in shining brown.

Chuckbob tests can be run directly from a browser on a phone or
computer, or headless with phantomjs.

Are you looking for Chuck the ventriloquist with his puppet Bob from
the 70:s TV-series Soap? You find them on various video sites.


Build
-----------

To build the chuckbob-all.js file you need nodejs and npm. After
installing nodjs and npm run sh build.sh Alternativly run npm install
and then run node build.js or sh build.sh to build the javascript
file.


Quickstart
-----------

There is a demo for todo-mvc, open up the index-chuckbob.html file in
your browser. Read the chuckbob-todomvc.js file for an introduction
to how you can write tests.


Behind the scenes
-----------------

Despite that chuckbob runs on the current page, you can do page
reloads and navigate to different urls within your application all
within a single test. This is accomplished by chuckbob saving it's
state to local storage, and reloading it on page-load. For this to
work, all pages on your app needs to include chuckbob.

This can be done manually by including a script tag. Or with a proxy
server that adds the script on every page. Doing this proxy server for
grunt or gulp or whatever you use is left as an excerise to the
reader.


Usage
=====

1. Include chuckbob

Include a script tag that refers to chuckbob-all.js on your page. Add
another script tag to a new javascript file tht will contain your tests.

2. Code tests

See the chuckbob-todomvc file in the demo folder.

3. Run tests

Open up the page in your browser. Click run all, or add an autostart query string parameter.

4. Run from phantomjs

There is a file script/node-chuckbob-phantom.js that runs chuckbob
tests with phantomjs. See ant-snippet.xml for an example integration
with a build process.

5. Debug tests

Eveything you can do with the gui, you can also do from the
console. The intention is that the console should be an interactive
tool to develop tests.

You can add breakpoints to tests by adding a .breakpoint() step.

You can also single-step:

	> chuckbob.startSingleStepping()
	> chuckbob.runTestByName('Add task')
	> chuckbob.step()
	> chuckbob.step()


Then you can get the currently selected element by:

	> chuckbob.getElement()

You can resume after a breakpoint or single-stepping:

	-> chuckbob.resume()

If you want a copy of jQuery on your page:

	> $ = chuckbob.$


FAQ
===

Q. Chuckbob goes crazy and keeps reloading the page again and
again. What can I do?

A. There is a value "bobState" in local storage you might want to
remove. Using a developer console, you can write localStorage.clear()
and chuckbob will stop.

Q. I dont understand how to single step from the gui?

A. First press single step "On", then run "Selected", then "Step"

Q. Why doesn't Chuckbob work the way I want?

A. Probably because it is in an unstable stage and might need
improvements. You are more than welcome to contribute or suggest
changes.
