'use strict';

const assert = require('assert'),
      http   = require('http'),
      log    = require('winston');

let port;

// Set up winston
log.remove(log.transports.Console);
log.add(log.transports.Console, {
	'level':     'warn',
	'colorize':  true,
	'timestamp': true,
	'json':      false
});

process.cwd('..');

before(function(done) {
	require('freeport')(function(err, tmpPort) {
		assert( ! err, 'err should be negative');

		port = tmpPort;

		// Start the server up
		require(process.cwd() + '/base.js')({
			'port': port,
			'customRoutes': [{
				'regex':          '^/en_slemmig_torsk_i_en_brödrost$',
				'controllerName': 'default'
			}]
		});

		done();
	});
});

describe('Basics', function() {
	it('Test basic connection', function(done) {
		const req = http.request({'port': port, 'path': '/'}, function(res) {
			assert.deepEqual(res.statusCode, 200);
			assert.deepEqual(res.headers['content-type'], 'text/html; charset=utf-8');
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				assert.deepEqual(chunk, `<html>
	<head>
		<title>foobar</title>
	</head>
	<body>
		<h1>Default route</h1>
		<h2>Controller</h2>
		<p>This controller lives in &lt;modulepath&gt;/larvitbase/controllers/default.js.<br />If you copy it to &lt;application path&gt;/controllers/default.js and edit this new copy, it will override the module one.</p>
		<h2>Template</h2>
		<p>You can find this template file at &lt;modulepath&gt;/larvitbase/public/tmpl/default.tmpl.<br />Copy it to &lt;application path&gt;/public/tmpl/default.tmpl and edit it to you needs just as the controller.</p>
		<h2>Partial</h2>
		<p>Below is the rendering of a partial:</p>
		<p>Some data: bar</p>

	</body>
</html>`);
			});
			res.on('end', function() {
				done();
			});
		});

		req.end();
	});

	it('Test static file', function(done) {
		const req = http.request({'port': port, 'path': '/favicon.ico'}, function(res) {
			assert.deepEqual(res.statusCode, 200);
			assert.deepEqual(res.headers['content-type'], 'image/x-icon');
			res.on('data', function(chunk) {
				assert.notDeepEqual(chunk, undefined);
			});
			res.on('end', function() {
				done();
			});
		});

		req.end();
	});

	it('Test custom route', function(done) {
		const req = http.request({'port': port, 'path': '/en_slemmig_torsk_i_en_brödrost'}, function(res) {
			assert.deepEqual(res.statusCode, 200);
			assert.deepEqual(res.headers['content-type'], 'text/html; charset=utf-8');
			res.on('data', function(chunk) {
				assert.notDeepEqual(chunk, undefined);
			});
			res.on('end', function() {
				done();
			});
		});

		req.end();
	});

	it('Test 404 page for non defined route', function(done) {
		const req = http.request({'port': port, 'path': '/does_not_exist'}, function(res) {
			assert.deepEqual(res.statusCode, 404);
			assert.deepEqual(res.headers['content-type'], 'text/html; charset=utf-8');
			res.on('data', function() {
			});
			res.on('end', function() {
				done();
			});
		});

		req.end();
	});
});