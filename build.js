var browserify = require('browserify'),
		stringify = require('stringify'),
		fs = require('fs'),
		bundle = browserify()
		.transform(stringify(['.html']))
		.add('./main.js')
		.bundle()
		.pipe(fs.createWriteStream('chuckbob-all.js'));
