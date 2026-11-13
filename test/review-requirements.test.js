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
  assert.doesNotMatch(companionMode, /setInterval|fetch\s*\(\s*COMPANION_HEALTH_URL/);
  assert.match(companionMode, /get-hwip-companion-state/);
  assert.match(content, /get-hwip-companion-state/);
});

test('루프백 접근은 사용자가 토글을 켤 때만 요청하는 optional 권한이다', () => {
  assert.doesNotMatch(manifest.host_permissions.join('\n'), /127\.0\.0\.1:38473/);
  assert.match(manifest.optional_host_permissions.join('\n'), /127\.0\.0\.1:38473/);
  const popup = fs.readFileSync('popup/popup.js', 'utf8');
  assert.match(popup, /chrome\.permissions\.request/);
  assert.match(popup, /chrome\.permissions\.remove/);
});

test('LaTeX를 추출하지 못한 수식이 있으면 문단 변환 전체를 포기한다', () => {
  assert.match(companionMode, /extractionFailed = true/);
  assert.match(companionMode, /if \(extractionFailed\) return null/);
});

test('호버 감지는 검증된 기본 selector와 추출 가능성 검사를 사용한다', () => {
  assert.match(content, /if \(el && hasExtractable\(el\)\)/);
  assert.doesNotMatch(content, /latexFromReactFiber|elementsFromPoint|\[data-testid\*="math"\]/);
});

test('버전은 manifest에서만 관리한다', () => {
  assert.equal(Object.hasOwn(pkg, 'version'), false);
});
