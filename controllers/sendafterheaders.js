'use strict';

exports.run = function (req, res, cb) {
	res.end('something');
	cb(null, req, res, {});
};
