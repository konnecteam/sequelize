'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

import * as depd from 'depd';
import * as debug from 'debug';
import * as _ from 'lodash';

export class Logger {
  config;
  depd;
  constructor(config) {

    this.config = _.extend({
      context: 'sequelize',
      debug: true
    }, config || {});

    this.depd = depd(this.config.context);
    this.debug = debug(this.config.context);
  }

  deprecate(message) {
    this.depd(message);
  }

  debug(message) {
    this.config.debug && this.debug(message);
  }

  warn(message) {
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext(childContext) {
    if (!childContext) {
      throw new Error('No context supplied to debug');
    }
    return debug([this.config.context, childContext].join(':'));
  }
}
