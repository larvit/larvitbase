# larvitbase

Node.js micro framework

### Installation

    npm i larvitbase

### Usage

In your application root directory, create a file named server.js with the following content:

    'use strict';

    // Given config parameters is the default, all can be omitted
    require('larvitbase')({
    	'host':        '127.0.0.1',
    	'port':        8001,
    	'pubFilePath': './public',
    	'customRoutes': [{
    		'regex': '^/$', // Regexp to be matched for the given URL
    		'controllerName': 'default' // Name of the file in ./controllers/<filename>.js
    	}]
    });

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

### Views

A view is used to match the data from the controller with one or more templates. Views are by default positioned in ./public/views/_controllerName_.js and a typical default file can look like this:

    'use strict';

    var larvitviews = require('larvitviews')();

    exports.run = function(data, callback) {
    	var partials;

    	partials = [
    		{
    			'partName': 'aboveBody',
    			'tmplPath': 'head',
    			'data': data.head
    		},
    		{
    			'tmplPath': 'default',
    			'data': data
    		}
    	];

    	data.tmplParts = {}; // This will contain the different template parts
    	                     // that will be stitched together for a complete page

    	larvitviews.renderPartials(partials, data, function(err, returnStr) {
    		callback(err, returnStr);
    	});
    };

### Templates

Larvitbase use [underscore templates](http://underscorejs.org/#template). They are fed with the data sent in the callback from the controller.

The templates resides in ./public/views/tmpl/_controllerName_.tmpl - for example ./public/viewstmpl/default.tmpl to match the above "/" route.

An example template can look like:

    <!DOCTYPE html>
    <html lang="en">
    	<%= tmplParts['aboveBody'] %>
    	<body>
    		<h1>Look at our beautiful data below</h1>
    		<p><%= foo %></p>
    	</body>
    </html>

The example head section, ./public/views/tmpl/head.tmpl, can look like this:

    <head>
    	<meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
    	<title><%= title %></title>
    </head>

### Check that it works

    $ node ./server.js
