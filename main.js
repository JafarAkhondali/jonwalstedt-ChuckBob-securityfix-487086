/*global window, document */
/*global require */

'use strict';

var chuckbob = require('./script/chuckbob'),
    $ = require('jquery');

$.noConflict();
chuckbob.integrationApi.setJQuery($);

if (window.afterChuckbob) {
  window.afterChuckbob(chuckbob);
};


