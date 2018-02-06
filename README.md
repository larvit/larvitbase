[![Build Status](https://travis-ci.org/larvit/larvitbase.svg?branch=master)](https://travis-ci.org/larvit/larvitbase) [![Dependencies](https://david-dm.org/larvit/larvitbase.svg)](https://david-dm.org/larvit/larvitbase.svg)
[![Coverage Status](https://coveralls.io/repos/github/larvit/larvitbase/badge.svg)](https://coveralls.io/github/larvit/larvitbase)

# Micro web framework

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

In case you're building a full webb system, you probably want to go directly to [larvitbase-www](https://github.com/larvit/larvitbase-www) or if you're building an API, you might want to look at [larvitbase-api](https://github.com/larvit/larvitbase-api). Both of these is larvitbase plus some middlewares to handle the basics of each scenario.

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

### A bit more usable examples

[Static router and controllers](./docs/01_simple.md)
[Templates](./doc/02_templates.md)
[Forms](./doc/03_forms.md)
[Dynamic router](./doc/04_router.md)
[Static files](./doc/05_staticFiles.md)

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

## Logging

This module logs using [winston](https://www.npmjs.com/package/winston), please consult the documentation for that package for details on how to configure winson. No configuration is needed to make larvitbase run.

Log levels used:

* error	- Fatal! Application should not continue to run at all
* warn	- Important problem. Application might be able to continue, but this should be addressed to maintain stability.
* info	- Important information. Probably not a problem, but information of high value to sysops.
* verbose	- Nice-to-have information. Statistis about each request run time and such.

**Do not use in production**

* debug	- Debug information. Further statistics and other debug info. Will flood your logs if used in production!
* silly	- Silly amounts of information. Will flood your logs even if not in production, your terminal will explode.

## Further middlewares

Other middlewares that is highly usable

* [larvitreqparser](https://www.npmjs.com/package/larvitreqparser) - handle request data, forms (POST, PUT, DELETE) etc
* [larvitsession](https://www.npmjs.com/package/larvitsession) - sessions to remember data between requests

## Middleware functions

Middleware functions are compatible with [Express](http://expressjs.com), and follow the same principles:

Middleware functions can perform the following tasks:

* Execute any code.
* Make changes to the request and the response objects.
* End the request-response cycle.
* Call the next middleware function in the stack.
