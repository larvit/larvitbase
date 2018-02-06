# Simple first application

In this document you will learn to:

* Create static routes
* Create separate controller files for your URLs

## Router: router.js

```javascript
'use strict';

// Routing
// Translate an url into a path to a controllers
exports = module.exports = function router(req, res, cb) {
	if (req.url === '/') {
		req.controllerFullPath	= __dirname + '/controllers/default.js';
	} else if (req.url === '/foo') {
		req.controllerFullPath	= __dirname + '/controllers/foo.js';
	} else {
		req.controllerFullPath	= __dirname + '/controllers/404.js';
	}
	cb();
}
```

## App base file; index.js

```javascript
'use strict';

const appOptions = {},
      router     = require(__dirname + '/router.js'),
      App        = require('larvitbase'),
      fs         = require('fs');

let app;

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
	// Just stop here if we have no controllerFullPath
	if ( ! req.controllerFullPath) {
		res.end('No controllerFullPath provided');
		return cb();
	}

	// Require the controller file and run it as a function directly
	// See below for example on how to create your controller files
	require(req.controllerFullPath)(req, res, cb);
});

// Start the app
app = new App(appOptions);

// Handle errors in one of the middleweres during a request
app.on('error', function (err, req, res) {
	res.statusCode = 500;
	res.end('Internal server error: ' + err.message);
});
```

## Controller: default.js

```javascript
'use strict';

exports = module.exports = function controllerDefault(req, res, cb) {
	res.end('This is the default page!');
	cb();
}
```

## Controller: foo.js

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
	res.end('Foo custom page');
	cb();
}
```

## Controller: 404.js

```javascript
'use strict';

exports = module.exports = function controller404(req, res, cb) {
	res.statusCode	= 404;
	res.end('404 Not Found');
	cb();
}
```
