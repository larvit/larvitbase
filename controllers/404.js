'use strict';

exports.run = function(request, response, callback) {
	var data = {
		'message': 'not found'
	};

	response.statusCode = 404;

	callback(null, request, response, data);
};