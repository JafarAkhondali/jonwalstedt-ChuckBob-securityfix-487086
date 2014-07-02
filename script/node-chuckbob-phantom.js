var fs = require('fs'),
	path = require('path'),
	child_process = require('child_process'),
	cwd = process.cwd(),
	parseArgs = function () {
		var args = process.argv.slice(2),
			options = {
				positional: [],
				named: {}
			};

		args.forEach(function (arg) {
			var m = arg.match(/^--([a-zA-Z0-9]+)=(.*)$/),
				key, val;
			if (m && m.length) {
				key = m[1];
				val = m[2];
				options.named[key]=val;
				console.log("Arg: " + key + " is " + val);
			} else {
				options.positional.push(arg);
				console.log("Arg:" + arg);
			}
		});
		return options;
	},
	options = parseArgs(),
	forkOptions = {},
	spawnOptions = {},
	webs,
	port = 334 + Date.now().toString().slice(-2),
	phantom,
	phantomjs = options.named.phantomjs || 'phantom',
	urlPathname = options.named.urlPathname || '/src/my-test-file.html?phantomjs=true',
	urlProtocol = options.named.urlProtocol || 'http',
	urlHost = options.named.urlHost || 'localhost',
	websDir = options.named.websDir || '..';


console.log("Starting webserver as child process.");
webs = child_process.fork(__dirname + '/webs.js', ['--port=' + port, '--dir=' + websDir], forkOptions);

console.log("Current working directory: " + cwd);
console.log("Spawning phantomjs runner as process, executable: " + phantomjs);


spawnOptions.stdio = [process.stdio, process.stdout, process.stderr];
phantom = child_process.spawn(phantomjs, [
	__dirname + '/phantom-runner.js',
	urlPathname,
	'dontcare',
	urlProtocol + '://' + urlHost + ':' + port,
	'--local-to-remote-url-access=yes',
	'--ignore-ssl-errors=yes',
	'--web-security=yes',
	'--debug=yes'
	], spawnOptions);

var killAll = function () {
	try {
		webs.kill();
		phantom.kill();
	} catch (e) {}
};

phantom.on('message', function(m) {
  console.log('PARENT got message:', m);
});

phantom.on('close', function (code) {
	console.log("Phantom close", code);
	process.exit(code);
});
phantom.on('exit', function (code) {
	console.log("Phantom exit", code);
	killAll();
	process.exit(code);
});

 phantom.on('error', function (data) {
	console.log("Phantom error", data);
 });

console.log("last line.");
