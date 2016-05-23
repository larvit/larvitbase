'use strict';

exports.run = function(req, res, cb) {
	const data = {'pjong': 'peng'};

	cb(null, req, res, data);
};