'use strict';

var path        = require('path'),
    appPath     = path.dirname(require.main.filename),
    serverConf  = require(appPath + '/config/server.json'),
    http        = require('http'),
    serveStatic = require('serve-static')(serverConf.pubFilePath, {'index': false}),
    formidable  = require('formidable'),
    router      = undefined;

createServer(require(appPath + '/config/routes.json'));

// Actually create the server
function createServer(customRoutes) {
	router = require('larvitrouter')({'customRoutes': customRoutes});

	http.createServer(function(request, response) {
		router.resolve(request, function(err){
			if (err) {
				console.error(err);
				request.controllerName = '404';
			}

			// We need to parse the request a bit for POST values etc before we hand it over to the controller(s)
			parseRequest(request, response);
		});
	}).listen(serverConf.port, '127.0.0.1');
}

/**
 * Parse request
 * Fetch POST data etc
 */
function parseRequest(request, response) {
	if (request.method == 'POST') {
		var form = new formidable.IncomingForm();

		form.parse(request, function(err, fields, files){
			if (err) {
				console.error(err);
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

function executeController(request, response) {
	if (request.staticFilename !== undefined)
		serveStatic(request, response);
	else if (request.controllerName !== undefined)
		require(appPath + '/controllers/' + request.controllerName).run(request, response, router.sendToClient);
	else
		require(appPath + '/controllers/404').run(request, response, router.sendToClient);
}