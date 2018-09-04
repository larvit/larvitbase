'use strict';

const	topLogPrefix	= 'larvitbase: base.js: ',
	circularJson	= require('circular-json'),
	formidable	= require('formidable'),
	Lviews	= require('larvitviews'),
	events	= require('events'),
	merge	= require('utils-merge'),
	utils	= require('larvitutils'),
	path	= require('path'),
	http	= require('http'),
	cuid	= require('cuid'),
	send	= require('send'),
	log	= require('winston'),
	url	= require('url'),
	qs	= require('qs'),
	_	= require('lodash');

let	options,
	router,
	view;

exports = module.exports = function (customOptions) {
	const	returnObj	= new events.EventEmitter();

	/**
	 * Checks if a request is parseable by formidable
	 *
	 * @param obj req - standard request object
	 * @return boolean
	 */
	returnObj.formidableParseable = function formidableParseable(req) {
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

	returnObj.executeController = function executeController(req, res) {
		const	logPrefix	= topLogPrefix + 'executeController() - Request #' + req.cuid + ' - url: ' + req.url + ' - ';

		res.loadAfterware = function (i) {
			if (i === undefined) {
				i = 0;
			}

			// Check for session data from previous call to send to this one and then erase
			if (req.session !== undefined && req.session.data !== undefined && req.session.data.singleCallData !== undefined) {
				try {
					log.debug(logPrefix + 'Session singleCallData found, merging into controller data. singleCallData: ' + circularJson.stringify(req.session.data.singleCallData));
					_.merge(res.controllerData, req.session.data.singleCallData);
					delete req.session.data.singleCallData;
				} catch (err) {
					log.warn(logPrefix + 'Session singleCallData found, but failed to load or merge it. err: ' + err.message);
				}
			}

			if (req.session !== undefined && req.session.data !== undefined && req.session.data.nextCallData !==  undefined) {
				log.debug(logPrefix + 'Session nextCallData found, setting to singleCallData');
				req.session.data.singleCallData = req.session.data.nextCallData;
				delete req.session.data.nextCallData;
			}

			if (options.afterware === undefined || ( ! options.afterware instanceof Array) || options.afterware[i] === undefined) {
				res.sendToClient(null, req, res, res.controllerData);
				return;
			}

			options.afterware[i](req, res, res.controllerData, function () {
				log.silly(logPrefix + 'Loaded afterware nr ' + i);

				if (options.afterware[i + 1] !== undefined) {
					res.loadAfterware(i + 1);
				} else {
					res.sendToClient(null, req, res, res.controllerData);
				}
			});
		};

		res.runSendToClient = function runSendToClient(err, req, res, data) {
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

		res.runController = function runController() {
			log.debug(logPrefix + 'Running controller: ' + req.routeResult.controllerName + ' with path: ' + req.routeResult.controllerFullPath);

			require(req.routeResult.controllerFullPath).run(req, res, res.runSendToClient);
		};

		res.loadMiddleware = function loadMiddleware(i) {
			if (i === undefined) {
				i = 0;
			}

			if (( ! options.middleware instanceof Array) || options.middleware[i] === undefined) {
				res.runController();
				return;
			}

			options.middleware[i](req, res, function () {
				log.silly(logPrefix + 'Loaded middleware nr ' + i);

				if (options.middleware[i + 1] !== undefined) {
					res.loadMiddleware(i + 1);
				} else {
					res.runController();
				}
			});
		};

		res.next = function next() {
			if (req.routeResult.staticFullPath !== undefined) {
				log.debug(logPrefix + 'Serving static file: ' + req.routeResult.staticFullPath);

				res.staticSender = send(req, req.routeResult.staticFullPath, {
					'index':	false,
					'root':	'/'
				});

				// Send (pipe) the file over to the client via the response object
				res.staticSender.pipe(res);

				res.staticSender.on('error', function (err) {
					log.error(logPrefix + 'Error from send(): ' + err.message);
				});
			} else {
				res.loadMiddleware();
			}
		};

		// Expose this session to the outer world
		if ( ! returnObj.emit('httpSession', req, res)) {
			log.debug(logPrefix + 'No listener found for httpSession event, running res.next() automatically');
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
	returnObj.parseRequest = function parseRequest(req, res) {
		const	logPrefix	= topLogPrefix + 'parseRequest() - Request #' + req.cuid + ' - url: ' + req.url + ' - ';

		let	protocol,
			form,
			host;

		if (req.connection && req.connection.encrypted) {
			protocol	= 'https';
		} else {
			protocol	= 'http';
		}

		if (req.headers && req.headers.host) {
			host	= req.headers.host;
		} else {
			host	= 'localhost';
		}

		req.urlParsed = url.parse(protocol + '://' + host + req.url, true);

		if (returnObj.formidableParseable(req)) {
			if (req.headers['content-type'].match(/x-www-form-urlencoded/i)) {
				req.formRawBody	= [];
			} else {
				req.formRawBody	= '';
			}
			req.rawBody	= [];

			form	= new formidable.IncomingForm();
			form.maxFileSize	= 300 * 1024 * 1024;
			form.keepExtensions	= true;

			// Use formidable to handle files but qs to handle formdata
			form.onPart = function (part) {
				// let formidable handle all file parts
				if (part.filename) {
					form.handlePart(part);

				// Use qs to handle array-like stuff like field[a] = b becoming {'field': {'a': 'b'}}
				} else {
					if (Array.isArray(req.formRawBody)) {
						req.formRawBody	= '';
					}

					if (req.formRawBody !== '') {
						req.formRawBody += '&';
					}

					req.formRawBody += encodeURIComponent(part.name) + '=';

					part.on('data', function (data) {
						req.formRawBody += encodeURIComponent(data);
					});
					//part.on('end', function () {
					//
					//});
					part.on('error', function (err) {
						log.warn(logPrefix + 'form.onPart() err: ' + err.message);
					});
				}
			};

			// Details about concatenating the body
			// https://nodejs.org/en/docs/guides/anatomy-of-an-http-transaction/#request-body

			// Save the raw body
			req.on('data', function (data) {
				// Not multipart, fetch raw body to formRawBody as well
				if (req.headers['content-type'].match(/x-www-form-urlencoded/i)) {
					req.formRawBody.push(data);
				}

				req.rawBody.push(data);
			});

			req.on('end', function () {
				try {
					if (Array.isArray(req.formRawBody)) {
						req.formRawBody	= Buffer.concat(req.formRawBody).toString();
					}

					req.rawBody	= Buffer.concat(req.rawBody).toString();
				} catch (err) {
					log.error(logPrefix + 'Could not Buffer.concat() body parts. This is probably because of nodes string size limitation. err: ' + err.message);
				}
			});

			// When the callback to form.parse() is ran, all body is received
			form.parse(req, function (err, fields, files) {
				if (err) {
					log.warn(logPrefix + err.message);
				} else {
					req.formFields	= qs.parse(req.formRawBody, { 'parameterLimit': 10000});
					req.formFiles	= files;
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
		let	logPrefix;

		req.cuid	= cuid();
		req.startTime	= process.hrtime();

		logPrefix	= topLogPrefix + 'parseRequest() - Request #' + req.cuid + ' - url: ' + req.url + ' - ';
		log.debug(logPrefix + 'Starting request');

		function runBeforeWare(i) {
			const	thisLogPrefix	= logPrefix + 'runBeforeWare() - ';

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

			options.beforeware[i](req, res, function (err) {
				if (err) {
					log.error(thisLogPrefix + 'Beforeware nr ' + i + ' err: ' + err.message);
					res.writeHead(500, {'Content-Type': 'text/plain'});
					res.write('500 Internal Server Error\n');
					res.end();
					return;
				}

				log.silly(thisLogPrefix + 'Loaded beforeware nr ' + i);
				runBeforeWare(i + 1);
			});
		}

		runBeforeWare();

		res.on('finish', function () {
			const timer = utils.hrtimeToMs(req.startTime);

			log.debug(logPrefix + 'complete in ' + timer + 'ms');
		});
	};

	returnObj.sendToClient = function sendToClient(err, req, res, data) {
		const	logPrefix	= topLogPrefix + 'sendToClient() - Request #' + req.cuid + ' - url: ' + req.url + ' - ';

		let	splittedPath,
			templateName,
			htmlStr;

		function sendErrorToClient() {
			res.writeHead(500, {'Content-Type': 'text/plain'});
			res.end('Internal server error');
		}

		function sendJsonToClient() {
			const	thisLogPrefix	= logPrefix + 'sendJsonToClient() - ';

			let jsonStr;

			// The controller might have set a custom status code, do not override it
			if ( ! res.statusCode) {
				res.statusCode = 200;
			}

			res.setHeader('Content-Type', 'application/json; charset=utf-8');

			try {
				jsonStr	= JSON.stringify(data);
			} catch (err) {
				res.statusCode	= 500;
				log.error(thisLogPrefix + 'Could not transform data to JSON: "' + err.message + '" JSON.inspect(): "' + require('util').inspect(data, {'depth': null}));
				jsonStr	= '{"error": "' + err.message + '"}';
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

		if (res.headersSent) {
			log.verbose(logPrefix + 'Headers already sent, do not send to client here');
			return;
		}

		if (data === undefined) {
			data = {};
		}

		if ( ! req.urlParsed) {
			const	err	= new Error('req.urlParsed is not set');

			log.error(logPrefix + err.message);
			sendErrorToClient();

			return;
		}

		if (err) {
			log.error(logPrefix + 'got error from caller: "' + err.message + '"');
			sendErrorToClient();

			return;
		}

		// For redirect statuses, do not send a body at all
		if (res.statusCode.toString().substring(0, 1) === '3') {
			log.debug(logPrefix + 'statusCode "' + res.statusCode + '" starting with 3, ending response.');
			res.end();

			return;
		} else {
			log.silly(logPrefix + 'statusCode "' + res.statusCode + '" not starting with 3, continue.');
		}

		splittedPath = req.urlParsed.pathname.split('.');

		// We need to set the request type. Can be either json or html
		if (splittedPath[splittedPath.length - 1] === 'json') {
			req.type	= 'json';
			req.routeResult.controllerName	= req.routeResult.controllerName.substring(0, req.routeResult.controllerName.length - 5);
			if (req.routeResult.controllerName === '') {
				log.info(logPrefix + 'req.controllerName is an empty string, falling back to "default"');
				req.routeResult.controllerName	= 'default';
			}
		} else {
			templateName	= res.templateName;
			if (templateName === undefined) {
				templateName	= req.routeResult.controllerName;
			}

			htmlStr	= view.render(templateName, data);

			// If htmlStr is undefined, no template exists and that means no HTML, send JSON instead
			if (htmlStr === undefined || htmlStr === false) {
				log.verbose(logPrefix + 'No template found for "' + templateName + '", falling back to JSON output');
				req.type	= 'json';
			} else {
				req.type	= 'html';
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
		'controllersPath':	'controllers',
		'pubFilePath':	'public',
		'tmplDir':	'public/tmpl',
		'port':	8001,
		'customRoutes':	[],
		'middleware':	[]
	}, customOptions);

	if (options.controllersPath[0] === '/') {
		options.controllersPath = path.resolve(options.controllersPath);
	}

	log.info(topLogPrefix + 'Creating server on ' + options.host + ':' + options.port);

	router = require('larvitrouter')({
		'customRoutes':	options.customRoutes,
		'controllersPath':	options.controllersPath,
		'pubFilePath':	options.pubFilePath
	});

	view	= new Lviews(options);

	if (options.sendToClient !== undefined) {
		returnObj.sendToClient	= options.sendToClient;
	}

	returnObj.server = http.createServer(serveRequest);

	returnObj.server.on('error', function (err) {
		if (err.code === 'ENOTFOUND') {
			log.error(topLogPrefix + 'Can\'t bind to ' + options.host + ':' + options.port);
			log.verbose(topLogPrefix + 'You most likely want to use "localhost"');
		}

		throw err;
	});

	returnObj.server.listen(options.port, options.host, function () {
		returnObj.emit('serverListening');
	});

	return returnObj;
};
