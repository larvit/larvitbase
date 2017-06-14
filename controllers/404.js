'use strict';

exports.run = function (req, res, cb) {
	const data = {
		'message': 'not found'
	};

	res.statusCode = 404;

	cb(null, req, res, data);
};
