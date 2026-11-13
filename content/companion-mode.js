'use strict';

/*
 * 사용자가 Windows 수식 개체 변환을 켠 경우에만 혼합 문단 복사를 처리한다.
 * 기본 복사는 먼저 그대로 완료되고, 변환 성공 시에만 보조 프로그램이
 * Hwp Native + UnicodeText 클립보드로 교체한다.
 */
(function () {
  if (window.__hwipCompanionModeInjected) return;
  window.__hwipCompanionModeInjected = true;

  var API_URL = 'https://hwip.dshs.dev/api/convert';
  var MATH_SELECTOR = '.katex, mjx-container, math, [data-math], [data-math-source], ms-katex';
  var BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DIV|H[1-6]|HR|LI|P|PRE|SECTION|TR)$/;
  var enabled = false;
  var available = false;

  function updateState(message) {
    available = !!(enabled && message && message.enabled && message.available);
    document.documentElement.setAttribute('data-hwip-mode', available ? 'companion' : 'basic');
  }

  chrome.storage.sync.get({ windowsNativeCopy: false }, function (values) {
    enabled = values.windowsNativeCopy === true;
    updateState(null);
  });
  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== 'sync' || !changes.windowsNativeCopy) return;
    enabled = changes.windowsNativeCopy.newValue === true;
    if (!enabled) updateState(null);
  });
  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === 'hwip-companion-state') updateState(message);
  });
  chrome.runtime.sendMessage({ type: 'get-hwip-companion-state' }, function (message) {
    if (!chrome.runtime.lastError && message) updateState(message);
  });

  function latexOf(el) {
    var data = el.closest && el.closest('[data-math],[data-math-source]');
    if (data) return (data.getAttribute('data-math') || data.getAttribute('data-math-source') || '').trim();
    var annotation = el.querySelector && el.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) return (annotation.textContent || '').trim();
    var script = el.querySelector && el.querySelector('script[type^="math/tex"]');
    if (script) return (script.textContent || '').trim();
    return '';
  }

  function push(segments, type, value) {
    if (!value) return;
    var last = segments[segments.length - 1];
    if (last && last.type === type && type === 'text') last.value += value;
    else segments.push({ type: type, value: value });
  }

  function extractSelection() {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    var root = selection.getRangeAt(0).cloneContents();
    if (!root.querySelector || !root.querySelector(MATH_SELECTOR)) return null;
    var segments = [];
    var extractionFailed = false;

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) return push(segments, 'text', node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE) {
        for (var child = node.firstChild; child; child = child.nextSibling) walk(child);
        return;
      }
      var el = node;
      if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || el.getAttribute('aria-hidden') === 'true') return;
      if (el.matches(MATH_SELECTOR)) {
        var latex = latexOf(el);
        if (!latex) extractionFailed = true;
        else push(segments, 'latex', latex);
        return;
      }
      if (el.tagName === 'BR') return push(segments, 'text', '\n');
      for (var child = el.firstChild; child; child = child.nextSibling) walk(child);
      if (BLOCK_TAGS.test(el.tagName)) push(segments, 'text', '\n');
    }

    walk(root);
    if (extractionFailed) return null;
    return segments.some(function (segment) { return segment.type === 'latex'; }) ? segments : null;
  }

  function convert(latex) {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latex: latex })
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      if (!data.result) throw new Error('empty conversion');
      return data.result;
    });
  }

  document.addEventListener('copy', function () {
    if (!enabled || !available) return;
    var source = extractSelection();
    if (!source) return;
    var fallbackText = window.getSelection().toString();

    // preventDefault를 호출하지 않는다. 브라우저의 원문 복사를 먼저 보존한다.
    Promise.all(source.map(function (segment) {
      if (segment.type !== 'latex') return Promise.resolve(segment);
      return convert(segment.value).then(function (hwp) {
        return { type: 'equation', value: hwp };
      });
    })).then(function (segments) {
      chrome.runtime.sendMessage({
        type: 'copy-hwip-fragment',
        fragment: { segments: segments, fallbackText: fallbackText }
      }, function (response) {
        if (chrome.runtime.lastError || !response || !response.ok)
          console.warn('[Hwip] Windows 수식 개체 변환에 실패해 원문 복사를 유지했습니다.');
      });
    }).catch(function (error) {
      console.warn('[Hwip] 문단 수식 변환에 실패해 원문 복사를 유지했습니다.', error);
    });
  }, true);
})();
