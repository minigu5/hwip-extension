'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { probe } = require('../lib/companion-detection.js');

test('loopback HTTP 응답이 있으면 companion 모드로 감지한다', async () => {
  let request;
  const available = await probe((url, options) => {
    request = { url, options };
    return Promise.resolve({ type: 'opaque' });
  }, 'http://127.0.0.1:38473/health', 100);

  assert.equal(available, true);
  assert.equal(request.url, 'http://127.0.0.1:38473/health');
  assert.equal(request.options.mode, 'no-cors');
  assert.equal(request.options.cache, 'no-store');
});

test('연결 실패 시 기존 기본 모드를 유지한다', async () => {
  const available = await probe(
    () => Promise.reject(new TypeError('Failed to fetch')),
    'http://127.0.0.1:38473/health',
    100
  );
  assert.equal(available, false);
});

test('공식 연동 상태 확인은 CORS 응답을 요구할 수 있다', async () => {
  let request;
  const available = await probe((url, options) => {
    request = options;
    return Promise.resolve({ ok: true });
  }, 'http://127.0.0.1:38473/health', 100, 'cors');
  assert.equal(available, true);
  assert.equal(request.mode, 'cors');
});
