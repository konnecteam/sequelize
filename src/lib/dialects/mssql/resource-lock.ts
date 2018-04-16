'use strict';

import Promise from '../../promise';

function ResourceLock(resource) {
  this.resource = resource;
  this.previous = Promise.resolve(resource);
}

ResourceLock.prototype.unwrap = function() {
  return this.resource;
};

ResourceLock.prototype.lock = function() {
  const lock = this.previous;
  let resolve;

  this.previous = new Promise(r => {
    resolve = r;
  });

  return lock.disposer(resolve);
};

export default ResourceLock;
