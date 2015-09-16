'use strict';

exports.run = function(request, response, callback) {
	var data = {
		'_global': {
			'warthog': false
		},
		'head': {
			'title': 'foobar'
		},
		'foo': 'bar'
	};

	callback(null, request, response, data);
};