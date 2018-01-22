'use strict';

const	topLogPrefix	= 'larvitbase: ' + __filename + ' - ',
	EventEmitter	= require('events').EventEmitter,
	uuidv4	= require('uuid/v4'),
	http	= require('http'),
	log	= require('winston');

// https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
// Remove when node 6 is no longer supported
if ( ! String.prototype.padStart) {
	String.prototype.padStart = function padStart(targetLength, padString) {
		targetLength	= targetLength >> 0; // Truncate if number or convert non-number to 0;
		padString	= String((typeof padString !== 'undefined' ? padString : ' '));
		if (this.length > targetLength) {
			return String(this);
		} else {
			targetLength	= targetLength - this.length;
			if (targetLength > padString.length) {
				padString += padString.repeat(targetLength / padString.length); // Append to original to ensure we are longer than needed
			}
			return padString.slice(0, targetLength) + String(this);
		}
	};
}

function App(options, cb) {
	const	logPrefix	= topLogPrefix + 'App() - ',
		that	= this;

	try {
		log.debug(logPrefix + 'Started with options: ' + JSON.stringify(options));
	} catch (err) {
		log.error(logPrefix + 'Invalid options, could not JSON.stringify()');
		return cb(err);
	}

	that.options	= options;

	if ( ! that.options || ! Array.isArray(that.options.middleware)) {
		const	err	= new Error('At least one middleware is required');
		log.error(logPrefix + err.message);
		return cb(err);
	}

	that.httpServer = http.createServer(function (req, res) {
		that.handleReq(req, res);
	});

	that.httpServer.listen(that.options.httpOptions, cb);
}

App.prototype = Object.create(EventEmitter.prototype);

App.prototype.handleReq = function handleReq(req, res) {
	const	logPrefix	= topLogPrefix + 'handleReq() - ',
		that	= this;

	req.uuid	= uuidv4();

	log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + req.url + ' started');

	req.timing	= {};
	req.timing.reqStart	= that.hrTimeToMs();
	that.runMiddleware(0, req, res);
};

App.prototype.hrTimeToMs = function hrTimeToMs(hrtime) {
	if ( ! hrtime) {
		hrtime	= process.hrtime();
	}

	return hrtime[0] * 1000 + hrtime[1] / 1000000;
};

App.prototype.runMiddleware = function runMiddleware(nr, req, res) {
	const	logPrefix	= topLogPrefix + 'runMiddleware() - ',
		that	= this;

	if (that.options.middleware[nr]) {
		const	middlewareStart	= that.hrTimeToMs();

		that.options.middleware[nr](req, res, function (err) {
			const	runTime	= (that.hrTimeToMs() - middlewareStart).toFixed(3);

			if (err) {
				log.warn(logPrefix + 'Error running middleware: ' + err.message);
				return that.emit('error', err, req, res);
			}

			req.timing['middleware_' + String(nr).padStart(3, '0')] = {
				'runTime':	runTime,
				'name':	that.options.middleware[nr].name
			};
			log.debug(logPrefix + 'req.uuid: ' + req.uuid + ' middleware_' + String(nr).padStart(3, '0') + ' (' + that.options.middleware[nr].name + '): ' + runTime);

			// Run the next middleware
			that.runMiddleware(nr + 1, req, res);
		});
	} else {
		req.timing.reqEnd	= that.hrTimeToMs();
		req.timing.totReqTime	= (req.timing.reqEnd - req.timing.reqStart).toFixed(3);
		log.verbose(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + req.url + ' completed, run time: ' + req.timing.totReqTime + 'ms');
	}
};

exports = module.exports = App;
