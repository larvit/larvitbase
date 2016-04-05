[![Build Status](https://travis-ci.org/larvit/larvitbase.svg?branch=master)](https://travis-ci.org/larvit/larvitbase) [![Dependencies](https://david-dm.org/larvit/larvitbase.svg)](https://david-dm.org/larvit/larvitbase.svg)

# larvitbase

Node.js micro framework

## Installation

```bash
npm i larvitbase
```

## Basic usage

In your application root directory, create a file named server.js with the following content:

```javascript
'use strict';

const lbase = require('larvitbase'),

      // Will auto-route to controllers in the controller folder and static files in the public folder
      // To add custom routes, do something like this:
      // lbase.routeReq({'routes': [{'regex': '^/foo$', 'controllerName': 'bar'}]})
      // This will make a request to /foo resolve to execute the controller "bar"
      routeReq = lbase.routeReq(),

      // Simply run the controller
      // This function expects request.controllerFullPath to be set to a runnable file, like so:
      // require(request.controllerFullPath)(request, response, callback)
      // Where callback is given two parameters: err and data
      // "data" being a free form object that will be set by execController to request.controllerData
      execController = lbase.execController(),

      // Sends the output from the controller to the client
      // This includes transforming the controller output to HTML or XML or whatever
      sendToClient = lbase.sendToClient(),

      // Starts up a server on port 8001, for custom port do: new lbase.App({'port': 1234})
      app = new lbase.App(),

// These functions will be executed in order, each taking the parameters:
// (request, response, next)
app.onRequestDo = [
	routeReq,
	execController,
	sendToClient
];
```

### Controllers

A controller needs to fill a few criterias.

It must reside in ./controllers/_controllerName_.js - for example ./controllers/default.js to match the above "/" route.

It need to have the following structure:

    'use strict';

    exports.run = function(request, response, callback) {

    	// This is the data we send back to the callback
    	// It can be calls to other subcontrollers, database calls etc
    	var data = {

            // The _global will be appended on each template partials data
            '_global': {
                'warthog': false
            },

    		'head': {
    			'title': 'foobar'
    		},
    		'foo': 'bar'
    	};

    	callback(null, request, response, data);
    }

### Templates

Larvitbase use [larvitviews](https://github.com/larvit/larvitviews), which in turn use [lodash templates](https://lodash.com/docs#template). They are fed with the data sent in the callback from the controller.

The templates resides by default in ./public/views/tmpl/_controllerName_.tmpl - for example ./public/viewstmpl/default.tmpl to match the above "/" route. From the controller, set response.templateName to something else to use a custom template if you do not wish to use the controller name.

An example template can look like:

    <!DOCTYPE html>
    <html lang="en">
    	<%= _.render('head', obj) %>
    	<body>
    		<h1>Look at our beautiful data below</h1>
    		<p><%= obj.foo %> or, for equal result use <%= foo %></p>
    	</body>
    </html>

The example head section, ./public/views/tmpl/head.tmpl, can look like this:

    <head>
    	<meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    	<title><%= title %></title>
    </head>

### Check that it works

    $ node ./server.js

## Advanced usage

### Custom sendToClient

The default behaviour for sending the controller data as JSON directly to the client or as HTML after parsed templates within the router can be omitted by passing a custom sendToClient() function in the options.

This example prints the controller data as plain text to the browser:

    'use strict';

    require('larvitbase')({
    	'sendToClient': function(err, request, response, data) {
    		response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    		response.writeHead(200);
    		response.end(data.toString());
    	}
    });

### Middleware

Exact same syntax as express, use for example the express cookie middleware like this:

    'use strict';

    require('larvitbase')({
    	'middleware': [
    		require('cookies').express()
    	]
    });

### Afterware

Afterware is ran just before the response is sent to the client. After the controller callback ran.

The syntax is exactly the same as Middlewares:

    'use strict';

    require('larvitbase')({
    	'middleware': [
    		require('cookies').express(),
    		require('larvitsession').middleware()
    	],
    	'afterware': [
    		require('larvitsession').afterware()
    	]
    });

### Session data sent from previous call to controller JSON

If request.session.data.nextCallData is set, it will be:

1. Merged into controller data output on the next call, with low priority
2. Erased from the session data, so it won't show up on the call after next

The reason for the data structure is to harmonize with the larvitsession module, if it is loaded.
