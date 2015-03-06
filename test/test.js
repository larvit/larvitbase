'use strict';

var assert     = require('assert'),
    httpMocks  = require('node-mocks-http'),
    larvitbase = require('larvitbase')({});

describe('Basics', function() {
		var mockReq;

	mockReq = httpMocks.createRequest({
		'method': 'POST',
		'headers': {'content-type': 'application/x-www-form-urlencoded'}
	});

	it('should test formidableParseable', function(done) {
		var parseable;

		parseable = larvitbase.formidableParseable(mockReq);

		assert(parseable === true, 'Should be parseable');
		done();
	});
});