'use strict';

/*
 * Windows 보조 프로그램이 실행 중일 때만 활성화되는 확장 모드.
 * 기본 모드에서는 copy 이벤트를 전혀 건드리지 않아 기존 확장 동작을 유지한다.
 */
(function () {
  if (window.__hwipCompanionModeInjected) return;
  window.__hwipCompanionModeInjected = true;

  var API_URL = 'https://hwip.dshs.dev/api/convert';
  var PREFIX = 'HWIP_FRAGMENT_V1:';
  var MATH_SELECTOR = '.katex, mjx-container, math, [role="math"], [data-math], [data-math-source], ms-katex';
  var BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DIV|H[1-6]|HR|LI|P|PRE|SECTION|TR)$/;
  var companionAvailable = false;
  var formulaCopyEnabled = true;

  function updateState(state) {
    companionAvailable = !!(state && state.available);
    document.documentElement.setAttribute('data-hwip-mode', companionAvailable ? 'companion' : 'basic');
  }

  function requestState(force) {
    try {
      chrome.runtime.sendMessage({ type: 'get-hwip-companion-state', force: !!force }, function (state) {
        if (chrome.runtime.lastError) return updateState(null);
        updateState(state);
      });
    } catch (e) { updateState(null); }
  }

  chrome.runtime.onMessage.addListener(function (message) {
    if (message && message.type === 'hwip-companion-state') updateState(message);
  });
  requestState(true);
  setInterval(function () { requestState(true); }, 5000);

  chrome.storage.sync.get({ autoFormulaCopy: true }, function (result) {
    formulaCopyEnabled = result.autoFormulaCopy !== false;
  });

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === 'sync' && changes.autoFormulaCopy) {
      formulaCopyEnabled = changes.autoFormulaCopy.newValue !== false;
    }
  });

  function latexOf(el) {
    var data = el.closest && el.closest('[data-math],[data-math-source]');
    if (data) return (data.getAttribute('data-math') || data.getAttribute('data-math-source') || '').trim();
    var annotation = el.querySelector && el.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) return (annotation.textContent || '').trim();
    var script = el.querySelector && el.querySelector('script[type^="math/tex"]');
    if (script) return (script.textContent || '').trim();
    return (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('alttext')) || '').trim();
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
        if (latex) push(segments, 'latex', latex);
        return;
      }
      if (el.tagName === 'BR') return push(segments, 'text', '\n');
      for (var child = el.firstChild; child; child = child.nextSibling) walk(child);
      if (BLOCK_TAGS.test(el.tagName)) push(segments, 'text', '\n');
    }

    walk(root);
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

  function encodeFragment(segments, fallbackText) {
    var json = JSON.stringify({ segments: segments, fallbackText: fallbackText || '' });
    var bytes = new TextEncoder().encode(json);
    var binary = '';
    for (var i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return PREFIX + btoa(binary);
  }

  document.addEventListener('copy', function (event) {
    if (!companionAvailable || !formulaCopyEnabled) return;
    var source = extractSelection();
    if (!source) return;
    var fallbackText = window.getSelection().toString();

    event.preventDefault();
    event.clipboardData.setData('text/plain', fallbackText);
    Promise.all(source.map(function (segment) {
      if (segment.type !== 'latex') return Promise.resolve(segment);
      return convert(segment.value).then(function (hwp) {
        return { type: 'equation', value: hwp };
      });
    })).then(function (segments) {
      return navigator.clipboard.writeText(encodeFragment(segments, fallbackText));
    }).catch(function (error) {
      console.warn('[Hwip] companion mode conversion failed:', error);
    });
  }, true);
})();
