# 02. Templates

In this tutorial we will learn how to apply a templating engine to larvitbase.

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
      App        = require('larvitbase'),
      ejs        = require('ejs'),
      fs         = require('fs');

let app;

// Router, see previous chapter for details.
// However, notice that we do not need a controller for each URL now
function router(req, res, cb) {
	if (req.url === '/') {
		req.controllerFullPath = __dirname + '/controllers/default.js';
    req.templateFullPath = __dirname + '/public/templates/default.ejs';
	} else if (req.url === '/foo') {
    req.controllerFullPath = __dirname + '/controllers/foo.js';
    req.templateFullPath = __dirname + '/public/templates/default.ejs';
	} else {
    req.templateFullPath = __dirname + '/public/templates/404.ejs';
	}
	cb();
}

// Run the controller if the router resolved one for us
// Controllers should populate res.data for this example to work
function controller(req, res, cb) {
	// If no controller is found, set res.data to an empty obect and proceed
	if ( ! req.controllerFullPath) {
    res.data  = {};
		return cb();
	}

	require(req.controllerFullPath)(req, res, cb);
}

// Render the template
function renderTemplate(req, res, cb) {
  // From the router we get a req.templateFullPath that should point to our template
  // We use fs.readFileSync() to load the file contents to a string
  // Then we feed that to ejs.render() together with res.data
  // That should be produced from the controller
  res.body = ejs.render(fs.readFileSync(req.templateFullPath, res.data);

  cb();
}

// Write the now rendered body to the client
function writeToClient(req, res, cb) {
  res.end(res.body);
  cb();
}

// Put all our functions as middlewares and feed them into the app
middleware.push(router);
middleware.push(controller);
middleware.push(renderTemplate);
middleware.push(writeToClient);

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

### controllers/default.js

```javascript
'use strict';

exports = module.exports = function controllerDefault(req, res, cb) {
  res.data  = {'foo': 'bar'};
	cb();
}
```

### controllers/foo.js

```javascript
'use strict';

exports = module.exports = function controllerFoo(req, res, cb) {
  res.data  = {'foo': 'baz'};
	cb();
}
```

blurg blurg blurg. Please complete me!

## Test your application

From the path of your application, type:

    node ./index.js

Then go to a browser and go to http://localhost:8001 and you should see "This is the default page!". Test the URL:s /foo and /something as well and see what happends.
