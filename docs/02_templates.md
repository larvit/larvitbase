# Templating

There is no preference on templating engines for larvitbase. As long as it can be incorporated as a middleware, it can run under this module. We will show an example here with [EJS](http://ejs.co/).

## Install dependencies

```bash
npm i ejs
```

## Files

### Router: router.js

```javascript
'use strict';

// Routing
// Translate an url into a path to a controllers
exports = module.exports = function router(req, res, cb) {
	if (req.url === '/') {
		req.templateFullPath	= __dirname + '/public/templates/default.ejs';
		req.
	} else if (req.url === '/foo') {
		req.controllerFullPath	= __dirname + '/controllers/foo.js';
		req.templateFullPath	= __dirname + '/public/templates/subpage.ejs';
	} else {
		req.controllerFullPath	= __dirname + '/controllers/404.js';
		req.templateFullPath	= __dirname + '/public/templates/404.ejs';
	}
	cb();
}
```
