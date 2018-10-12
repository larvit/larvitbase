'use strict';

const topLogPrefix = 'larvitbase: ' + __filename + ' - ';
const EventEmitter = require('events').EventEmitter;
const LUtils       = require('larvitutils');
const uuidv4       = require('uuid/v4');
const http         = require('http');

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
// Remove when node 6 is no longer supported
if (! String.prototype.padStart) {
	String.prototype.padStart = function padStart(targetLength, padString) {
		targetLength = targetLength >> 0; // Truncate if number or convert non-number to 0;
		padString    = String((typeof padString !== 'undefined' ? padString : ' '));
		if (this.length > targetLength) {
			return String(this);
		} else {
			targetLength = targetLength - this.length;
			if (targetLength > padString.length) {
				padString += padString.repeat(targetLength / padString.length); // Append to original to ensure we are longer than needed
			}

			return padString.slice(0, targetLength) + String(this);
		}
	};
}

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
		const lUtils = new LUtils();

		that.options.log = new lUtils.Log();
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

	req.uuid = uuidv4();
	req.log = that.log;

	that.log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + req.url + ' started');

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
		that.log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + req.url + ' completed, run time: ' + req.timing.totReqTime + 'ms');
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

exports = module.exports = App;
