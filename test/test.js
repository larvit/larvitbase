'use strict';

const freeport = require('freeport');
const request  = require('request');
const LUtils   = require('larvitutils');
const lUtils   = new LUtils();
const async    = require('async');
const test     = require('tape');
const log      = new lUtils.Log('none');
const App      = require(__dirname + '/../index.js');

test('Basic request', function (t) {
	const tasks = [];

	let port;
	let app;

	t.timeoutAfter(200);

	// Get free port
	tasks.push(function (cb) {
		freeport(function (err, result) {
			port = result;
			cb(err);
		});
	});

	// Start server
	tasks.push(function (cb) {
		/* eslint-disable require-jsdoc */
		function errTrigger(req, res, cb) {
			if (req.url === '/foo') {
				return cb(new Error('deng'));
			}
			cb();
		}

		function helloWorldWriter(req, res, cb) {
			res.end('Hello world');
			cb();
		}
		/* eslint-enable require-jsdoc */

		app = new App({
			'log':         log,
			'httpOptions': port,
			'middleware':  [
				errTrigger,
				helloWorldWriter
			]
		});

		app.start(cb);

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
		if (err) t.fail('err: ' + err.message);
		t.end();
	});
});

test('Starting without middleware', function (t) {
	const app = new App({'log': log});

	app.start(function (err) {
		t.equal(err instanceof Error, true);
		t.end();
	});
});

test('Starting without any options at all', function (t) {
	const app = new App();

	app.start(function (err) {
		t.equal(err instanceof Error, true);
		t.end();
	});
});

test('Starting with bogus options', function (t) {
	const weirdOpts = {};

	weirdOpts.woo = weirdOpts;

	try {
		new App(weirdOpts);
		throw new Error('No error was emitted when instancing app');
	} catch (err) {
		t.equal(err instanceof Error, true);
		t.end();
	}
});

test('Check so hrTimeToMs works when using a param', function (t) {
	const app = new App({
		'middleware': [function (req, res) { res.end('boll'); }],
		'log':        log
	});

	app.start(function (err) {
		if (err) throw err;
		t.equal(app.hrTimeToMs([4466, 908020700]), 4466908.0207);
		t.end();
		app.httpServer.close();
	});
});
