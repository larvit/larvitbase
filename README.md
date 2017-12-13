[![Build Status](https://travis-ci.org/larvit/larvitbase.svg?branch=master)](https://travis-ci.org/larvit/larvitbase) [![Dependencies](https://david-dm.org/larvit/larvitbase.svg)](https://david-dm.org/larvit/larvitbase.svg)
[![Coverage Status](https://coveralls.io/repos/larvit/larvitbase/badge.svg)](https://coveralls.io/github/larvit/larvitbase)

# http application base framework

## What is it?

A scaled down version of [Express](http://expressjs.com). It is as micro as micro can be, it only runs an array of middlewere functions, nothing more.

## Why?

* More flexibility due to all functionality being in the middleware functions (no built-in "helpers", router, view system etc)
* In contrast to Express, it is possible to run a middleware before the router, or after the controller
* Better separations of concerns (routing, view system etc should not be a part of the base framework!)
* No dependencies in production (only development dependencies)
* Less is more

## Installation

```bash
npm i larvitbase
```

## Usage

### Minimal basic example

This will create a http server on port 8001 that will print "Hello world" whatever you send in.

```javascript
const App = require('larvitbase');
new App({
	'httpOptions': 8001,
	'middleware': [
		function (req, res) {
			res.end('Hello world');
		}
	]
});
```

### A bit more usable example

index.js:

```javascript
'use strict';

const appOptions = {},
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let	app;

// Translate an url into a path to a controller
function router(req, res, cb) {
	if (req.url === '/') {
		req.controllerPath	= __dirname + '/controllers/default.js';
	} else if (req.url === '/foo') {
		req.controllerPath	= __dirname + '/controllers/foo.js';
	} else {
		req.controllerPath	= __dirname + '/controllers/404.js';
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

appOptions.middleware.push(router);

// Run the controller that the router resolved for us
// Controllers should populate res.data for this example to work
appOptions.middleware.push(function (req, res, cb) {
	require(req.controllerPath)(req, res, cb);
});

// Send the data to the client
appOptions.middleware.push(function (req, res, cb) {
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
```

controllers/foo.js:

```javascript
'use strict';

exports = module.exports = function (req, res, cb) {
	res.data = `<!doctype html>
<html>
	<head>
		<title>Hello</title>
	</head>
	<body>
		<h1>this is static</h1>
	</body>
</html>`;
	cb();
};
```

public/templates/foo.ejs:

```html
<!doctype html>
<html>
	<head>
		<title><%= title %></title>
	</head>
	<body>
		<h1><%= heading %></h1>
	</body>
</html>
```

Now a request to /foo would render the HTML above.

### Example with some custom, external libraries

#### Required external packages

* [larvitrouter](https://www.npmjs.com/package/larvitrouter)
* [ejs](https://www.npmjs.com/package/ejs)

#### Example files

index.js:

```javascript
'use strict';

const appOptions = {},
      Router     = require('larvitrouter'),
      router     = new Router(),
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let	app;

appOptions.httpOptions = 8001; // Will be sent directly to nodes
//                                http.createServer().listen(##here##) For
//                                more info, see:
//                                https://nodejs.org/api/http.html#http_class_http_server

appOptions.middleware = [];

// Translate an url into a path to a controller and more
// Will populate:
// req.routed.controllerPath
// req.routed.controllerFullPath
// req.routed.staticPath
// req.routed.staticFullPath
// req.routed.templatePath
// req.routed.templateFullPath
appOptions.middleware.push(function (req, res, cb) {
	router.resolve(req.url, function (err, result) {
		req.routed	= result;
		cb(err);
	});
});

// Run the controller that the router resolved for us
// Controllers should populate res.data for this example to work
appOptions.middleware.push(function (req, res, cb) {
	require(req.routed.controllerFullPath)(req, res, cb);
});

// Transform the res.data into HTML with a template engine, in our case [EJS](http://ejs.co/)
appOptions.middleware.push(function (req, res, cb) {
	ejs.renderFile(req.routed.templateFullPath, res.data, function (err, html) {
		if (err) return cb(err);
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.end(html);
	});
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
```

controllers/foo.js:

```javascript
'use strict';

exports = module.exports = function (req, res, cb) {
	res.data = {'title': 'foo', 'heading': 'bar'};
	cb();
};
```

public/templates/foo.ejs:

```html
<!doctype html>
<html>
	<head>
		<title><%= title %></title>
	</head>
	<body>
		<h1><%= heading %></h1>
	</body>
</html>
```

Now a request to /foo would render the HTML above.

## Middleware functions

Middleware functions are compatible with [Express](http://expressjs.com), and follow the same principles:

Middleware functions can perform the following tasks:

* Execute any code.
* Make changes to the request and the response objects.
* End the request-response cycle.
* Call the next middleware function in the stack.
