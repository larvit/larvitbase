'use strict';

exports.run = function(req, res, cb) {
	cb(null, req, res, {'content': 'bar'});
};