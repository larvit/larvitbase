[![Build Status](https://travis-ci.org/larvit/larvitbase.svg?branch=master)](https://travis-ci.org/larvit/larvitbase) [![Dependencies](https://david-dm.org/larvit/larvitbase.svg)](https://david-dm.org/larvit/larvitbase.svg)

# http application base framework

## What is it?

A scaled down version of [Express](http://expressjs.com). It is as micro as micro can be, it only runs an array of middlewere functions, nothing more.

## Why?

* More flexibility due to all functionality being in the middleware functions (no built-in "helpers", router, view system etc)
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

Normally you'd want a router, some templating, form handling and other stuff in your applications.

index.js:

```javascript
'use strict';

const appOptions = {},
      router     = new require('larvitrouter')(),
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let	app;

appOptions.httpOptions = 8001; // Will be sent directly to nodes
//                                http.createServer().listen(##here##) For
//                                more info, see:
//                                https://nodejs.org/api/http.html#http_class_http_server

// Without any middleware, nothing will ever happend and all calls will be left hanging
// Middle ware functions are compatible with Express middleware functions
appOptions.middleware = [];

// Translte an url into a path to a controller
// Will populate:
// req.controllerPath
// req.templatePath
// See https://github.com/larvit/larvitrouter for more info
appOptions.middleware.push(router.middleware);


//appOptions.middleware.push(lBase.middleware.loadFormdata());

// Run the controller that the router resolved for us
// Controllers should populate res.data for this example to work
appOptions.middleware.push(function (req, res, cb) {
	require(res.controllerPath)(req, res, cb);
});

// Transform the res.data into HTML with a template engine, in our case [EJS](http://ejs.co/)
appOptions.middleware.push(function (req, res, cb) {
	ejs.renderFile(req.templatePath, res.data, cb);
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
