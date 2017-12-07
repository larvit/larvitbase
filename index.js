'use strict';

const	EventEmitter	= require('events').EventEmitter,
	http	= require('http');

function App(options, cb) {
	const	that	= this;

	function runMiddleware(nr, req, res) {
		if (that.options.middleware[nr]) {
			that.options.middleware[nr](req, res, function (err) {
				if (err) {
					that.emit('error', err, req, res);
					return;
				}
				runMiddleware(nr + 1, req, res);
			});
		}
	}

	that.options	= options;

	if ( ! that.options || ! Array.isArray(that.options.middleware)) {
		throw new Error('at least one middleware is required');
	}

	that.httpServer	= http.createServer(function (req, res) {
		runMiddleware(0, req, res);
	});

	that.httpServer.listen(that.options.httpOptions, cb);
}

App.prototype	= Object.create(EventEmitter.prototype);

exports = module.exports = App;
