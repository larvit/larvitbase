# Larvibase templating tutorial

There is no preference on templating engines for larvitbase. As long as it can be incorporated as a middleware, it can run under this module. We will show an example here with [EJS](http://ejs.co/).

## Install dependencies

In a new folder, do the following:

```bash
npm i larvitbase ejs
```

## Create the files

### index.js - App base file

```javascript
'use strict';

const middleware = [],
      router     = require(__dirname + '/router.js'),
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let app;

middleware.push(router);

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
app = new App({
	'httpOptions': 8001,
	'middleware':  middleware
});

// Handle errors in one of the middleweres during a request
app.on('error', function (err, req, res) {
	res.statusCode = 500;
	res.end('Internal server error: ' + err.message);
});
```

### router.js

Used to route incoming requests

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

### controllers/default.js

```javascript
'use strict';

exports = module.exports = function controllerDefault(req, res, cb) {
	res.end('This is the default page!');
	cb();
}
```

### controllers/foo.js

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
	res.end('Foo custom page');
	cb();
}
```

### controllers/404.js

```javascript
'use strict';

exports = module.exports = function controller404(req, res, cb) {
	res.statusCode	= 404;
	res.end('404 Not Found');
	cb();
}
```

## Test your application

From the path of your application, type:

    node ./index.js

Then go to a browser and go to http://localhost:8001 and you should see "This is the default page!". Test the URL:s /foo and /something as well and see what happends.
