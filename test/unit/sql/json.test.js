'use strict';

const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const expect = require('chai').expect;
const expectsql = Support.expectsql;
const Sequelize = Support.Sequelize;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
if (current.dialect.supports.JSON) {
  describe(Support.getTestDialectTeaser('SQL'), () => {
    describe('JSON', () => {
      describe('escape', () => {
        it('plain string', () => {
          expectsql(sql.escape('string', { type: new DataTypes.JSON() }), {
            default: '\'"string"\'',
            mysql: '\'\\"string\\"\'',
            mssql: 'N\'"string"\''
          });
        });

        it('plain int', () => {
          expectsql(sql.escape(0, { type: new DataTypes.JSON() }), {
            default: '\'0\'',
            mssql: 'N\'0\'',
          });
          expectsql(sql.escape(123, { type: new DataTypes.JSON() }), {
            default: '\'123\'',
            mssql: 'N\'123\''
          });
        });

        it('boolean', () => {
          expectsql(sql.escape(true, { type: new DataTypes.JSON() }), {
            default: '\'true\'',
            mssql: 'N\'true\''
          });
          expectsql(sql.escape(false, { type: new DataTypes.JSON() }), {
            default: '\'false\'',
            mssql: 'N\'false\''
          });
        });

        it('NULL', () => {
          expectsql(sql.escape(null, { type: new DataTypes.JSON() }), {
            default: 'NULL'
          });
        });

        it('nested object', () => {
          expectsql(sql.escape({ some: 'nested', more: { nested: true }, answer: 42 }, { type: new DataTypes.JSON() }), {
            default: '\'{"some":"nested","more":{"nested":true},"answer":42}\'',
            mysql: '\'{\\"some\\":\\"nested\\",\\"more\\":{\\"nested\\":true},\\"answer\\":42}\'',
            mssql: 'N\'{"some":"nested","more":{"nested":true},"answer":42}\'',
          });
        });

        if (current.dialect.supports.ARRAY) {
          it('array of JSON', () => {
            expectsql(sql.escape([
              { some: 'nested', more: { nested: true }, answer: 42 },
              43,
              'joe'
            ], { type: DataTypes.ARRAY(DataTypes.JSON) }), {
              postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSON[]'
            });
          });

          if (current.dialect.supports.JSONB) {
            it('array of JSONB', () => {
              expectsql(sql.escape([
                { some: 'nested', more: { nested: true }, answer: 42 },
                43,
                'joe'
              ], { type: DataTypes.ARRAY(DataTypes.JSONB) }), {
                postgres: 'ARRAY[\'{"some":"nested","more":{"nested":true},"answer":42}\',\'43\',\'"joe"\']::JSONB[]'
              });
            });
          }
        }
      });

      describe('path extraction', () => {
        it('condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ id: 1 })), {
            postgres: '("id"#>>\'{}\') = \'1\'',
            sqlite: "json_extract(`id`, '$') = '1'",
            oracle: "JSON_VALUE(id, '$.') = '1'",
            // TODO AG, vérifier que le "." est ok
            mssql: "JSON_VALUE([id], '$.') = '1'",
            mysql: "`id`->>'$.' = '1'"
          });
        });

        it('nested condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ profile: { id: 1 } })), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`, '$.id') = '1'",
            mssql: "JSON_VALUE([profile], '$.id') = '1'",
            oracle: "JSON_VALUE(\"profile\", '$.id') = '1'",
            mysql: "`profile`->>'$.id' = '1'"
          });
        });

        it('multiple condition object', () => {
          expectsql(sql.whereItemQuery(undefined, Sequelize.json({ property: { value: 1 }, another: { value: 'string' } })), {
            postgres: '("property"#>>\'{value}\') = \'1\' AND ("another"#>>\'{value}\') = \'string\'',
            sqlite: "json_extract(`property`, '$.value') = '1' AND json_extract(`another`, '$.value') = 'string'",
            mysql: "`property`->>'$.value' = '1' and `another`->>'$.value' = 'string'",
            oracle: "JSON_VALUE(property, '$.value') = '1' and JSON_VALUE(another, '$.value') = 'string'",
            mssql: "JSON_VALUE([property], '$.value') = '1' and JSON_VALUE([another], '$.value') = 'string'"
          });
        });

        it('dot notation', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('profile.id'), '1'), {
            postgres: '("profile"#>>\'{id}\') = \'1\'',
            sqlite: "json_extract(`profile`, '$.id') = '1'",
            mysql: "`profile`->>'$.id' = '1'",
            oracle: "JSON_VALUE(\"profile\", '$.id') = '1'",
            mssql: "JSON_VALUE([profile], '$.id') = N'1'"
          });
        });

        it('column named "json"', () => {
          expectsql(sql.whereItemQuery(Sequelize.json('json'), '{}'), {
            postgres: '("json"#>>\'{}\') = \'{}\'',
            sqlite: "json_extract(`json`, '$') = '{}'",
            mysql: "`json`->>'$.' = '{}'",
            oracle: "JSON_VALUE(json, '$.') = '{}'",
            // TODO AG Vérifier le $.
            mssql: "JSON_VALUE([json], '$.') = N'{}'"
          });
        });
      });

      describe('raw json query', () => {
        if (current.dialect.name === 'postgres') {
          it('#>> operator', () => {
            expectsql(sql.whereItemQuery(Sequelize.json('("data"#>>\'{id}\')'), 'id'), {
              postgres: '("data"#>>\'{id}\') = \'id\''
            });
          });
        }

        it('json function', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"profile":{"name":"david"}}\')')), {
            default: 'json(\'{"profile":{"name":"david"}}\')'
          });
        });

        it('nested json functions', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json_extract(json_object(\'{"profile":null}\'), "profile")')), {
            default: 'json_extract(json_object(\'{"profile":null}\'), "profile")'
          });
        });

        it('escaped string argument', () => {
          expectsql(sql.handleSequelizeMethod(Sequelize.json('json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')')), {
            default: 'json(\'{"quote":{"single":"\'\'","double":""""},"parenthesis":"())("}\')'
          });
        });

        it('unbalnced statement', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json())'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json_extract(json()'))).to.throw();
        });

        it('separator injection', () => {
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(; DELETE YOLO INJECTIONS; -- )'))).to.throw();
          expect(() => sql.handleSequelizeMethod(Sequelize.json('json(); DELETE YOLO INJECTIONS; -- '))).to.throw();
        });
      });
    });
  });
}