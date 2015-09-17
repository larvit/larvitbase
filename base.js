'use strict';

var path       = require('path'),
    appPath    = path.dirname(require.main.filename),
    http       = require('http'),
    formidable = require('formidable'),
    log        = require('winston'),
    cuid       = require('cuid'),
    merge      = require('utils-merge'),
    utils      = require('larvitutils'),
    send       = require('send'),
    server,
    options,
    router;

exports = module.exports = function(customOptions) {
	var returnObj = {};

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

	returnObj.executeController = function(request, response, sendToClient) {
		var controllerData,
		    staticSender;

		function loadAfterware(i, callback) {
			if (typeof i === 'function') {
				callback = i;
				i        = 0;
			}

			if (options.afterware === undefined || ( ! options.afterware instanceof Array) || options.afterware[i] === undefined) {
				callback(null, request, response, controllerData);
				return;
			}

			options.afterware[i](request, response, controllerData, function() {
				log.silly('larvitbase: Request #' + request.cuid + ' - Loaded afterware nr ' + i);

				if (options.afterware[i + 1] !== undefined) {
					loadAfterware(i + 1);
				} else {
					callback(null, request, response, controllerData);
				}
			});
		}

		function runSendToClient(err, request, response, data) {
			// Set this to the outer clojure to be accessible for other functions
			controllerData = data;

			// If there is an error, do not run afterware at all,
			// just call sendToClient to send this error information to the client
			if (err) {
				sendToClient(err, request, response, data);
				return;
			}

			loadAfterware(returnObj.sendToClient);
		}

		function runController() {
			log.debug('larvitbase: Request #' + request.cuid + ' - Running controller: ' + request.controllerName + ' with path: ' + request.controllerFullPath);

			require(request.controllerFullPath).run(request, response, runSendToClient);
		}

		function loadMiddleware(i) {
			if (i === undefined) {
				i = 0;
			}

			if (( ! options.middleware instanceof Array) || options.middleware[i] === undefined) {
				runController();
				return;
			}

			options.middleware[i](request, response, function() {
				log.silly('larvitbase: Request #' + request.cuid + ' - Loaded middleware nr ' + i);

				if (options.middleware[i + 1] !== undefined) {
					loadMiddleware(i + 1);
				} else {
					runController();
				}
			});
		}

		if (request.staticFilename !== undefined) {
			log.debug('larvitbase: Request #' + request.cuid + ' - Serving static file: ' + request.staticFilename);

			staticSender = send(request, request.staticFilename, {
				'index': false,
				'root': '/'
			});

			// Send (pipe) the file over to the client via the response object
			staticSender.pipe(response);

			staticSender.on('error', function(err) {
				log.error('larvitbase: Request #' + request.cuid + ' Error from send(): ' + err.message);
			});
		} else {
			loadMiddleware();
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
	returnObj.parseRequest = function(request, response, sendToClient) {
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
				returnObj.executeController(request, response, sendToClient);
			});
		} else {
			// No parsing needed, just execute the controller
			returnObj.executeController(request, response, sendToClient);
		}
	};

	/**
	 * Serve a request created by the http.createServer
	 *
	 * @param obj request - standard request object
	 * @param obj respose - standard response object
	 */
	returnObj.serveRequest = function(request, response) {
		request.cuid      = cuid();
		request.startTime = process.hrtime();
		log.debug('larvitbase: Starting request #' + request.cuid + ' to: "' + request.url);

		response.on('finish', function() {
			var timer = utils.hrtimeToMs(request.startTime);

			log.debug('larvitbase: Request #' + request.cuid + ' complete in ' + timer + 'ms');
		});

		router.resolve(request, function(err) {
			if (err) {
				// Could not be resolved, this is logged in router.resolve()
				// This includes that the 404 controller could not be resolve. Send hard coded 404 response
				response.writeHead(404, {'Content-Type': 'text/plain'});
				response.write('404 Not Found\n');
				response.end();

				return;
			}

			// We need to parse the request a bit for POST values etc before we hand it over to the controller(s)
			response.sendToClient = options.sendToClient;
			returnObj.parseRequest(request, response, response.sendToClient);
		});
	};

	returnObj.sendToClient = function(err, request, response, data) {
		var viewPath = options.viewPath + '/' + request.controllerName,
		    view,
		    splittedPath;

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
				log.error('larvitbase: returnObj.sendToClient() - sendJsonToClient() - Could not transform data to JSON: "' + err.message + '" JSON.inspect(): "' + require('util').inspect(data, {'depth': null}));
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

		// Custom view file found
		if (data.viewFile !== undefined) {
			viewPath = options.viewPath + '/' + data.viewFile;
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
			request.type = 'html';
		}

		// For redirect statuses, do not send a body at all
		if (response.statusCode.toString().substring(0, 1) === '3') {
			response.end();
			return;
		}

		if (request.type === 'html') {

			// Checking for custom view file
			router.fileExists(viewPath + '.js', function(err, exists, fullPath) {
				if (err) {
					err.message = 'larvitbase: router.fileExists() failed. View full path: "' + fullPath + '"';
					log.error(err.message);
					return;
				}

				if (exists) {
					view = require(fullPath);

					view.run(data, function(err, htmlStr) {
						if (err) {
							err.message = 'larvitbase: view.run() failed. View full path: "' + fullPath + '"';
							log.error(err.message);
							sendErrorToClient();
							return;
						}

						sendHtmlToClient(htmlStr);
					});
				} else {
					sendJsonToClient();
				}
			});
		} else if (request.type === 'json') {
			sendJsonToClient();
		}
	};

	// Set default options
	options = merge({
		'controllersPath': 'controllers',
		'pubFilePath':     'public',
		'viewPath':        'public/views',
		'tmplDir':         'public/tmpl',
		'port':            8001,
		'customRoutes':    [],
		'middleware':      []
	}, customOptions);

	if (options.controllersPath[0] === '/') {
		options.controllersPath = path.resolve(options.controllersPath);
	}

	if (options.viewPath[0] === '/') {
		options.viewPath = path.resolve(options.viewPath);
	}

	log.info('larvitbase: Creating server on ' + options.host + ':' + options.port);

	router = require('larvitrouter')({
		'customRoutes':    options.customRoutes,
		'controllersPath': options.controllersPath,
		'pubFilePath':     options.pubFilePath
	});

	if (options.sendToClient !== undefined) {
		returnObj.sendToClient = options.sendToClient;
	}

	server = http.createServer(returnObj.serveRequest);

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