'use strict';

const _ = require('lodash');
const Promise = require('../../promise');
const UnknownConstraintError = require('../../errors').UnknownConstraintError;

/**
 Returns an object that treats SQLite's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

/**
  A wrapper that fixes SQLite's inability to remove columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but without the obsolete column.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function removeColumn(tableName, attributeName, options) {
  options = options || {};

  return this.describeTable(tableName, options).then(fields => {
    delete fields[attributeName];

    const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
    return this.sequelize.query(describeCreateTableSql, options)
      .then(describeTable => {
        
      const createSql = describeTable && describeTable.length > 0 ? describeTable[0].sql : null;
      let sql = this.QueryGenerator.removeColumnQuery(tableName, fields, createSql);
      // we pick up the indexes set to put them back after the table is recreated
      return this.addIndexesQuery(tableName, options, attributeName).then( indexesQuery => {

        sql += indexesQuery
        const subQueries = sql.split(';').filter(q => q !== '');

        return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', _.assign({raw: true}, options)));
      });
    });
  });
}
exports.removeColumn = removeColumn;

/**
  A wrapper that fixes SQLite's inability to change columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a modified version of the respective column.

  @method changeColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {Object} attributes An object with the attribute's name as key and its options as value object.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function changeColumn(tableName, attributes, options) {
  const attributeName = Object.keys(attributes)[0];
  options = options || {};

  return this.describeTable(tableName, options).then(fields => {
    fields[attributeName] = attributes[attributeName];

    const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
    return this.sequelize.query(describeCreateTableSql, options)
      .then(describeTable => {

      const createSql = describeTable && describeTable.length > 0 ? describeTable[0].sql : null;
      let sql = this.QueryGenerator.removeColumnQuery(tableName, fields, createSql);
      return this.addIndexesQuery(tableName, options).then( indexesQuery => {

        sql += indexesQuery
        const subQueries = sql.split(';').filter(q => q !== '');

        return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', _.assign({raw: true}, options)));
      });
    });
  });
}
exports.changeColumn = changeColumn;


function addIndexesQuery(tableName, options, attributeToIgnore) {
  return this.showIndex(tableName, options).then(indexes => {
    let indexesQuery = ''
    indexes.forEach( index => {
      //sqlite automatically adds 'sqlite_autoindex_XXXX' we can't add it ourself
      if (!index.name.startsWith('sqlite_autoindex')) { 
          const idxOptions = {
            name : index.name,
            fields : index.fields.filter(field => field.attribute != attributeToIgnore ).map(field => field.attribute),
            unique : index.unique
          } 
          indexesQuery+= this.QueryGenerator.addIndexQuery(tableName, idxOptions, tableName) + ';';
        }
    }); 
    return indexesQuery;
  }); 
} 
exports.addIndexesQuery = addIndexesQuery;

/**
  A wrapper that fixes SQLite's inability to rename columns from existing tables.
  It will create a backup of the table, drop the table afterwards and create a
  new table with the same name but with a renamed version of the respective column.

  @method renameColumn
  @for    QueryInterface

  @param  {String} tableName The name of the table.
  @param  {String} attrNameBefore The name of the attribute before it was renamed.
  @param  {String} attrNameAfter The name of the attribute after it was renamed.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries

  @since 1.6.0
  @private
 */
function renameColumn(tableName, attrNameBefore, attrNameAfter, options) {
  options = options || {};

  return this.describeTable(tableName, options).then(fields => {
    fields[attrNameAfter] = _.clone(fields[attrNameBefore]);
    delete fields[attrNameBefore];

    const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
    return this.sequelize.query(describeCreateTableSql, options)
      .then(describeTable => {

      const createSql = describeTable && describeTable.length > 0 ? describeTable[0].sql : null;

      let sql = this.QueryGenerator.renameColumnQuery(tableName, attrNameBefore, attrNameAfter, fields, createSql);
      return this.addIndexesQuery(tableName, options).then( indexesQuery => {

        sql += indexesQuery
        const subQueries = sql.split(';').filter(q => q !== '');

        return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', _.assign({raw: true}, options)));
      });
    });
  });
}
exports.renameColumn = renameColumn;

