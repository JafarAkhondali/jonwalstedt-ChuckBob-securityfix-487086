var http = require("http"),
    https = require("https"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    os = require('os'),
    ifaces = null,
    ip = null,
	options,
    protocol,
    port,
	workingDir,

    server,
    createServerCallback,
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
	};

options = parseArgs();
protocol = options.positional.shift() || options.named.protocol || 'http';
port = options.positional.shift() || options.named.port || 8888;
workingDir = process.cwd();

if (options.named.dir) {
	workingDir = process.cwd() + "/" + options.named.dir;
}

if (options.named.absDir) {
	workingDir = options.named.absDir;
}


createServerCallback = function(request, response) {

	var uri = url.parse(request.url).pathname,
	    filename = path.join(workingDir, uri),
	    contentTypes = {
			'html': 'text/html',
			'js': 'text/javascript',
			'css': 'text/css',
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'gif': 'image/gif',
			'swf': 'application/x-shockwave-flash'
	    };

	fs.exists(filename, function(exists) {
		if (!exists) {
			response.writeHead(404, {
				"Content-Type": "text/plain",
			});
			response.write("404 Not Found\n");
			response.end();
			return;
		}
		var lastCharInFileName = filename.substr(filename.length-1);

		if (fs.statSync(filename).isDirectory() &&
			!(lastCharInFileName === '\\' || lastCharInFileName === '/')) {
			response.writeHead(302, {
			  'Location': uri + '/'
			});
			response.end();
			return;
		}

		if (fs.statSync(filename).isDirectory()) {
			filename += '/index.html';
		}

		fs.readFile(filename, "binary", function(err, file) {
			if (err) {
				if (err.code === 'ENOENT' && uri == '/') {
					response.writeHead(302, {
					  'Location': '/src/'
					});
				} else {
					response.writeHead(500, {
						"Content-Type": "text/plain"
					});
					response.write(err + "\n");
				}

				response.end();
				return;
			}

			extension = filename.split('.').pop();

			response.writeHead(200, {
				"Content-Type": contentTypes[extension]||"text/plain",
				"Pragma": "no-cache",
				"Expires": "Wed, 11 Jan 1984 05:00:00 GMT",
				"Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
				"Access-Control-Allow-Origin": "*"

			});
			response.write(file, "binary");
			response.end();
		});
	});
};

if (protocol === 'https') {
	server = https.createServer({
		key: fs.readFileSync('ssl-key.pem'),
		cert: fs.readFileSync('ssl-cert.pem')
	}, createServerCallback);
} else {
	server = http.createServer(createServerCallback);
}
server.listen(parseInt(port, 10));

ifaces = os.networkInterfaces();
for (var dev in ifaces) {
	ifaces[dev].forEach(function(details) {
		if (details.family=='IPv4') {
			console.log(dev + "\n =>  " + protocol + "://" + details.address + ":" + port);
		}
	});
}
console.log();

console.log("Possible params: --port --protocol --dir --absDir");

console.log("Static file server running at\n  => " + protocol + "://localhost:" + port +
		"\nServing files from:" + workingDir,
		"\nCTRL + C to shutdown");
