'use strict';

(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HwipCompanionDetection = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  function probe(fetchImpl, url, timeoutMs) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, timeoutMs || 1200);
    return fetchImpl(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    }).then(function () {
      return true;
    }, function () {
      return false;
    }).then(function (available) {
      clearTimeout(timeout);
      return available;
    });
  }

  return { probe: probe };
});
