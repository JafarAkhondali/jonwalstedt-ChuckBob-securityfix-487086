var browserify = require('browserify'),
		stringify = require('stringify'),
		through = require('through'),
		fs = require('fs'),
		filename = 'chuckbob-all.js',
		stream = fs.createWriteStream(filename),
		prependVal = 'var origDefine = define; define = undefined;\n',
		appendVal = '\ndefine = origDefine;';

		browserify()
		.transform(stringify(['.html']))
		.add('./main.js')
		.bundle()
		.pipe(stream);

		stream.on("finish", function () {
			var file = prependVal;
			file += fs.readFileSync(filename);
			file += appendVal;
			fs.writeFileSync(filename, file);
		});
