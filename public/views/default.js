'use strict';

var larvitviews = require('larvitviews')();

exports.run = function(data, callback) {
	var structure;

	structure = [{
		'tmplPath': 'default'
	}];

	data.tmplParts = {};

	larvitviews.renderPartials(structure, data, callback);
};