# Simple first application

In this document you will learn to:

* Create static routes
* Create separate controller files for your URLs
* Using EJS as template engine

## Install dependencies

We will need larvitbase (doh) and [ejs](http://ejs.co/)

```bash
npm i --save larvitbase ejs;
```

## App base file; index.js

```javascript
'use strict';

const appOptions = {},
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let app;

// Routing
// Translate an url into a path to a controllers
function router(req, res, cb) {
	if (req.url === '/') {
		req.controllerFullPath	= __dirname + '/controllers/default.js';
		req.templateFullPath	= __dirname + '/public/templates/default.ejs';
	} else if (req.url === '/foo') {
		req.controllerFullPath	= __dirname + '/controllers/foo.js';
		req.templateFullPath	= __dirname + '/public/templates/foo.ejs';
	} else {
		req.templateFullPath	= __dirname + '/public/templates/404.ejs';
	}
	cb();
}

appOptions.httpOptions = 8001; // Will be sent directly to nodes
//                                http.createServer().listen(##here##) For
//                                more info, see:
//                                https://nodejs.org/api/http.html#http_class_http_server

// Without any middleware, nothing will ever happend and all calls will be left hanging
// Middle ware functions are compatible with Express middleware functions
appOptions.middleware = [];

// Start with the router we created earlier
appOptions.middleware.push(router);

// Run the controller if the router resolved one for us
// Controllers should populate res.data for this example to work
appOptions.middleware.push(function controller(req, res, cb) {
	if ( ! req.controllerFullPath) return cb(); // Just stop here if we have no controllerFullPath

	// Require the controller file and run it as a function directly
	// See below for example on how to create your controller files
	require(req.controllerFullPath)(req, res, cb);
});

// Render the template21

// Send the data to the client
appOptions.middleware.push(function sendToClient(req, res, cb) {
	res.end(res.data);
});

// Start the app
app = new App(appOptions);

// Handle errors in one of the middleweres during a request
app.on('error', function (err, req, res) {
	res.statusCode = 500;
	res.end('Internal server error: ' + err.message);
});

// Exposed stuff
//app.httpServer	- the node http server instance
//app.options	- the appOptions as used by the app
//app.timing	- how long each middleware as well as the complete req/res took
```
