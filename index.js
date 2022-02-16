'use strict';

const topLogPrefix = 'larvitbase: ' + __filename + ' - ';
const EventEmitter = require('events').EventEmitter;
const { Log }      = require('larvitutils');
const uuid       = require('uuid');
const http         = require('http');

/**
 * App constructor
 *
 * @param {obj} options {'log': log instance, 'middlewares': array of middlewares}
 */
function App(options) {
	const logPrefix = topLogPrefix + 'App() - ';
	const that      = this;

	that.options = options || {};

	if (! that.options.log) {
		that.options.log = new Log();
	}
	that.log = that.options.log;

	that.log.debug(logPrefix + 'Started with options: ' + JSON.stringify(options));

	// Backwards compatible with 2.0 and 2.1
	if (that.options.middleware) {
		that.options.middlewares = that.options.middleware;
	}

	that.middlewares = that.options.middlewares;
}

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.handleReq = function handleReq(req, res) {
	const logPrefix = topLogPrefix + 'handleReq() - ';
	const that      = this;

	req.uuid = uuid.v4();
	req.log = that.log;

	that.log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + that.logUrl(req) + ' started');

	req.timing          = {};
	req.timing.reqStart = that.hrTimeToMs();
	that.runMiddleware(0, req, res);
};

App.prototype.hrTimeToMs = function hrTimeToMs(hrtime) {
	if (! hrtime) {
		hrtime = process.hrtime();
	}

	return (hrtime[0] * 1000) + (hrtime[1] / 1000000);
};

App.prototype.runMiddleware = function runMiddleware(nr, req, res) {
	const logPrefix = topLogPrefix + 'runMiddleware() - ';
	const that      = this;

	if (that.middlewares[nr]) {
		const middlewareStart = that.hrTimeToMs();

		that.middlewares[nr](req, res, function cb(err) {
			const runTime = (that.hrTimeToMs() - middlewareStart).toFixed(3);

			if (err) {
				that.log.warn(logPrefix + 'Error running middleware: ' + err.message);

				return that.emit('error', err, req, res);
			}

			req.timing['middleware_' + String(nr).padStart(3, '0')] = {
				'runTime': runTime,
				'name':    that.middlewares[nr].name
			};
			that.log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' middleware_' + String(nr).padStart(3, '0') + ' (' + that.middlewares[nr].name + '): ' + runTime);

			// Run the next middleware
			that.runMiddleware(nr + 1, req, res);
		});
	} else {
		req.timing.reqEnd     = that.hrTimeToMs();
		req.timing.totReqTime = (req.timing.reqEnd - req.timing.reqStart).toFixed(3);
		that.log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + that.logUrl(req) + ' completed, run time: ' + req.timing.totReqTime + 'ms');
	}
};

App.prototype.start = function start(cb) {
	const logPrefix = topLogPrefix + 'start() - ';
	const that      = this;

	if (! Array.isArray(that.middlewares)) {
		const err = new Error('At least one middleware is required');

		that.log.error(logPrefix + err.message);

		return cb(err);
	}

	that.httpServer = http.createServer(function handleReq(req, res) {
		that.handleReq(req, res);
	});

	that.httpServer.on('listening', function cb() {
		that.log.info(logPrefix + 'http server listening on port ' + that.httpServer.address().port);
	});

	that.httpServer.listen(that.options.httpOptions, cb);
};

App.prototype.logUrl = function logUrl(req) {
	// Do not log password
	return ! req || ! req.url ? '' : req.url.replace(/password=[^&]*/ig, 'password=xxxxx');
};

exports = module.exports = App;
