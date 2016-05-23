'use strict';

exports.run = function(req, res, cb) {
	const data = {
		'_global': {
			'warthog': false
		},
		'head': {
			'title': 'foobar'
		},
		'foo': 'bar'
	};

	cb(null, req, res, data);
};