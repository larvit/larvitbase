# larvitbase

Node.js micro framework

### Installation

    npm i larvitbase

### Usage

In your application root directory, create a file named server.js with the following content:

    'use strict';

    var larvitbase = require('larvitbase');

You also need to do the configuration below before you have a working system

### Configuration

Two configuration files are required:

* ./config/server.json
* ./config/router.json

#### server.json

Example:

    {
    	"port":        8001,
    	"pubFilePath": "./public"
    }

This will set up the server on port 8001 and server static files from ./public

#### routes.json

Example:

    [
    	{
    		"regex":          "^/$",
    		"controllerName": "default"
    	},
    	{
    		"regex":          "^/mupp$",
    		"controllerName": "mupp"
    	}
    ]

The first will match exactly "/" and will load up the controller at ./controllers/default.js
The second will match exactly "/mupp" and will load up the controller at ./controllers/mupp.js

### Controllers

A controller needs to fill a few criterias.

It must reside in ./controller/<controllerName>.js - for example ./controller/default.js to match the above "/" route.

It need to have the following structure:

    'use strict';

    exports.run = function(request, response, callback) {

    	// This is the data we send back to the callback
    	// It can be calls to other subcontrollers, database calls etc
    	var data = {'foo': 'bar'};

    	callback(null, request, response, data);
    }

### Templates

Larvitbase use [underscore templates](http://underscorejs.org/#template). They are fed with the data sent in the callback from the controller.

The templates resides in ./public/tmpl/<controllerName>.tmpl - for example ./public/tmpl/default.tmpl to match the above "/" route.

An example template can look like:

    <!DOCTYPE html>
    <html lang="en">
    	<head>
    		<meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    		<title>larvit.se</title>
    	</head>
    	<body>
    		<h1>Look at our beautiful data below</h1>
    		<p><%= foo %></p>
    	</body>
    </html>