'use strict';
/*
 * 확장 UI 다국어 헬퍼 — popup / sidepanel 공용
 *
 * - window.hwpT(key)       : chrome.i18n.getMessage 래퍼 (실패 시 key 반환)
 * - window.hwpI18nApply()  : HTML 의 data-i18n* 속성을 번역문으로 치환
 *     data-i18n="key"             → textContent
 *     data-i18n-html="key"        → innerHTML (패키지 안 메시지만 사용)
 *     data-i18n-title="key"       → title 속성
 *     data-i18n-placeholder="key" → placeholder 속성
 *
 * 메시지는 _locales/<언어>/messages.json 에 있다. 새 문자열을 추가하면
 * ko(기본 언어)와 en 둘 다에 넣을 것.
 */
(function (g) {
  function t(key) {
    try {
      var m = chrome.i18n.getMessage(key);
      if (m) return m;
    } catch (e) { /* chrome.i18n 없는 환경 */ }
    return key;
  }

  function apply(root) {
    root = root || document;
    var map = [
      ['[data-i18n]', 'i18n', function (el, v) { el.textContent = v; }],
      ['[data-i18n-html]', 'i18nHtml', function (el, v) { el.innerHTML = v; }],
      ['[data-i18n-title]', 'i18nTitle', function (el, v) { el.setAttribute('title', v); }],
      ['[data-i18n-placeholder]', 'i18nPlaceholder', function (el, v) { el.setAttribute('placeholder', v); }]
    ];
    map.forEach(function (m) {
      var els = root.querySelectorAll(m[0]);
      for (var i = 0; i < els.length; i++) m[2](els[i], t(els[i].dataset[m[1]]));
    });
    try {
      var lang = chrome.i18n.getUILanguage();
      if (lang) document.documentElement.lang = lang;
    } catch (e) { /* noop */ }
  }

  g.hwpT = t;
  g.hwpI18nApply = apply;

  // 이 스크립트는 popup.js / sidepanel.js 보다 먼저, body 끝에서 로드된다.
  // 앞선 DOM 은 이미 파싱돼 있으므로 즉시 적용한다. (DOMContentLoaded 로 미루면
  // 페이지 스크립트가 이미 써 넣은 동적 문구를 번역문이 덮어쓴다.)
  apply();
})(window);
