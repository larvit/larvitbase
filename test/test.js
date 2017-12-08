'use strict';

const	freeport	= require('freeport'),
	request	= require('request'),
	async	= require('async'),
	test	= require('tape'),
	App	= require(__dirname + '/../index.js');

test('Basic request', function (t) {
	const	tasks	= [];

	let	port,
		app;

	t.timeoutAfter(100);

	// Get free port
	tasks.push(function (cb) {
		freeport(function (err, result) {
			port	= result;
			cb(err);
		});
	});

	// Start server
	tasks.push(function (cb) {
		app = new App({
			'httpOptions':	port,
			'middleware': [
				function (req, res, cb) {
					if (req.url === '/foo') {
						return cb(new Error('deng'));
					}
					cb();
				},
				function (req, res, cb) {
					res.end('Hello world');
					cb();
				}
			]
		}, cb);

		app.on('error', function (err, req, res) {
			res.statusCode = 500;
			res.end('Internal server error: ' + err.message);
		});
	});

	// Try 200 request
	tasks.push(function (cb) {
		request('http://localhost:' + port + '/bar', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	200);
			t.equal(body,	'Hello world');
			cb();
		});
	});

	// Try 500 request
	tasks.push(function (cb) {
		request('http://localhost:' + port + '/foo', function (err, response, body) {
			if (err) return cb(err);
			t.equal(response.statusCode,	500);
			t.equal(body,	'Internal server error: deng');
			cb();
		});
	});

	// Close server
	tasks.push(function (cb) {
		app.httpServer.close(cb);
	});

	async.series(tasks, function (err) {
		if (err) {
			t.fail('err: ' + err.message);
		}
		t.end();
	});
});

test('Starting witout middleware', function (t) {
	new App({}, function (err) {
		t.equal(err instanceof Error, true);
		t.end();
	});
});
