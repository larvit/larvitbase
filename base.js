'use strict';

var path        = require('path'),
    appPath     = path.dirname(require.main.filename),
    http        = require('http'),
    formidable  = require('formidable'),
    log         = require('winston'),
    cuid        = require('cuid'),
    merge       = require('utils-merge'),
    utils       = require('larvitutils'),
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
		var controllerData;

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

			loadAfterware(sendToClient);
		}

		function runController() {
			if (request.controllerName === undefined) {
				request.controllerName = '404';
			}

			require(options.controllersPath + '/' + request.controllerName).run(request, response, runSendToClient);
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

			if (options.serveStatic instanceof Function) {
				options.serveStatic(request, response);
			} else {
				log.error('larvitbase: Request #' + request.cuid + ' - Static file found on URL, but no valid serveStatic function available');
			}
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
				// Could not be resolved, this is logged in router.reslove()
				request.controllerName = '404';
			}

			// We need to parse the request a bit for POST values etc before we hand it over to the controller(s)
			response.sendToClient = options.sendToClient;
			returnObj.parseRequest(request, response, response.sendToClient);
		});
	};

	// Set default options
	options = merge({
		'controllersPath': './controllers',
		'pubFilePath':     './public',
		'tmplDir':         'tmpl',
		'port':            8001,
		'customRoutes':    [],
		'middleware':      []
	}, customOptions);

	if (options.controllersPath[0] === '/') {
		options.controllersPath = path.resolve(options.controllersPath);
	} else {
		options.controllersPath = path.join(appPath, options.controllersPath);
	}

	// Setup static file serving
	if (options.serveStatic === undefined) {
		log.info('larvitbase: No custom serveStatic option found, loading default.');
		options.serveStatic = require('serve-static')(options.pubFilePath, {'index': false, 'maxAge': 1000});
	} else if ( ! (options.serveStatic instanceof Function)) {
		log.error('larvitbase: serveStatic parameter must be a function');
	}

	log.info('larvitbase: Creating server on ' + options.host + ':' + options.port);

	router = require('larvitrouter')({'customRoutes': options.customRoutes});

	if (options.sendToClient === undefined) {
		options.sendToClient = router.sendToClient;
	}

	http.createServer(returnObj.serveRequest).listen(options.port, options.host);

	return returnObj;
};