function removeConstraint(tableName, constraintName, options) {
  let createTableSql;

  return this.showConstraint(tableName, constraintName, options)
    .then(constraints => {
      const constraint = constraints[0];

      if (constraint) {
        createTableSql = constraint.sql;
        constraint.constraintName = this.QueryGenerator.quoteIdentifier(constraint.constraintName);
        let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.constraintCondition}`;

        if (constraint.constraintType === 'FOREIGN KEY') {
          const referenceTableName = this.QueryGenerator.quoteTable(constraint.referenceTableName);
          constraint.referenceTableKeys = constraint.referenceTableKeys.map(columnName => this.QueryGenerator.quoteIdentifier(columnName));
          const referenceTableKeys = constraint.referenceTableKeys.join(', ');
          constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableKeys})`;
          if (constraint.updateAction) {
            constraintSnippet += ` ON UPDATE ${constraint.updateAction}`;
          } 
          if (constraint.deleteAction){
            constraintSnippet += ` ON DELETE ${constraint.deleteAction}`;
          } 
        }

        createTableSql = createTableSql.replace(constraintSnippet, '');
        createTableSql += ';';

        return this.describeTable(tableName, options);
      } else {
        throw new UnknownConstraintError(`Constraint ${constraintName} on table ${tableName} does not exist`);
      }
    })
    .then(fields => {
      let sql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      // we pick up the indexes set to put them back after the table is recreated
      return this.addIndexesQuery(tableName, options).then( indexesQuery => {

        sql += indexesQuery
        const subQueries = sql.split(';').filter(q => q !== '');

        return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', _.assign({raw: true}, options)));
      });
    });
}
exports.removeConstraint = removeConstraint;

function addConstraint(tableName, options) {
  const constraintSnippet = this.QueryGenerator.getConstraintSnippet(tableName, options);
  const describeCreateTableSql = this.QueryGenerator.describeCreateTableQuery(tableName);
  let createTableSql;

  return this.sequelize.query(describeCreateTableSql, options)
    .then(constraints => {
      const sql = constraints[0].sql;
      const index = sql.length - 1;
      //Replace ending ')' with constraint snippet - Simulates String.replaceAt
      //http://stackoverflow.com/questions/1431094
      createTableSql = sql.substr(0, index) +  `, ${constraintSnippet})` + sql.substr(index + 1) + ';';

      return this.describeTable(tableName, options);
    })
    .then(fields => {
      let sql = this.QueryGenerator._alterConstraintQuery(tableName, fields, createTableSql);
      // we pick up the indexes set to put them back after the table is recreated
      return this.addIndexesQuery(tableName, options).then( indexesQuery => {

        sql += indexesQuery
        const subQueries = sql.split(';').filter(q => q !== '');

        return Promise.each(subQueries, subQuery => this.sequelize.query(subQuery + ';', _.assign({raw: true}, options)));
      });
    });
}
exports.addConstraint = addConstraint;

/**
 *
 * @param {String} tableName
 * @param {Object} options  Query Options
 * @returns {Promise}
 */
function getForeignKeyReferencesForTable(tableName, options) {
  const database = this.sequelize.config.database;
  const query = this.QueryGenerator.getForeignKeysQuery(tableName, database);
  return this.sequelize.query(query, options)
    .then(result => {
      return result.map(row => ({
        tableName,
        columnName: row.from,
        referencedTableName: row.table,
        referencedColumnName: row.to,
        tableCatalog: database,
        referencedTableCatalog: database
      }));
    });
}

exports.getForeignKeyReferencesForTable = getForeignKeyReferencesForTable;
