'use strict';

const formidable = require('formidable'),
      Lviews     = require('larvitviews'),
      events     = require('events'),
      merge      = require('utils-merge'),
      utils      = require('larvitutils'),
      path       = require('path'),
      http       = require('http'),
      cuid       = require('cuid'),
      send       = require('send'),
      log        = require('winston'),
      url        = require('url'),
      _          = require('lodash');

let options,
    router,
    view;

exports = module.exports = function(customOptions) {
	const returnObj = new events.EventEmitter();

	/**
	 * Checks if a request is parseable by formidable
	 *
	 * @param obj req - standard request object
	 * @return boolean
	 */
	returnObj.formidableParseable = function(req) {
		// For reference this is taken from formidable/lib/incoming_form.js - IncomingForm.prototype._parseContentType definition

		if (req.method !== 'POST') {
			return false;
		}

		if ( ! req.headers['content-type']) {
			return false;
		}

		if (req.headers['content-type'].match(/octet-stream/i)) {
			return true;
		}

		if (req.headers['content-type'].match(/urlencoded/i)) {
			return true;
		}

		if (req.headers['content-type'].match(/multipart/i) && req.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i)) {
			return true;
		}

		if (req.headers['content-type'].match(/json/i)) {
			return true;
		}

		// No matches
		return false;
	};

	returnObj.executeController = function(req, res) {
		res.loadAfterware = function(i) {
			if (i === undefined) {
				i = 0;
			}

			// Check for session data from previous call to send to this one and then erase
			if (req.session !== undefined && req.session.data !== undefined && req.session.data.singleCallData !== undefined) {
				try {
					log.debug('larvitbase: Request #' + req.cuid + ' - session singleCallData found, merging into controller data. singleCallData: ' + JSON.stringify(req.session.data.singleCallData));
					_.merge(res.controllerData, req.session.data.singleCallData);
					delete req.session.data.singleCallData;
				} catch(err) {
					log.warn('larvitbase: Request #' + req.cuid + ' - session singleCallData found, but failed to load or merge it. err: ' + err.message);
				}
			}

			if (req.session !== undefined && req.session.data !== undefined && req.session.data.nextCallData !==  undefined) {
				log.debug('larvitbase: Request #' + req.cuid + ' - session nextCallData found, setting to singleCallData');
				req.session.data.singleCallData = req.session.data.nextCallData;
				delete req.session.data.nextCallData;
			}

			if (options.afterware === undefined || ( ! options.afterware instanceof Array) || options.afterware[i] === undefined) {
				res.sendToClient(null, req, res, res.controllerData);
				return;
			}

			options.afterware[i](req, res, res.controllerData, function() {
				log.silly('larvitbase: Request #' + req.cuid + ' - Loaded afterware nr ' + i);

				if (options.afterware[i + 1] !== undefined) {
					res.loadAfterware(i + 1);
				} else {
					res.sendToClient(null, req, res, res.controllerData);
				}
			});
		};

		res.runSendToClient = function(err, req, res, data) {
			// Set this to the outer clojure to be accessible for other functions
			res.controllerData = data;

			// If there is an error, do not run afterware at all,
			// just call sendToClient to send this error information to the client
			if (err) {
				res.sendToClient(err, req, res, data);
				return;
			}

			res.loadAfterware();
		};

		res.runController = function() {
			log.debug('larvitbase: Request #' + req.cuid + ' - Running controller: ' + req.routeResult.controllerName + ' with path: ' + req.routeResult.controllerFullPath);

			require(req.routeResult.controllerFullPath).run(req, res, res.runSendToClient);
		};

		res.loadMiddleware = function(i) {
			if (i === undefined) {
				i = 0;
			}

			if (( ! options.middleware instanceof Array) || options.middleware[i] === undefined) {
				res.runController();
				return;
			}

			options.middleware[i](req, res, function() {
				log.silly('larvitbase: Request #' + req.cuid + ' - Loaded middleware nr ' + i);

				if (options.middleware[i + 1] !== undefined) {
					res.loadMiddleware(i + 1);
				} else {
					res.runController();
				}
			});
		};

		res.next = function() {
			if (req.routeResult.staticFullPath !== undefined) {
				log.debug('larvitbase: Request #' + req.cuid + ' - Serving static file: ' + req.routeResult.staticFullPath);

				res.staticSender = send(req, req.routeResult.staticFullPath, {
					'index': false,
					'root': '/'
				});

				// Send (pipe) the file over to the client via the response object
				res.staticSender.pipe(res);

				res.staticSender.on('error', function(err) {
					log.error('larvitbase: Request #' + req.cuid + ' Error from send(): ' + err.message);
				});
			} else {
				res.loadMiddleware();
			}
		};

		// Expose this session to the outer world
		if ( ! returnObj.emit('httpSession', req, res)) {
			log.debug('larvitbase: executeController() - No listener found for httpSession event, running res.next() automatically');
			res.next();
		}
	};

	/**
	 * Parse request
	 * Fetch POST data etc
	 *
	 * @param obj req - standard request object
	 * @param obj res - standard response object
	 * @param func sendToClient(err, req, res, data) where data is the data that should be sent
	 */
	returnObj.parseRequest = function(req, res) {
		let protocol,
		    form,
		    host;

		if (req.connection && req.connection.encrypted) {
			protocol = 'https';
		} else {
			protocol = 'http';
		}

		if (req.headers && req.headers.host) {
			host = req.headers.host;
		} else {
			host = 'localhost';
		}

		req.urlParsed = url.parse(protocol + '://' + host + req.url, true);

		if (returnObj.formidableParseable(req)) {
			form                = new formidable.IncomingForm();
			form.keepExtensions = true;

			form.parse(req, function(err, fields, files) {
				if (err) {
					log.warn('larvitbase: Request #' + req.cuid + ' - parseRequest() - ' + err.message, err);
				} else {
					req.formFields = fields;
					req.formFiles  = files;
				}
				returnObj.executeController(req, res);
			});
		} else {
			// No parsing needed, just execute the controller
			returnObj.executeController(req, res);
		}
	};

	/**
	 * Serve a request created by the http.createServer
	 *
	 * @param obj req - standard request object
	 * @param obj res - standard response object
	 */
	function serveRequest(req, res) {
		req.cuid      = cuid();
		req.startTime = process.hrtime();
		log.debug('larvitbase: Starting request #' + req.cuid + ' to: "' + req.url);

		function runBeforeWare(i) {
			if (options.beforeware === undefined || ( ! options.beforeware instanceof Array)) {
				options.beforeware = [];
			}

			if (i === undefined) {
				// Set X-Powered-By header
				res.setHeader('X-Powered-By', 'larvitbase on node.js');

				i = 0;
			}

			if (options.beforeware[i] === undefined) {
				req.routeResult = router.resolve(req.url.split('?')[0]);

				res.sendToClient = returnObj.sendToClient;

				// We need to parse the request a bit for POST values etc before we hand it over to the controller(s)
				returnObj.parseRequest(req, res);

				return;
			}

			options.beforeware[i](req, res, function(err) {
				if (err) {
					log.error('larvitbase: Request #' + req.cuid + ' - Beforeware nr ' + i + ' err: ' + err.message);
					res.writeHead(500, {'Content-Type': 'text/plain'});
					res.write('500 Internal Server Error\n');
					res.end();
					return;
				}

				log.silly('larvitbase: Request #' + req.cuid + ' - Loaded beforeware nr ' + i);
				runBeforeWare(i + 1);
			});
		}

		runBeforeWare();

		res.on('finish', function() {
			const timer = utils.hrtimeToMs(req.startTime);

			log.debug('larvitbase: Request #' + req.cuid + ' complete in ' + timer + 'ms');
		});
	};

	returnObj.sendToClient = function(err, req, res, data) {
		let splittedPath,
		    templateName,
		    htmlStr;

		function sendErrorToClient() {
			res.writeHead(500, {'Content-Type': 'text/plain'});
			res.end('Internal server error');
		}

		function sendJsonToClient() {
			let jsonStr;

			// The controller might have set a custom status code, do not override it
			if ( ! res.statusCode) {
				res.statusCode = 200;
			}

			res.setHeader('Content-Type', 'application/json; charset=utf-8');

			try {
				jsonStr = JSON.stringify(data);
			} catch(err) {
				res.statusCode = 500;
				log.error('larvitbase: sendToClient() - sendJsonToClient() - Could not transform data to JSON: "' + err.message + '" JSON.inspect(): "' + require('util').inspect(data, {'depth': null}));
				jsonStr = '{"error": "' + err.message + '"}';
			}

			res.end(jsonStr);
		}

		function sendHtmlToClient(htmlStr) {
			// The controller might have set a custom status code, do not override it
			if ( ! res.statusCode) {
				res.statusCode = 200;
			}

			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			res.end(htmlStr);
		}

		if (data === undefined) {
			data = {};
		}

		if ( ! req.urlParsed) {
			let err = new Error('larvitbase: req.urlParsed is not set');
			log.error(err.message);

			sendErrorToClient();
			return;
		}

		if (err) {
			log.error('larvitbase: sendToClient() - got error from caller: "' + err.message + '"');
			sendErrorToClient();
			return;
		}

		// For redirect statuses, do not send a body at all
		if (res.statusCode.toString().substring(0, 1) === '3') {
			log.debug('larvitbase: sendToClient() - statusCode "' + res.statusCode + '" starting with 3, ending response.');
			res.end();
			return;
		} else {
			log.silly('larvitbase: sendToClient() - statusCode "' + res.statusCode + '" not starting with 3, continue.');
		}

		splittedPath = req.urlParsed.pathname.split('.');

		// We need to set the request type. Can be either json or html
		if (splittedPath[splittedPath.length - 1] === 'json') {
			req.type                       = 'json';
			req.routeResult.controllerName = req.routeResult.controllerName.substring(0, req.routeResult.controllerName.length - 5);
			if (req.routeResult.controllerName === '') {
				log.info('larvitbase: sendToClient() - req.controllerName is an empty string, falling back to "default"');
				req.routeResult.controllerName = 'default';
			}
		} else {
			templateName = res.templateName;
			if (templateName === undefined) {
				templateName = req.routeResult.controllerName;
			}

			htmlStr = view.render(templateName, data);

			// If htmlStr is undefined, no template exists and that means no HTML, send JSON instead
			if (htmlStr === undefined) {
				log.verbose('larvitbase: sendToClient() - No template found for "' + templateName + '", falling back to JSON output');
				req.type = 'json';
			} else {
				req.type = 'html';
			}
		}

		if (req.type === 'html') {
			sendHtmlToClient(htmlStr);
		} else {
			sendJsonToClient();
		}
	};

	// Set default options
	options = merge({
		'controllersPath': 'controllers',
		'pubFilePath':     'public',
		'tmplDir':         'public/tmpl',
		'port':            8001,
		'customRoutes':    [],
		'middleware':      []
	}, customOptions);

	if (options.controllersPath[0] === '/') {
		options.controllersPath = path.resolve(options.controllersPath);
	}

	log.info('larvitbase: Creating server on ' + options.host + ':' + options.port);

	router = require('larvitrouter')({
		'customRoutes':    options.customRoutes,
		'controllersPath': options.controllersPath,
		'pubFilePath':     options.pubFilePath
	});

	view = new Lviews(options);

	if (options.sendToClient !== undefined) {
		returnObj.sendToClient = options.sendToClient;
	}

	returnObj.server = http.createServer(serveRequest);

	returnObj.server.on('error', function(err) {
		if (err.code === 'ENOTFOUND') {
			log.error('larvitbase: Can\'t bind to ' + options.host + ':' + options.port);
			log.verbose('larvitbase: You most likely want to use "localhost"');
		}

		throw err;
	});

	returnObj.server.listen(options.port, options.host);

	return returnObj;
};
