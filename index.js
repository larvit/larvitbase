'use strict';

const	topLogPrefix	= 'larvitbase: ' + __filename + ' - ',
	EventEmitter	= require('events').EventEmitter,
	uuidv4	= require('uuid/v4'),
	http	= require('http'),
	log	= require('winston');

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
		return cb(new Error('at least one middleware is required'));
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
		that.options.middleware[nr](req, res, function (err) {
			if (err) {
				return that.emit('error', err, req, res);
			}
			that.runMiddleware(nr + 1, req, res);
		});
	} else {
		req.timing.reqEnd	= that.hrTimeToMs();
		req.timing.totReqTime	= (req.timing.reqEnd - req.timing.reqStart).toFixed(3);
		log.verbose(logPrefix + 'req.uuid: ' + req.uuid + ' to url: ' + req.url + ' completed, runtime: ' + req.timing.totReqTime + 'ms');
	}
};

exports = module.exports = App;
