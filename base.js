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
	 * Needed callback for loaded middleware to harmonize with express middleware next() functions
	 */
	returnObj.logLoadedMiddleware = function() {
		log.silly('larvitbase: logLoadedMiddleware() - Middleware ran...');
	};

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
		var i;

		if (request.staticFilename !== undefined) {
			log.debug('larvitbase: Serving static file: ' + request.staticFilename);

			if (options.serveStatic instanceof Function) {
				options.serveStatic(request, response);
			} else {
				log.error('larvitbase: Static file found on URL, but no valid serveStatic function available');
			}
		} else {
			// Load middleware
			if (options.middleware instanceof Array) {
				i = 0;
				while (options.middleware[i] !== undefined) {
					if (typeof options.middleware[i] === 'function') {
						options.middleware[i](request, response, returnObj.logLoadedMiddleware);
					}

					i ++;
				}
			}

			if (request.controllerName !== undefined) {
				require(options.controllersPath + '/' + request.controllerName).run(request, response, router.sendToClient);
			} else {
				require(options.controllersPath + '/404').run(request, response, router.sendToClient);
			}
		}
	};

	/**
	 * Parse request
	 * Fetch POST data etc
	 */
	returnObj.parseRequest = function(request, response) {
		var form;

		if (returnObj.formidableParseable(request)) {
			form = new formidable.IncomingForm();

			form.parse(request, function(err, fields, files) {
				if (err) {
					log.warn('larvitbase: parseRequest() - ' + err.message, err);
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
			returnObj.parseRequest(request, response);
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

	options.controllersPath = path.join(appPath, options.controllersPath);

	// Setup static file serving
	if (options.serveStatic === undefined) {
		log.info('larvitbase: No custom serveStatic option found, loading default.');
		options.serveStatic = require('serve-static')(options.pubFilePath, {'index': false, 'maxAge': 1000});
	} else if ( ! (options.serveStatic instanceof Function)) {
		log.error('larvitbase: serveStatic parameter must be a function');
	}

	log.info('larvitbase: Creating server on ' + options.host + ':' + options.port);

	router = require('larvitrouter')({'customRoutes': options.customRoutes});

	http.createServer(returnObj.serveRequest).listen(options.port, options.host);

	return returnObj;
};