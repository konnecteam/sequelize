'use strict';

const _ = require('lodash');
const wkx = require('wkx');
const inherits = require('../../utils/inherits');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://www.postgresql.org/docs/9.4/static/datatype.html');

  /**
   * types:
   * {
   *   oids: [oid],
   *   array_oids: [oid]
   * }
   * @see oid here https://github.com/lib/pq/blob/master/oid/types.go
   */

  BaseTypes.UUID.types.postgres = ['uuid'];

  BaseTypes.JSON.types.postgres = ['json'];

  BaseTypes.JSONB.types.postgres = ['jsonb'];

  BaseTypes.TIME.types.postgres = ['time'];

  function DATEONLY() {
    if (!(this instanceof DATEONLY)) return new DATEONLY();
    BaseTypes.DATEONLY.apply(this, arguments);
  }
  inherits(DATEONLY, BaseTypes.DATEONLY);

  DATEONLY.parse = function parse(value) {
    if (value === 'infinity') {
      value = Infinity;
    } else if (value === '-infinity') {
      value = -Infinity;
    }

    return value;
  };

  DATEONLY.prototype._stringify = function _stringify(value, options) {
    if (value === Infinity) {
      return 'Infinity';
    } else if (value === -Infinity) {
      return '-Infinity';
    }

    return BaseTypes.DATEONLY.prototype._stringify.call(this, value, options);
  };

  DATEONLY.prototype._sanitize = function _sanitize(value, options) {
    if ((!options || options && !options.raw) && value !== Infinity && value !== -Infinity) {
      if (_.isString(value)) {
        if (_.toLower(value) === 'infinity') {
          return Infinity;
        } else if (_.toLower(value) === '-infinity') {
          return -Infinity;
        }
      }

      return BaseTypes.DATEONLY.prototype._sanitize.call(this, value);
    }

    return value;
  };

  BaseTypes.DATEONLY.types.postgres = ['date'];

  function DECIMAL(precision, scale) {
    if (!(this instanceof DECIMAL)) return new DECIMAL(precision, scale);
    BaseTypes.DECIMAL.apply(this, arguments);
  }
  inherits(DECIMAL, BaseTypes.DECIMAL);

  DECIMAL.parse = function parse(value) {
    return value;
  };

  // numeric
  BaseTypes.DECIMAL.types.postgres = ['numeric'];

  function STRING(length, binary) {
    if (!(this instanceof STRING)) return new STRING(length, binary);
    BaseTypes.STRING.apply(this, arguments);
  }
  inherits(STRING, BaseTypes.STRING);

  function JSONTYPE() {
    if (!(this instanceof JSONTYPE)) return new JSONTYPE();
    BaseTypes.JSON.apply(this, arguments);
  }
  inherits(JSONTYPE, BaseTypes.JSON);


  JSONTYPE.prototype._stringify = function _stringify(value, options) {
    return options.operation === 'where' && typeof value === 'string' ? value : JSON.stringify(value);
  };

  /** "parse" data in set */
  JSONTYPE.prototype.parseInSet = function(data) {
    if (data && typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (error) {
        //erreur lors du parse, soit JSON malformé soit une string => pas besoin de parse on l'a renvoie direct
        return data;
      }
     
    } else {
      return data;
    }
  }

  BaseTypes.JSON.types.postgres = ['json'];

  STRING.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.STRING.prototype.toSql.call(this);
  };

  BaseTypes.STRING.types.postgres = ['varchar'];

  function TEXT(length) {
    if (!(this instanceof TEXT)) return new TEXT(length);
    BaseTypes.TEXT.apply(this, arguments);
  }
  inherits(TEXT, BaseTypes.TEXT);

  TEXT.prototype.toSql = function toSql() {
    if (this._length) {
      warn('PostgreSQL does not support TEXT with options. Plain `TEXT` will be used instead.');
      this._length = undefined;
    }
    return 'TEXT';
  };

  BaseTypes.TEXT.types.postgres = ['text'];

  function CHAR(length, binary) {
    if (!(this instanceof CHAR)) return new CHAR(length, binary);
    BaseTypes.CHAR.apply(this, arguments);
  }
  inherits(CHAR, BaseTypes.CHAR);

  CHAR.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.CHAR.prototype.toSql.call(this);
  };

  BaseTypes.CHAR.types.postgres = ['char', 'bpchar'];

  function BOOLEAN() {
    if (!(this instanceof BOOLEAN)) return new BOOLEAN();
    BaseTypes.BOOLEAN.apply(this, arguments);
  }
  inherits(BOOLEAN, BaseTypes.BOOLEAN);

  BOOLEAN.prototype.toSql = function toSql() {
    return 'BOOLEAN';
  };

  BOOLEAN.prototype._sanitize = function _sanitize(value) {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }

      if (_.isString(value)) {
        // Only take action on valid boolean strings.
        value = value === 'true' || value === 't' ? true : value === 'false' || value === 'f' ? false : value;

      } else if (_.isNumber(value)) {
        // Only take action on valid boolean integers.
        value = value === 1 ? true : value === 0 ? false : value;
      }
    }

    return value;
  };
  BOOLEAN.parse = BOOLEAN.prototype._sanitize;

  BOOLEAN.prototype._stringify = function _stringify(value, options) {

    //Postgres doesn't handle the boolean <-> integer comparaison, we force a string cast because it can handle it
    if (typeof value === 'number') {
      return value.toString();
    } else {
      return value;
    }
  };

  BaseTypes.BOOLEAN.types.postgres = ['bool'];

  function DATE(length) {
    if (!(this instanceof DATE)) return new DATE(length);
    BaseTypes.DATE.apply(this, arguments);
  }
  inherits(DATE, BaseTypes.DATE);

  DATE.prototype.toSql = function toSql() {
    return 'TIMESTAMP WITH TIME ZONE';
  };

  DATE.prototype.validate = function validate(value) {
    if (value !== Infinity && value !== -Infinity) {
      return BaseTypes.DATE.prototype.validate.call(this, value);
    }

    return true;
  };

  DATE.prototype._stringify = function _stringify(value, options) {
    if (value === Infinity) {
      return 'Infinity';
    } else if (value === -Infinity) {
      return '-Infinity';
    }

    return BaseTypes.DATE.prototype._stringify.call(this, value, options);
  };

  DATE.prototype._sanitize = function _sanitize(value, options) {
    if ((!options || options && !options.raw) && !(value instanceof Date) && !!value && value !== Infinity && value !== -Infinity) {
      if (_.isString(value)) {
        if (_.toLower(value) === 'infinity') {
          return Infinity;
        } else if (_.toLower(value) === '-infinity') {
          return -Infinity;
        }
      }

      return new Date(value);
    }

    return value;
  };

  BaseTypes.DATE.types.postgres = ['timestamptz'];

  function NOW() {
    if (!(this instanceof NOW)) return new NOW();
    BaseTypes.NOW.apply(this, arguments);
  }
  inherits(NOW, BaseTypes.NOW);

  NOW.prototype.toSql = function toSql() {
    return 'CURRENT_DATE';
  };

  function SMALLINT(length) {
    if (!(this instanceof SMALLINT)) return new SMALLINT(length);
    BaseTypes.SMALLINT.apply(this, arguments);

    // POSTGRES does not support any parameters for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support SMALLINT with options. Plain `SMALLINT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(SMALLINT, BaseTypes.SMALLINT);

  // int2
  BaseTypes.SMALLINT.types.postgres = ['int2'];

  function INTEGER(length) {
    if (!(this instanceof INTEGER)) return new INTEGER(length);
    BaseTypes.INTEGER.apply(this, arguments);

    // POSTGRES does not support any parameters for integer
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(INTEGER, BaseTypes.INTEGER);

  INTEGER.parse = function parse(value) {
    return parseInt(value, 10);
  };

  // int4
  BaseTypes.INTEGER.types.postgres = ['int4'];

  function BIGINT(length) {
    if (!(this instanceof BIGINT)) return new BIGINT(length);
    BaseTypes.BIGINT.apply(this, arguments);

    // POSTGRES does not support any parameters for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(BIGINT, BaseTypes.BIGINT);

  // int8
  BaseTypes.BIGINT.types.postgres = ['int8'];

  function REAL(length, decimals) {
    if (!(this instanceof REAL)) return new REAL(length, decimals);
    BaseTypes.REAL.apply(this, arguments);

    // POSTGRES does not support any parameters for real
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support REAL with options. Plain `REAL` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(REAL, BaseTypes.REAL);

  // float4
  BaseTypes.REAL.types.postgres = ['float4'];

  function DOUBLE(length, decimals) {
    if (!(this instanceof DOUBLE)) return new DOUBLE(length, decimals);
    BaseTypes.DOUBLE.apply(this, arguments);

    // POSTGRES does not support any parameters for double
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support DOUBLE with options. Plain `DOUBLE` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(DOUBLE, BaseTypes.DOUBLE);

  // float8
  BaseTypes.DOUBLE.types.postgres = ['float8'];

  function FLOAT(length, decimals) {
    if (!(this instanceof FLOAT)) return new FLOAT(length, decimals);
    BaseTypes.FLOAT.apply(this, arguments);

    // POSTGRES does only support lengths as parameter.
    // Values between 1-24 result in REAL
    // Values between 25-53 result in DOUBLE PRECISION
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn('PostgreSQL does not support FLOAT with decimals. Plain `FLOAT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._decimals = undefined;
    }
    if (this._unsigned) {
      warn('PostgreSQL does not support FLOAT unsigned. `UNSIGNED` was removed.');
      this._unsigned = undefined;
    }
    if (this._zerofill) {
      warn('PostgreSQL does not support FLOAT zerofill. `ZEROFILL` was removed.');
      this._zerofill = undefined;
    }
  }
  inherits(FLOAT, BaseTypes.FLOAT);
  delete FLOAT.parse; // Float has no separate type in PG

  function BLOB(length) {
    if (!(this instanceof BLOB)) return new BLOB(length);
    BaseTypes.BLOB.apply(this, arguments);
  }
  inherits(BLOB, BaseTypes.BLOB);

  BLOB.prototype.toSql = function toSql() {
    if (this._length) {
      warn('PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.');
      this._length = undefined;
    }
    return 'BYTEA';
  };

  BLOB.prototype._hexify = function _hexify(hex) {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return "E'\\\\x" + hex + "'";
  };

  BaseTypes.BLOB.types.postgres = ['bytea'];

  function GEOMETRY(type, srid) {
    if (!(this instanceof GEOMETRY)) return new GEOMETRY(type, srid);
    BaseTypes.GEOMETRY.apply(this, arguments);
  }
  inherits(GEOMETRY, BaseTypes.GEOMETRY);

  GEOMETRY.prototype.toSql = function toSql() {
    let result = this.key;

    if (this.type) {
      result += '(' + this.type;

      if (this.srid) {
        result += ',' + this.srid;
      }

      result += ')';
    }

    return result;
  };

  BaseTypes.GEOMETRY.types.postgres = ['geometry'];

  GEOMETRY.parse = GEOMETRY.prototype.parse = function parse(value) {
    const b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOMETRY.prototype._stringify = function _stringify(value, options) {
    return 'ST_GeomFromGeoJSON(' + options.escape(JSON.stringify(value)) + ')';
  };

  function GEOGRAPHY(type, srid) {
    if (!(this instanceof GEOGRAPHY)) return new GEOGRAPHY(type, srid);
    BaseTypes.GEOGRAPHY.apply(this, arguments);
  }
  inherits(GEOGRAPHY, BaseTypes.GEOGRAPHY);

  GEOGRAPHY.prototype.toSql = function toSql() {
    let result = 'GEOGRAPHY';

    if (this.type) {
      result += '(' + this.type;

      if (this.srid) {
        result += ',' + this.srid;
      }

      result += ')';
    }

    return result;
  };

  BaseTypes.GEOGRAPHY.types.postgres = ['geography'];

  GEOGRAPHY.parse = GEOGRAPHY.prototype.parse = function parse(value) {
    const b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOGRAPHY.prototype._stringify = function _stringify(value, options) {
    return 'ST_GeomFromGeoJSON(' + options.escape(JSON.stringify(value)) + ')';
  };

  let hstore;
  function HSTORE() {
    if (!(this instanceof HSTORE)) return new HSTORE();
    BaseTypes.HSTORE.apply(this, arguments);

    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
  }
  inherits(HSTORE, BaseTypes.HSTORE);

  HSTORE.parse = function parse(value) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
    return hstore.parse(value);
  };

  HSTORE.prototype.escape = false;
  HSTORE.prototype._stringify = function _stringify(value) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
    return "'" + hstore.stringify(value) + "'";
  };

  BaseTypes.HSTORE.types.postgres = ['hstore'];

  function RANGE(subtype) {
    if (!(this instanceof RANGE)) return new RANGE(subtype);
    BaseTypes.RANGE.apply(this, arguments);
  }
  inherits(RANGE, BaseTypes.RANGE);

  RANGE.oid_map = {
    3904: 23, // int4
    3905: 23,
    3906: 1700, // Numeric
    3907: 1700,
    3908: 1114, // timestamp
    3909: 1114,
    3910: 1184, // timestamptz
    3911: 1184,
    3912: 1082, // date
    3913: 1082,
    3926: 20,    // int8
    3927: 20
  };

  const range = require('./range');
  RANGE.parse = function parse(value, options = { parser: val => val }) {
    return range.parse(value, options.parser);
  }

  RANGE.prototype.escape = false;
  RANGE.prototype._stringify = function _stringify(values, options) {
    const value = this._value(values, options);
      if (!Array.isArray(values)) {
        return `'${value}'::${this.toCastType()}`;
      }
      return `'${value}'`;
  };

  RANGE.prototype.toSql = function toSql() {
    return BaseTypes.RANGE.types.postgres.subtypes[this._subtype.toLowerCase()];
  };
  RANGE.prototype.toCastType = function toCastType() {
    return BaseTypes.RANGE.types.postgres.castTypes[this._subtype.toLowerCase()];
  };

  RANGE.prototype._value = function _value(values, options) {
    if (!Array.isArray(values)) {
      return this.options.subtype.stringify(values, options);
    }
    const valueInclusivity = [true, false];
    const valuesStringified = values.map((value, index) => {
      if (_.isObject(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
        if (Object.prototype.hasOwnProperty.call(value, 'inclusive')) {
          valueInclusivity[index] = value.inclusive;
        }
        value = value.value;
      }
      if (value === null || value === -Infinity || value === Infinity) {
        // Pass through "unbounded" bounds unchanged
        return value;
      }
      if (this.options.subtype.stringify) {
        return this.options.subtype.stringify(value, options);
      }
      return options.escape(value);
    });
    // Array.map does not preserve extra array properties
    valuesStringified.inclusive = valueInclusivity;
    return range.stringify(valuesStringified);
  }

  BaseTypes.RANGE.types.postgres = {
    subtypes: {
      integer: 'int4range',
      decimal: 'numrange',
      date: 'tstzrange',
      dateonly: 'daterange',
      bigint: 'int8range'
    },
    castTypes: {
      integer: 'int4',
      decimal: 'numeric',
      date: 'timestamptz',
      dateonly: 'date',
      bigint: 'int8'
    }
  };

  BaseTypes.ARRAY.prototype.escape = false;
  BaseTypes.ARRAY.prototype._stringify = function _stringify(values, options) {
    let str = 'ARRAY[' + values.map(value => {
      if (this.type && this.type.stringify) {
        value = this.type.stringify(value, options);

        if (this.type.escape === false) {
          return value;
        }
      }
      return options.escape(value);
    }, this).join(',') + ']';

    if (this.type) {
      const Utils = require('../../utils');
      let castKey = this.toSql();

      if (this.type instanceof BaseTypes.ENUM) {
        castKey = Utils.addTicks(
          Utils.generateEnumName(options.field.Model.getTableName(), options.field.fieldName),
          '"'
        ) + '[]';
      }

      str += '::' + castKey;
    }

    return str;
  };

  function ENUM(options) {
    if (!(this instanceof ENUM)) return new ENUM(options);
    BaseTypes.ENUM.apply(this, arguments);
  }
  inherits(ENUM, BaseTypes.ENUM);

  ENUM.parse = function(value) {
    return value;
  };

  BaseTypes.ENUM.types.postgres = [null];

  const exports = {
    DECIMAL,
    NOW,
    BLOB,
    STRING,
    CHAR,
    TEXT,
    SMALLINT,
    INTEGER,
    BIGINT,
    BOOLEAN,
    DATE,
    DATEONLY,
    REAL,
    'DOUBLE PRECISION': DOUBLE,
    FLOAT,
    GEOMETRY,
    GEOGRAPHY,
    HSTORE,
    RANGE,
    ENUM,
    JSON : JSONTYPE
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = oldType => new DataType(oldType.options);
    }
  });

  return exports;
};
