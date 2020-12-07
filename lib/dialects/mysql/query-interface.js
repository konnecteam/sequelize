'use strict';

/**
 Returns an object that treats MySQL's inabilities to do certain queries.

 @class QueryInterface
 @static
 @private
 */

const _ = require('lodash');
const UnknownConstraintError = require('../../errors').UnknownConstraintError;

/**
  A wrapper that fixes MySQL's inability to cleanly remove columns from existing tables if they have a foreign key constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} columnName    The name of the attribute that we want to remove.
  @param  {Object} options
 @private
 */
function removeColumn(tableName, columnName, options) {
  options = options || {};

  return this.sequelize.query(
    this.QueryGenerator.getForeignKeyQuery(tableName.tableName ? tableName : {
      tableName,
      schema: this.sequelize.config.database
    }, columnName),
    _.assign({ raw: true }, options)
  )
    .spread(results => {
      //Exclude primary key constraint
      if (!results.length || results[0].constraint_name === 'PRIMARY') {
        // No foreign key constraints found, so we can remove the column
        return;
      }
      return this.sequelize.Promise.map(results, constraint => this.sequelize.query(
        this.QueryGenerator.dropForeignKeyQuery(tableName, constraint.constraint_name),
        _.assign({ raw: true }, options)
      ));
    })
    .then(() => this.sequelize.query(
      this.QueryGenerator.removeColumnQuery(tableName, columnName),
      _.assign({ raw: true }, options)
    ));
}


function removeConstraint(tableName, constraintName, options) {
  const sql = this.QueryGenerator.showConstraintsQuery(tableName.tableName ? tableName : {
    tableName,
    schema: this.sequelize.config.database
  }, constraintName);

  return this.sequelize.query(sql, Object.assign({}, options, { type: this.sequelize.QueryTypes.SHOWCONSTRAINTS }))
    .then(constraints => {
      const constraint = constraints[0];
      let query;
      if (constraint && constraint.constraintType) {
        if (constraint.constraintType === 'FOREIGN KEY') {
          query = this.QueryGenerator.dropForeignKeyQuery(tableName, constraintName);
        } else {
          query = this.QueryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName);
        }
      } else {
        throw new UnknownConstraintError(`Constraint ${constraintName} on table ${tableName} does not exist`);
      }

      return this.sequelize.query(query, options).then(res => {
        //if it's an FK we have to check if the automatically created index was drop, if not we do it manually
        if (constraint.constraintType === 'FOREIGN KEY') {
          return this.showIndex(constraint.tableName, options).then((indexes) => {
            if (indexes.map(index => { return index.name}).indexOf(constraint.constraintName) > -1) { 
              return this.sequelize.query(this.QueryGenerator.removeIndexQuery(constraint.tableName, constraint.constraintName), options) 
            } else {
              return res;
            }
          });
        } else {
          return res;
        } 
      });
    });
}

exports.removeConstraint = removeConstraint;
exports.removeColumn = removeColumn;
