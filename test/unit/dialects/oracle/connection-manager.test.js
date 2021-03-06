'use strict';

const chai = require('chai');
const expect = chai.expect;
const Sequelize = require(__dirname + '/../../../../index');
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();

//TODO voir sur le build pourquoi il passe pas (uncaughtException)
describe.skip('[ORACLE] Connection Manager', () => {

  let instance, config;

  if (dialect === 'oracle') {
    it('full database, should connect to Oracle', done => {
      //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
      config = {
        dialect: 'oracle',
        host: process.env.NODE_ORACLEDB_HOST,
        database:`${process.env.NODE_ORACLEDB_HOST}:${process.env.NODE_ORACLEDB_PORT}/${process.env.NODE_ORACLEDB_CONNECTIONSTRING}`,
        username: process.env.NODE_ORACLEDB_USER,
        password: process.env.NODE_ORACLEDB_PASSWORD
      };
      instance = new Sequelize(config.database, config.username, config.password, config);

      instance.dialect.connectionManager.connect(config)
        .then(result => {
          expect(instance.getDialect()).to.equal('oracle');
          instance.dialect.connectionManager.disconnect(result)
            .then(() => {
              done();
            });
        })
        .catch(error => {
          done(error);
        });
    });

    it('database with only service_name, should connect to Oracle', done => {
      //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
      config = {
        dialect: 'oracle',
        host: process.env.NODE_ORACLEDB_HOST,
        username: process.env.NODE_ORACLEDB_USER,
        password: process.env.NODE_ORACLEDB_PASSWORD,
        database: process.env.NODE_ORACLEDB_CONNECTIONSTRING
      };
      instance = new Sequelize(config.database, config.username, config.password, config);

      instance.dialect.connectionManager.connect(config)
        .then(result => {
          expect(instance.getDialect()).to.equal('oracle');
          instance.dialect.connectionManager.disconnect(result)
            .then(() => {
              done();
            });
        })
        .catch(error => {
          done(error);
        });
    });

    it('database with only service_name no host, should fail', done => {
      //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
      config = {
        dialect: 'oracle',
        host: '',
        username: 'sequelize',
        password: 'sequelize',
        database: 'xe.oracle.docker'
      };
      instance = new Sequelize(config.database, config.username, config.password, config);

      instance.dialect.connectionManager.connect(config)
        .then(result => {
          done('You shall not pass');
          expect(instance.getDialect()).to.equal('oracle');
          instance.dialect.connectionManager.disconnect(result)
            .then(() => {
              done('You shall not pass');
            });
        })
        .catch(err => {
          expect(err.message).to.equal('You have to specify the host');
          done();
        });
    });

    it('database empty, should fail', done => {
      //  expect(config.dialectOptions.domain).to.equal('TEST.COM');
      config = {
        dialect: 'oracle',
        host: 'localhost',
        username: 'sequelize',
        password: 'sequelize',
        database: ''
      };
      instance = new Sequelize(config.database, config.username, config.password, config);
      instance.dialect.connectionManager.connect(config)
        .then(() => {
          done('You shall not pass');
          expect(instance.getDialect()).to.equal('oracle');
          instance.dialect.connectionManager.disconnect(null).then(() => {
            done('You shall not pass');
          });
        })
        .catch(err => {
          expect(err.message.indexOf('The database cannot be blank, you must specify the database name')).to.equal(0);
          done();
        });
    });
  }
});
