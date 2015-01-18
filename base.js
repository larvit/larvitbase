'use strict';

var path        = require('path'),
    appPath     = path.dirname(require.main.filename),
    serverConf  = require(appPath + '/config/server.json'),
    http        = require('http'),
    serveStatic = require('serve-static')(serverConf.pubFilePath, {'index': false, 'maxAge': 1000}),
    formidable  = require('formidable'),
    log         = require('winston'),
    cuid        = require('cuid'),
    merge       = require('utils-merge'),
    utils       = require('larvitutils'),
    router;

function executeController(request, response) {
	if (request.staticFilename !== undefined) {
		log.debug('larvitbase: Serving static file: ' + request.staticFilename);

		serveStatic(request, response);
	} else if (request.controllerName !== undefined) {
		require(appPath + '/controllers/' + request.controllerName).run(request, response, router.sendToClient);
	} else {
		require(appPath + '/controllers/404').run(request, response, router.sendToClient);
	}
}

/**
 * Parse request
 * Fetch POST data etc
 */
function parseRequest(request, response) {
	var form;

	if (request.method === 'POST') {
		form = new formidable.IncomingForm();

		form.parse(request, function(err, fields, files){
			if (err) {
				log.error(err.message, err);
				response.writeHead(500, {'content-type': 'text/plain'});
				response.end('Internal server error');
			} else {
				request.formFields = fields;
				request.formFiles  = files;
				executeController(request, response);
			}
		});
	} else {
		// No parsing needed, just execute the controller
		executeController(request, response);
	}
}

exports = module.exports = function(options) {
	log.info('larvitbase: Creating server on ' + serverConf.host + ':' + serverConf.port);

	// Set default options
	options = merge({
		'pubFilePath':  serverConf.pubFilePath,
		'tmplDir':      'tmpl',
		'port':         serverConf.port,
		'host':         serverConf.host,
		'customRoutes': []
	}, options);

	router = require('larvitrouter')({'customRoutes': options.customRoutes});

	http.createServer(function(request, response) {
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
			parseRequest(request, response);
		});
	}).listen(options.port, options.host);
};