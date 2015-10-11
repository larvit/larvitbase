'use strict';

var path       = require('path'),
    http       = require('http'),
    events     = require('events'),
    formidable = require('formidable'),
    log        = require('winston'),
    cuid       = require('cuid'),
    merge      = require('utils-merge'),
    utils      = require('larvitutils'),
    send       = require('send'),
    _          = require('lodash'),
    server,
    options,
    view,
    router;

exports = module.exports = function(customOptions) {
	var returnObj = new events.EventEmitter();

	/**
	 * Checks if a request is parseable by formidable
	 *
	 * @param obj request - standard request object
	 * @return boolean
	 */
	returnObj.formidableParseable = function(request) {
		// For reference this is taken from formidable/lib/incoming_form.js - IncomingForm.prototype._parseContentType definition

		if (request.method !== 'POST') {
			return false;
		}

		if ( ! request.headers['content-type']) {
			return false;
		}

		if (request.headers['content-type'].match(/octet-stream/i)) {
			return true;
		}

		if (request.headers['content-type'].match(/urlencoded/i)) {
			return true;
		}

		if (request.headers['content-type'].match(/multipart/i) && request.headers['content-type'].match(/boundary=(?:"([^"]+)"|([^;]+))/i)) {
			return true;
		}

		if (request.headers['content-type'].match(/json/i)) {
			return true;
		}

		// No matches
		return false;
	};

	returnObj.executeController = function(request, response) {
		response.loadAfterware = function(i) {
			if (i === undefined) {
				i = 0;
			}

			// Check for session data from previous call to send to this one and then erase
			if (request.session !== undefined && request.session.data !== undefined && request.session.data.singleCallData !== undefined) {
				try {
					log.debug('larvitbase: Request #' + request.cuid + ' - session singleCallData found, merging into controller data. singleCallData: ' + JSON.stringify(request.session.data.singleCallData));
					_.merge(response.controllerData, request.session.data.singleCallData);
					delete request.session.data.singleCallData;
				} catch(err) {
					log.warn('larvitbase: Request #' + request.cuid + ' - session singleCallData found, but failed to load or merge it. err: ' + err.message);
				}
			}

			if (request.session !== undefined && request.session.data !== undefined && request.session.data.nextCallData !==  undefined) {
				log.debug('larvitbase: Request #' + request.cuid + ' - session nextCallData found, setting to singleCallData');
				request.session.data.singleCallData = request.session.data.nextCallData;
				delete request.session.data.nextCallData;
			}

			if (options.afterware === undefined || ( ! options.afterware instanceof Array) || options.afterware[i] === undefined) {
				response.sendToClient(null, request, response, response.controllerData);
				return;
			}

			options.afterware[i](request, response, response.controllerData, function() {
				log.silly('larvitbase: Request #' + request.cuid + ' - Loaded afterware nr ' + i);

				if (options.afterware[i + 1] !== undefined) {
					response.loadAfterware(i + 1);
				} else {
					response.sendToClient(null, request, response, response.controllerData);
				}
			});
		};

		response.runSendToClient = function(err, request, response, data) {
			// Set this to the outer clojure to be accessible for other functions
			response.controllerData = data;

			// If there is an error, do not run afterware at all,
			// just call sendToClient to send this error information to the client
			if (err) {
				response.sendToClient(err, request, response, data);
				return;
			}

			response.loadAfterware();
		};

		response.runController = function() {
			log.debug('larvitbase: Request #' + request.cuid + ' - Running controller: ' + request.controllerName + ' with path: ' + request.controllerFullPath);

			require(request.controllerFullPath).run(request, response, response.runSendToClient);
		};

		response.loadMiddleware = function(i) {
			if (i === undefined) {
				i = 0;
			}

			if (( ! options.middleware instanceof Array) || options.middleware[i] === undefined) {
				response.runController();
				return;
			}

			options.middleware[i](request, response, function() {
				log.silly('larvitbase: Request #' + request.cuid + ' - Loaded middleware nr ' + i);

				if (options.middleware[i + 1] !== undefined) {
					response.loadMiddleware(i + 1);
				} else {
					response.runController();
				}
			});
		};

		response.next = function() {
			if (request.staticFilename !== undefined) {
				log.debug('larvitbase: Request #' + request.cuid + ' - Serving static file: ' + request.staticFilename);

				response.staticSender = send(request, request.staticFilename, {
					'index': false,
					'root': '/'
				});

				// Send (pipe) the file over to the client via the response object
				response.staticSender.pipe(response);

				response.staticSender.on('error', function(err) {
					log.error('larvitbase: Request #' + request.cuid + ' Error from send(): ' + err.message);
				});
			} else {
				response.loadMiddleware();
			}
		};

		// Expose this session to the outer world
		if ( ! returnObj.emit('httpSession', request, response)) {
			log.debug('larvitbase: executeController() - No listener found for httpSession event, running response.next() automatically');
			response.next();
		}
	};

	/**
	 * Parse request
	 * Fetch POST data etc
	 *
	 * @param obj request - standard request object
	 * @param obj response - standard response object
	 * @param func sendToClient(err, request, response, data) where data is the data that should be sent
	 */
	returnObj.parseRequest = function(request, response) {
		var form;

		if (returnObj.formidableParseable(request)) {
			form = new formidable.IncomingForm();

			form.parse(request, function(err, fields, files) {
				if (err) {
					log.warn('larvitbase: Request #' + request.cuid + ' - parseRequest() - ' + err.message, err);
				} else {
					request.formFields = fields;
					request.formFiles  = files;
				}
				returnObj.executeController(request, response);
			});
		} else {
			// No parsing needed, just execute the controller
			returnObj.executeController(request, response);
		}
	};

	/**
	 * Serve a request created by the http.createServer
	 *
	 * @param obj request - standard request object
	 * @param obj respose - standard response object
	 */
	function serveRequest(request, response) {
		request.cuid      = cuid();
		request.startTime = process.hrtime();
		log.verbose('larvitbase: Starting request #' + request.cuid + ' to: "' + request.url);

		response.on('finish', function() {
			var timer = utils.hrtimeToMs(request.startTime);

			log.debug('larvitbase: Request #' + request.cuid + ' complete in ' + timer + 'ms');
		});

		router.resolve(request, function(err) {
			if (err) {
				// Could not be resolved, this is logged in router.resolve()
				// This includes that the 404 controller could not be resolved. Send hard coded 404 response.
				response.writeHead(404, {'Content-Type': 'text/plain'});
				response.write('404 Not Found\n');
				response.end();

				return;
			}

			response.sendToClient = returnObj.sendToClient;

			// We need to parse the request a bit for POST values etc before we hand it over to the controller(s)
			returnObj.parseRequest(request, response);
		});
	};

	returnObj.sendToClient = function(err, request, response, data) {
		var splittedPath,
		    htmlStr,
		    templateName;

		function sendErrorToClient() {
			response.writeHead(500, {'Content-Type': 'text/plain'});
			response.end('Internal server error');
		}

		function sendJsonToClient() {
			var jsonStr;

			// The controller might have set a custom status code, do not override it
			if ( ! response.statusCode) {
				response.statusCode = 200;
			}

			response.setHeader('Content-Type', 'application/json; charset=utf-8');

			try {
				jsonStr = JSON.stringify(data);
			} catch(err) {
				response.statusCode = 500;
				log.error('larvitbase: sendToClient() - sendJsonToClient() - Could not transform data to JSON: "' + err.message + '" JSON.inspect(): "' + require('util').inspect(data, {'depth': null}));
				jsonStr = '{"error": "' + err.message + '"}';
			}

			response.end(jsonStr);
		}

		function sendHtmlToClient(htmlStr) {
			// The controller might have set a custom status code, do not override it
			if ( ! response.statusCode) {
				response.statusCode = 200;
			}

			response.setHeader('Content-Type', 'text/html; charset=utf-8');
			response.end(htmlStr);
		}

		if (data === undefined) {
			data = {};
		}

		if ( ! request.urlParsed) {
			err = new Error('larvitbase: request.urlParsed is not set');
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
		if (response.statusCode.toString().substring(0, 1) === '3') {
			log.debug('larvitbase: sendToClient() - statusCode "' + response.statusCode + '" starting with 3, ending response.');
			response.end();
			return;
		} else {
			log.silly('larvitbase: sendToClient() - statusCode "' + response.statusCode + '" not starting with 3, continue.');
		}

		splittedPath = request.urlParsed.pathname.split('.');

		// We need to set the request type. Can be either json or html
		if (splittedPath[splittedPath.length - 1] === 'json') {
			request.type           = 'json';
			request.controllerName = request.controllerName.substring(0, request.controllerName.length - 5);
			if (request.controllerName === '') {
				log.info('larvitbase: sendToClient() - request.controllerName is an empty string, falling back to "default"');
				request.controllerName = 'default';
			}
		} else {
			templateName = response.templateName;
			if (templateName === undefined) {
				templateName = request.controllerName;
			}

			htmlStr = view.render(templateName, data);

			// If htmlStr is undefined, no template exists and that means no HTML, send JSON instead
			if (htmlStr === undefined) {
				log.verbose('larvitbase: sendToClient() - No template found for "' + templateName + '", falling back to JSON output');
				request.type = 'json';
			} else {
				request.type = 'html';
			}
		}

		if (request.type === 'html') {
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

	view = require('larvitviews')(options);

	if (options.sendToClient !== undefined) {
		returnObj.sendToClient = options.sendToClient;
	}

	server = http.createServer(serveRequest);

	server.on('error', function(err) {
		if (err.code === 'ENOTFOUND') {
			log.error('larvitbase: Can\'t bind to ' + options.host + ':' + options.port);
			log.verbose('larvitbase: You most likely want to use "localhost"');
		}

		throw err;
	});

	server.listen(options.port, options.host);

	return returnObj;
};