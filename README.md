[![Build Status](https://travis-ci.org/larvit/larvitbase.svg?branch=master)](https://travis-ci.org/larvit/larvitbase) [![Dependencies](https://david-dm.org/larvit/larvitbase.svg)](https://david-dm.org/larvit/larvitbase.svg)
[![Coverage Status](https://coveralls.io/repos/github/larvit/larvitbase/badge.svg)](https://coveralls.io/github/larvit/larvitbase)

# Micro web framework

## Index

* [What is it?](#what-is-it-)
* [Why?](#why-)
* [Installation](#installation)
* [Usage](#usage)
  * [Minimal basic example](#minimal-basic-example)
  * [Routing](#routing)
    * [Your own router](#roll-your-own)
    * [larvitrouter](#larvitrouter)
  * [Templates](#templates)
  * [Forms](#forms)
  * [Static Files](#static-files)
  * [Error handling](#error-handling)
* [Logging](#logging)
* [Middleware Functions](#middleware-functions)
  * [Larvit middlewares](#larvit-middlewares)


## What is it?
[Top](#top)

A scaled down version of [Express](http://expressjs.com). It is as micro as micro can be, it only runs an array of middlewere functions, nothing more.

## Why?
[Top](#top)

* More flexibility due to all functionality being in the middleware functions (no built-in "helpers", router, view system etc)
* In contrast to Express, it is possible to run a middleware before the router, or after the controller
* Better separations of concerns (routing, view system etc should not be a part of the base framework!)
* No dependencies in production (only development dependencies)
* Less is more

## Installation
[Top](#top)

```bash
npm i larvitbase
```

## Usage
[Top](#top)

In case you're building a full webb system, you probably want to go directly to [larvitbase-www](https://github.com/larvit/larvitbase-www) or if you're building an API, you might want to look at [larvitbase-api](https://github.com/larvit/larvitbase-api). Both of these is larvitbase plus some middlewares to handle the basics of each scenario.

### Minimal basic example
[Top](#top)

This will create a http server on port 8001 that will print "Hello world" whatever you send in.

```javascript
const App = require('larvitbase');

new App({
	'httpOptions': 8001, // Listening port
	'middleware': [
		function (req, res) {
			res.end('Hello world');
		}
	]
});
```

### Routing
[Top](#top)

Routing is how to match a special URL to a specific piece of code or pieces of code.

There is no built in routing, but it is easy to make your own or use the more fully fledged [larvitrouter](https://github.com/larvit/larvitrouter).

#### Roll your own
[Top](#top)

Something like this:

```javascript
const App = require('larvitbase');

function router(req, res, cb) {
	if (req.url === '/') {
		req.controller	= controllerOne;
	} else if (req.url === '/foo') {
		req.controller	= controllerTwo;
	} else {
		req.controller	= notFound;
	}
	cb();
}

function runController(req, res, cb) {
	req.controller(req, res, cb);
}

function controllerOne(req, res, cb) {
	res.end('This is controllerOne! Hepp!');
}

function controllerTwo(req, res, cb) {
	res.end('This is the second controller function! Hola!');
}

function notFound(req, res, cb) {
	res.statusCode	= 404;
	res.end('The URL matched no controller. Ledsen i ögat. :(');
}

new App({
	'httpOptions': 8001, // Listening port
	'middleware': [
		router,	// First run the router
		runController	// Then run the routed controller
	]
});
```

##### Test your application

From the path of your application, type:

    node ./index.js

Then go to a browser and go to http://localhost:8001 and you should see "This is controllerOne! Hepp!". Test the URL:s /foo and /something as well and see what happends.

#### larvitrouter
[Top](#top)

For a bit larger application, it is often desireble with a more competent router. For this we have [larvitrouter](https://github.com/larvit/larvitrouter). It will resolve paths to controller files as well as template files and static files. See the documentation for an in depth guide. Here follows a small example:

First install it:

```bash
npm i larvitrouter
```

##### index.js

```javascript
const Router = require('larvitrouter'),
      router = new Router(),
      App    = require('larvitbase');

function runRouter(req, res, cb) {
	router.resolve(req.url, function (err, result) {
		req.routeResult = result; // Store the route result on the request so we can access it from elsewhere
		cb(err);
	});
}

function runController(req, res, cb) {

	// A controller file was found!
	if (req.routeResult.controllerFullPath) {
		const controller = require(req.routeResult.controllerFullPath);
		controller(req, res, cb);

	// No controller file was found
	} else {
		res.statusCode	= 404;
		return res.end('Not found');
	}
}

new App({
	'httpOptions': 8001, // Listening port
	'middleware': [
		runRouter,
		runController
	]
});
```

##### controllers/foo.js

To make the URL /url work on our application, we create this file and save it like this:

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
	res.end('Foo custom page');
	cb();
}
```

##### controllers/default.js

The default controller is a bit special. It will match both / and /default.

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
	res.end('Default page');
	cb();
}
```

### Templates
[Top](#top)

### Forms
[Top](#top)

### Static Files
[Top](#top)

### Error handling
[Top](#top)

In case something goes wrong inside any of your middlewares and an error is returned, we need to handle that somehow. This is how:

```javascript
const App = require('larvitbase');

let app;

app = new App({
	'httpOptions': 8001, // Listening port
	'middleware': [
		function (req, res, cb) {
			return cb(new Error('Something went wrong! :('))
		}
	]
});

// Handle errors in one of the middleweres during a request
app.on('error', function (err, req, res) {
	res.statusCode = 500;
	res.end('Internal server error: ' + err.message);
});
```


## Logging
[Top](#top)

This module logs using [winston](https://www.npmjs.com/package/winston), please consult the documentation for that package for details on how to configure winson. No configuration is needed to make larvitbase run.

Log levels used:

* error	- Fatal! Application should not continue to run at all
* warn	- Important problem. Application might be able to continue, but this should be addressed to maintain stability.
* info	- Important information. Probably not a problem, but information of high value to sysops.
* verbose	- Nice-to-have information. Statistis about each request run time and such.

**Do not use in production**

* debug	- Debug information. Further statistics and other debug info. Will flood your logs if used in production!
* silly	- Silly amounts of information. Will flood your logs even if not in production, your terminal will explode.

## Middleware functions
[Top](#top)

Middleware functions are compatible with [Express](http://expressjs.com), and follow the same principles:

Middleware functions can perform the following tasks:

* Execute any code.
* Make changes to the request and the response objects.
* End the request-response cycle.
* Call the next middleware function in the stack.

### Larvit middlewares
[Top](#top)

* [larvitreqparser](https://www.npmjs.com/package/larvitreqparser) - handle request data, forms (POST, PUT, DELETE) etc
* [larvitsession](https://www.npmjs.com/package/larvitsession) - sessions to remember data between requests
