'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const ResourceLock = require('./resource-lock');
const Promise = require('../../promise');
const Utils = require('../../utils');
const dataTypes = require('../../data-types').mssql;
const debug = Utils.getLogger().debugContext('connection:mssql');
const debugTedious = Utils.getLogger().debugContext('connection:mssql:tedious');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('mssql');
const _ = require('lodash');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 1433;
    try {
      if (sequelize.config.dialectModulePath) {
        this.lib = require(sequelize.config.dialectModulePath);
      } else {
        this.lib = require('tedious');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install tedious package manually');
      }
      throw err;
    }
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  connect(config) {
    return new Promise((resolve, reject) => {
      const connectionConfig = {
        server: config.host,
        authentication:{
          type: 'default',
          options: {
            userName: config.username,
            password: config.password,
          } 
        },
        options: {
          port: parseInt(config.port, 10),
          database: config.database
        }
      };

      if (config.dialectOptions) {
        // only set port if no instance name was provided
        if (config.dialectOptions.instanceName) {
          delete connectionConfig.options.port;
        }

        // The 'tedious' driver needs domain property to be in the main Connection config object
        if (config.dialectOptions.domain) {
          connectionConfig.domain = config.dialectOptions.domain;
        }

         // The 'tedious' driver needs domain property to be in the main Connection config object
         config.dialectOptions.trustServerCertificate = config.dialectOptions.trustServerCertificate || true; 
          /**
           * tedious deprecated The default value for "config.options.validateBulkLoadParameters" will change from `false` to `true` in the next major version
           *  of `tedious`. Set the value to `true` or `false` explicitly to silence this message.
           * at node_modules/sequelize/lib/dialects/mssql/connection-manager.js:76:26
           */
         config.dialectOptions.validateBulkLoadParameters = config.dialectOptions.validateBulkLoadParameters || false;

        for (const key of Object.keys(config.dialectOptions)) {
          connectionConfig.options[key] = config.dialectOptions[key];
        }
      }

      const connection = new this.lib.Connection(connectionConfig);
      if (connection.state === connection.STATE.INITIALIZED) {
        connection.connect();
      }
      const connectionLock = new ResourceLock(connection);
      connection.lib = this.lib;

      connection.on('connect', err => {
        if (!err) {
          debug('connection acquired');
          resolve(connectionLock);
          return;
        }

        if (!err.code) {
          reject(new sequelizeErrors.ConnectionError(err));
          return;
        }

        switch (err.code) {
          case 'ESOCKET':
            if (_.includes(err.message, 'connect EHOSTUNREACH')) {
              reject(new sequelizeErrors.HostNotReachableError(err));
            } else if (_.includes(err.message, 'connect ENETUNREACH')) {
              reject(new sequelizeErrors.HostNotReachableError(err));
            } else if (_.includes(err.message, 'connect EADDRNOTAVAIL')) {
              reject(new sequelizeErrors.HostNotReachableError(err));
            } else if (_.includes(err.message, 'getaddrinfo ENOTFOUND')) {
              reject(new sequelizeErrors.HostNotFoundError(err));
            } else if (_.includes(err.message, 'connect ECONNREFUSED') || _.includes(err.message, 'Could not connect')) {
              reject(new sequelizeErrors.ConnectionRefusedError(err));
            } else {
              reject(new sequelizeErrors.ConnectionError(err));
            }
            break;
          case 'ER_ACCESS_DENIED_ERROR':
          case 'ELOGIN':
            reject(new sequelizeErrors.AccessDeniedError(err));
            break;
          case 'EINVAL':
            reject(new sequelizeErrors.InvalidConnectionError(err));
            break;
          default:
            reject(new sequelizeErrors.ConnectionError(err));
            break;
        }
      });

      if (config.dialectOptions && config.dialectOptions.debug) {
        connection.on('debug', debugTedious);
      }

      if (config.pool.handleDisconnects) {
        connection.on('error', err => {
          switch (err.code) {
            case 'ESOCKET':
            case 'ECONNRESET':
              this.pool.destroy(connectionLock)
                .catch(/Resource not currently part of this pool/, () => {});
          }
        });
      }

    });
  }

  disconnect(connectionLock) {
    const connection = connectionLock.unwrap();

    // Dont disconnect a connection that is already disconnected
    if (connection.closed) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      connection.on('end', resolve);
      connection.close();
      debug('connection closed');
    });
  }

  validate(connectionLock) {
    if (connectionLock && 'unwrap' in connectionLock) {
      const connection = connectionLock.unwrap();
      return connection && connection.loggedIn;
    } else {
      return false;
    }
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
