'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const companionMode = fs.readFileSync('content/companion-mode.js', 'utf8');
const background = fs.readFileSync('background.js', 'utf8');
const content = fs.readFileSync('content/content.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

test('Windows 수식 개체 변환은 opt-in이며 클립보드 marker를 쓰지 않는다', () => {
  assert.match(companionMode, /windowsNativeCopy:\s*false/);
  assert.doesNotMatch(companionMode, /HWIP_FRAGMENT_V1|navigator\.clipboard\.writeText/);
  assert.match(companionMode, /copy-hwip-fragment/);
  assert.doesNotMatch(companionMode, /preventDefault\s*\(/);
});

test('상태 확인은 background에서만 수행한다', () => {
  assert.match(background, /COMPANION_ALARM/);
  assert.doesNotMatch(companionMode, /setInterval|get-hwip-companion-state/);
});

test('호버 감지는 검증된 기본 selector와 추출 가능성 검사를 사용한다', () => {
  assert.match(content, /if \(el && hasExtractable\(el\)\)/);
  assert.doesNotMatch(content, /latexFromReactFiber|elementsFromPoint|\[data-testid\*="math"\]/);
});

test('저장소 관리자가 버전을 결정할 수 있도록 기존 manifest 버전을 유지한다', () => {
  assert.equal(manifest.version, '0.8.4');
  assert.equal(Object.hasOwn(pkg, 'version'), false);
});
