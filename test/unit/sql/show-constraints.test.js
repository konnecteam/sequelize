'use strict';

const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('showConstraint', () => {
    it('naming', () => {
      expectsql(sql.showConstraintsQuery('myTable'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: 'SELECT tc.constraint_catalog AS "constraintCatalog", tc.constraint_schema AS "constraintSchema", tc.constraint_name AS "constraintName", tc.table_catalog AS "tableCatalog", tc.table_schema AS "tableSchema", tc.table_name AS "tableName", tc.constraint_type AS "constraintType", tc.is_deferrable AS "isDeferrable", tc.initially_deferred AS "initiallyDeferred", kcu.column_name AS "columnName" from INFORMATION_SCHEMA.table_constraints as "tc" join INFORMATION_SCHEMA.key_column_usage as "kcu" on (tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name) WHERE tc.table_name=\'myTable\';',
        mysql: "SELECT tc.CONSTRAINT_CATALOG AS constraintCatalog, tc.CONSTRAINT_NAME AS constraintName, tc.CONSTRAINT_SCHEMA AS constraintSchema, tc.CONSTRAINT_TYPE AS constraintType, tc.TABLE_NAME AS tableName, tc.TABLE_SCHEMA AS tableSchema, kcu.column_name AS columnName from INFORMATION_SCHEMA.TABLE_CONSTRAINTS as tc join INFORMATION_SCHEMA.key_column_usage as kcu on (tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name) WHERE tc.table_name='myTable';",
        oracle: 'SELECT constraint_name constraintName, constraint_type constraintType , column_name columnName from user_constraints natural join user_cons_columns where table_name = \'MYTABLE\'',
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable';"
      });
    });

    it('should add constraint_name to where clause if passed in case of mysql', () => {
      expectsql(sql.showConstraintsQuery('myTable', 'myConstraintName'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: 'SELECT tc.constraint_catalog AS "constraintCatalog", tc.constraint_schema AS "constraintSchema", tc.constraint_name AS "constraintName", tc.table_catalog AS "tableCatalog", tc.table_schema AS "tableSchema", tc.table_name AS "tableName", tc.constraint_type AS "constraintType", tc.is_deferrable AS "isDeferrable", tc.initially_deferred AS "initiallyDeferred", kcu.column_name AS "columnName" from INFORMATION_SCHEMA.table_constraints as "tc" join INFORMATION_SCHEMA.key_column_usage as "kcu" on (tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name) WHERE tc.table_name=\'myTable\';',
        mysql: "SELECT tc.CONSTRAINT_CATALOG AS constraintCatalog, tc.CONSTRAINT_NAME AS constraintName, tc.CONSTRAINT_SCHEMA AS constraintSchema, tc.CONSTRAINT_TYPE AS constraintType, tc.TABLE_NAME AS tableName, tc.TABLE_SCHEMA AS tableSchema, kcu.column_name AS columnName from INFORMATION_SCHEMA.TABLE_CONSTRAINTS as tc join INFORMATION_SCHEMA.key_column_usage as kcu on (tc.constraint_name = kcu.constraint_name and tc.table_name = kcu.table_name) WHERE tc.table_name='myTable' AND tc.constraint_name = 'myConstraintName';",
        oracle: 'SELECT constraint_name constraintName, constraint_type constraintType , column_name columnName from user_constraints natural join user_cons_columns where table_name = \'MYTABLE\'',
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable' AND sql LIKE '%myConstraintName%';"
      });
    });
  });
});
