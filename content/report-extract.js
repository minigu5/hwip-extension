'use strict';
/*
 * AI 채팅 보고서 감지 + HWPX 변환 버튼 삽입 — content script
 *
 * 수식 추출 우선순위:
 * 1) KaTeX <annotation encoding="application/x-tex">
 * 2) React fiber props (math / formula / tex / expression / latex)
 * 3) data-math, data-formula 등 속성
 * 4) ChatGPT 텍스트 복사 포맷 [ \n LaTeX \n ] / ( LaTeX ) 패턴 후처리
 */
(function () {
  if (window.__hwpReportExtractInjected) return;
  window.__hwpReportExtractInjected = true;

  // ── 사이트별 응답 컨텐츠 셀렉터 ──────────────────────────────
  var CONTENT_SELECTORS = [
    '[data-message-author-role="assistant"] .markdown',  // ChatGPT
    '[data-message-author-role="assistant"] .prose',     // ChatGPT fallback
    '.font-claude-response',                             // Claude.ai
    '.model-response-text',                             // Gemini
    'model-response .markdown',                         // Gemini (커스텀 엘리먼트 내부)
    '[data-role="model"] .markdown',                    // AI Studio
    '.prose.dark\\:prose-invert',                       // Grok, Perplexity
    '[data-role="assistant"] .prose',
    '.ai-message .prose',
  ];

  // ── 보고서 판단 (헤딩 2개↑ 또는 2000자↑) ─────────────────────
  function isReport(el) {
    var headings = el.querySelectorAll('h1, h2, h3, h4');
    if (headings.length >= 2) return true;
    return (el.innerText || el.textContent || '').trim().length > 2000;
  }

  // ── ChatGPT 캔버스 감지 ──────────────────────────────────────
  // 캔버스가 있는 메시지에는 버튼 표시하지 않음
  function hasCanvas(el) {
    var container = el.closest('[data-message-author-role="assistant"]') ||
                    el.closest('article') || el.parentElement;
    if (!container) return false;
    var selectors = [
      '[data-testid="canvas-turn-action-button"]',
      '[data-testid*="canvas"]',
      'button[aria-label*="anvas"]',
      '[class*="canvasTile"]',
      '[class*="canvas-tile"]',
      '[data-canvas-id]',
      '[data-type="canvas"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      try { if (container.querySelector(selectors[i])) return true; } catch (e) {}
    }
    return false;
  }

  // ── React fiber에서 LaTeX prop 추출 (ChatGPT 등 React 사이트) ──
  function getLatexFromFiber(el) {
    var fiberKey = null;
    try {
      var ks = Object.keys(el);
      for (var i = 0; i < ks.length; i++) {
        if (ks[i].startsWith('__reactFiber') || ks[i].startsWith('__reactInternalInstance')) {
          fiberKey = ks[i]; break;
        }
      }
    } catch (e) { return null; }
    if (!fiberKey) return null;

    var fiber = el[fiberKey];
    var limit = 50;
    while (fiber && limit-- > 0) {
      try {
        var p = fiber.memoizedProps;
        if (p) {
          // react-katex: math / BlockMath / InlineMath props
          var propKeys = ['math', 'formula', 'tex', 'expression', 'latex', 'value'];
          for (var j = 0; j < propKeys.length; j++) {
            var v = p[propKeys[j]];
            if (typeof v === 'string' && v.length > 0) return v;
          }
          // children가 LaTeX 문자열인 경우 (\, {, }, ^, _ 포함)
          if (typeof p.children === 'string' && /[\\{}^_]/.test(p.children)) {
            return p.children;
          }
        }
      } catch (e) { /* ignore */ }
      fiber = fiber.return;
    }
    return null;
  }

  // ── KaTeX / MathJax에서 LaTeX 추출 (다중 전략) ───────────────
  function getLatex(el) {
    // 1) KaTeX annotation (htmlAndMathml 렌더 모드)
    var ann = el.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent.trim()) {
      var raw = ann.textContent.trim();
      // annotation에 구분자가 포함된 경우 strip ($$ ... $$, \[ ... \], \( ... \), $ ... $)
      raw = raw.replace(/^\$\$([\s\S]*)\$\$$/, '$1')
               .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
               .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
               .replace(/^\$([\s\S]*)\$$/, '$1')
               .trim();
      return raw;
    }

    // 2) React fiber props (ChatGPT, react-katex 등)
    var fromFiber = getLatexFromFiber(el);
    if (fromFiber) return fromFiber;

    // 3) data 속성 — el부터 5단계 조상까지
    var dataKeys = ['data-formula', 'data-math', 'data-latex', 'data-tex', 'data-expression', 'data-content'];
    var cur = el;
    for (var d = 0; d < 5; d++) {
      for (var i = 0; i < dataKeys.length; i++) {
        try {
          var attr = cur.getAttribute && cur.getAttribute(dataKeys[i]);
          if (attr && attr.trim()) return attr.trim();
        } catch (e) {}
      }
      if (!cur.parentElement) break;
      cur = cur.parentElement;
    }

    // 4) Gemini: data-math on ancestor (already covered above)
    return null;
  }

  // data-math 값이 한국어 비율이 높고 수식 기호가 거의 없는 경우 → 텍스트로 처리
  // 예: "압력 P" (수식 기호 없음), "온도 T와 압력" (한국어 비율 높음)
  function isKoreanHeavyMath(latex) {
    var korLen = (latex.match(/[가-힣]/g) || []).length;
    if (!korLen) return false;
    // 역슬래시 명령이나 수식 기호(_^=)가 있으면 수식으로 처리
    if (/\\[a-zA-Z]/.test(latex) || /[_^=<>+\-*/|{}]/.test(latex)) return false;
    // 수식 기호 없이 한국어가 한 글자라도 있으면 텍스트
    return true;
  }

  // \text{한국어...} 비율이 수식 부분보다 훨씬 많은 경우 → 텍스트로 처리
  // 예: "\text{상평형 선을 따라} dT, dP \text{만큼}"
  function isTextHeavyLatex(latex) {
    var textContent = '';
    var withoutText = latex.replace(/\\(?:text|mathrm|textbf|textrm)\{([^}]*)\}/g, function (_, t) {
      textContent += t;
      return '';
    });
    if (!/[가-힣]/.test(textContent)) return false;
    // 나머지 수식 기호 (공백·구두점 제외)
    var mathPart = withoutText.replace(/[\s,;.()\[\]]/g, '').trim();
    return textContent.replace(/\s/g, '').length > mathPart.length * 1.5;
  }

  // ── DOM → Markdown 변환 ──────────────────────────────────────
  function domToMd(root) {
    var raw = nodeToMd(root).trim();
    // ChatGPT 텍스트 복사 포맷 후처리:
    // [\nLaTeX\n===\n...\n] → $$LaTeX$$
    // * (\LaTeX): ... → * $\LaTeX$: ...
    raw = fixChatGPTMathFormat(raw);
    return collapseBlankLines(raw);
  }

  // ChatGPT 텍스트 복사 포맷 후처리
  // block: 독립 줄의 [ \n LaTeX \n ] → $$LaTeX$$
  // inline: (\LaTeX) 패턴 (역슬래시 명령 포함) → $LaTeX$   ($$...$$ 내부 제외)
  function fixChatGPTMathFormat(text) {
    // Step 1: === 구분선 → = 기호 (줄 전체가 = 이상인 경우)
    text = text.replace(/\n={3,}\n/g, '\n=\n');

    // Step 2: [ \n ... \n? ] 블록 → $$...$$
    // ] 가 마지막 수식 줄 끝에 붙어 있는 경우(\n 없이)도 처리한다.
    // LaTeX 명령(\command)이 포함된 경우에만 변환해 일반 링크 참조를 보호한다.
    text = text.replace(/(?:^|\n)\[\n([\s\S]*?)\n?\](?=\n|$)/gm, function (match, content) {
      var latex = content.trim().replace(/\n+/g, ' ').trim();
      if (!latex || !/\\[A-Za-z]/.test(latex)) return match;
      return '\n\n$$' + latex + '$$\n\n';
    });

    // Step 3: 인라인 ( LaTeX ) → $ LaTeX $ 단, $$...$$ 블록 내부는 건드리지 않음
    var segments = text.split(/([$][$][\s\S]*?[$][$])/g);
    for (var i = 0; i < segments.length; i += 2) {  // 짝수 인덱스 = 블록 밖
      segments[i] = segments[i].replace(/\(([^)\n]{1,200}?)\)/g, function (m, inner) {
        if (/\\[a-zA-Z]/.test(inner) && !/^https?/.test(inner)) {
          return '$' + inner.trim() + '$';
        }
        return m;
      });
    }
    return segments.join('');
  }

  function collapseBlankLines(s) {
    return s.replace(/\n{3,}/g, '\n\n');
  }

  function childrenMd(node) {
    var out = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      out += nodeToMd(node.childNodes[i]);
    }
    return out;
  }

  function listItemMd(li, ordered, idx) {
    var bullet = ordered ? (idx + 1) + '. ' : '- ';
    var input = li.querySelector('input[type="checkbox"]');
    if (input) bullet = input.checked ? '- [x] ' : '- [ ] ';

    var direct = '';
    var nested = '';
    for (var i = 0; i < li.childNodes.length; i++) {
      var c = li.childNodes[i];
      if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) {
        nested += '\n' + listToMd(c, c.tagName === 'OL', 1);
      } else if (c.nodeType === 1 && c.tagName === 'INPUT') {
        // skip checkbox
      } else {
        direct += nodeToMd(c);
      }
    }
    return bullet + direct.trim() + nested;
  }

  function listToMd(listEl, ordered, depth) {
    depth = depth || 0;
    var indent = '  '.repeat(depth);
    var lines = [];
    var liEls = listEl.children;
    for (var i = 0; i < liEls.length; i++) {
      if (liEls[i].tagName === 'LI') {
        lines.push(indent + listItemMd(liEls[i], ordered, i));
      }
    }
    return lines.join('\n');
  }

  function tableToMd(table) {
    var rows = table.querySelectorAll('tr');
    if (!rows.length) return '';
    var lines = [];
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll('th, td');
      var vals = [];
      for (var j = 0; j < cells.length; j++) {
        vals.push(childrenMd(cells[j]).trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
      }
      lines.push('| ' + vals.join(' | ') + ' |');
      if (i === 0) {
        lines.push('| ' + vals.map(function () { return '---'; }).join(' | ') + ' |');
      }
    }
    return lines.join('\n');
  }

  function nodeToMd(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1) return '';

    var tag = node.tagName.toLowerCase();
    if (node.style && (node.style.display === 'none' || node.style.visibility === 'hidden')) return '';
    if (tag === 'script' || tag === 'style' || tag === 'button' || tag === 'svg' ||
        tag === 'nav' || tag === 'header' || tag === 'footer') return '';

    // ── 수식 ────────────────────────────────────────────────────
    // Gemini: DIV.math-block (블록 수식) — data-math 직접 사용
    if (node.classList && node.classList.contains('math-block')) {
      var gdm = node.getAttribute('data-math');
      if (gdm && gdm.trim()) return '\n\n$$' + gdm.trim() + '$$\n\n';
      var gkd = node.querySelector('.katex-display .katex') || node.querySelector('.katex');
      if (gkd) { var gkl = getLatex(gkd); if (gkl) return '\n\n$$' + gkl + '$$\n\n'; }
      return '';
    }
    // Gemini: SPAN.math-inline (인라인 수식) — data-math 직접 사용
    if (tag === 'span' && node.classList && node.classList.contains('math-inline')) {
      if (node.closest && node.closest('.math-block')) return '';
      var gim = node.getAttribute('data-math');
      if (gim) {
        var gilat = gim.trim();
        if (!gilat) return (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^[가-힣㄰-㆏\s.,!?:;()\[\]\-·]+$/.test(gilat)) return gilat;
        if (/^[A-Za-z]+(\s+[A-Za-z,.-]+)+$/.test(gilat)) return gilat;
        if (isKoreanHeavyMath(gilat)) return gilat;
        return '$' + gilat + '$';
      }
    }

    if (node.classList && node.classList.contains('katex-display')) {
      var kinner = node.querySelector('.katex');
      if (kinner) {
        var klat = getLatex(kinner);
        if (klat) {
          // \text{한국어} 비율이 수식 부분보다 훨씬 많으면 textContent 폴백
          if (isTextHeavyLatex(klat)) {
            var tcText = (kinner.textContent || '').replace(/\s+/g, ' ').trim();
            return tcText ? '\n\n' + tcText + '\n\n' : '';
          }
          return '\n\n$$' + klat + '$$\n\n';
        }
      }
      // annotation 없으면 inner .katex 직접 시도
      var klat2 = getLatex(node);
      if (klat2) return '\n\n$$' + klat2 + '$$\n\n';
      // 마지막 폴백: 텍스트로 감싸 보존
      var fbText = (node.textContent || '').replace(/\s+/g, ' ').trim();
      return fbText ? '\n\n$$' + fbText + '$$\n\n' : '';
    }
    if (node.classList && node.classList.contains('katex')) {
      if (node.closest && node.closest('.katex-display')) return '';
      var lat2 = getLatex(node);
      if (lat2) {
        var lat2t = lat2.trim();
        // 순수 한국어 또는 한국어+수식기호 없는 혼합 → 텍스트
        if (/^[가-힣㄰-㆏\s.,!?:;()\[\]\-·]+$/.test(lat2t)) return lat2t;
        if (isKoreanHeavyMath(lat2t)) return lat2t;
        // 순수 영어 단어들 (LaTeX 명령·수식 기호 없음) → 텍스트 (Gemini가 영문 설명을 .katex로 감싸는 경우)
        if (/^[A-Za-z][A-Za-z0-9\s,.\-()]+$/.test(lat2t) && !/\\[a-zA-Z]/.test(lat2t) && !/[_^{}=<>]/.test(lat2t)) return lat2t;
        return '$' + lat2t + '$';
      }
      // 폴백: 유니코드 텍스트 (최소한 읽을 수 있게)
      return (node.textContent || '').replace(/\s+/g, ' ').trim();
    }
    // MathJax (Gemini 등)
    if (tag === 'mjx-container') {
      var mjAnn = node.querySelector('annotation[encoding="application/x-tex"]');
      if (mjAnn) {
        var isBlk = node.getAttribute('display') === 'true';
        var lat3 = mjAnn.textContent.trim();
        return isBlk ? '\n\n$$' + lat3 + '$$\n\n' : '$' + lat3 + '$';
      }
      return node.textContent || '';
    }

    // ── 블록 요소 ────────────────────────────────────────────────
    if (/^h[1-6]$/.test(tag)) {
      return '\n\n' + '#'.repeat(parseInt(tag[1], 10)) + ' ' + childrenMd(node).trim() + '\n\n';
    }
    if (tag === 'p') return '\n\n' + childrenMd(node).trim() + '\n\n';
    if (tag === 'pre') {
      var codeEl = node.querySelector('code');
      var lm = (codeEl && (codeEl.className || '')).match(/language-(\S+)/);
      var codeText = (codeEl || node).textContent || '';
      return '\n\n```' + (lm ? lm[1] : '') + '\n' + codeText.replace(/\n$/, '') + '\n```\n\n';
    }
    if (tag === 'blockquote') {
      var bql = childrenMd(node).trim().split('\n');
      return '\n\n' + bql.map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
    }
    if (tag === 'hr') return '\n\n---\n\n';
    if (tag === 'br') return '\n';
    if (tag === 'ul') return '\n\n' + listToMd(node, false, 0) + '\n\n';
    if (tag === 'ol') return '\n\n' + listToMd(node, true, 0) + '\n\n';
    if (tag === 'li') return listItemMd(node, false, 0);
    if (tag === 'table') return '\n\n' + tableToMd(node) + '\n\n';

    // ── 인라인 요소 ──────────────────────────────────────────────
    if (tag === 'strong' || tag === 'b') return '**' + childrenMd(node).trim() + '**';
    if (tag === 'em' || tag === 'i') return '*' + childrenMd(node).trim() + '*';
    if (tag === 'del' || tag === 's') return '~~' + childrenMd(node).trim() + '~~';
    if (tag === 'code') {
      if (node.closest && node.closest('pre')) return node.textContent || '';
      return '`' + (node.textContent || '') + '`';
    }
    if (tag === 'a') {
      var href = node.getAttribute('href');
      var lt = childrenMd(node).trim();
      if (href && !href.startsWith('javascript:')) return '[' + lt + '](' + href + ')';
      return lt;
    }
    return childrenMd(node);
  }

  // ── 응답 컨테이너 탐색 ──────────────────────────────────────
  function findContainers() {
    var seen = new Set();
    var results = [];
    for (var i = 0; i < CONTENT_SELECTORS.length; i++) {
      try {
        var found = document.querySelectorAll(CONTENT_SELECTORS[i]);
        for (var j = 0; j < found.length; j++) {
          if (!seen.has(found[j])) {
            seen.add(found[j]);
            results.push(found[j]);
          }
        }
      } catch (e) {}
    }
    return results;
  }

  // ── 버튼 삽입 ────────────────────────────────────────────────
  var BTN_ATTR = 'data-hwp-report-added';

  function addButton(el) {
    if (el.getAttribute(BTN_ATTR)) return;
    if (!isReport(el)) return;
    if (hasCanvas(el)) return; // 캔버스 생성된 메시지는 스킵

    el.setAttribute(BTN_ATTR, '1');

    var bar = document.createElement('div');
    bar.className = 'hwp-report-bar';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hwp-report-btn';
    btn.textContent = 'hwpx파일로';
    btn.title = 'AI 응답을 HWPX 문서로 변환합니다';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      btn.textContent = '추출 중…';
      btn.disabled = true;

      var md = '';
      try { md = domToMd(el); } catch (err) { md = ''; }

      if (!md || !md.trim()) {
        btn.textContent = '추출 실패';
        btn.disabled = false;
        setTimeout(function () { btn.textContent = 'hwpx파일로'; }, 2000);
        return;
      }

      chrome.storage.local.set({ hwpxReportMd: md.trim() }, function () {
        if (chrome.runtime.lastError) {
          btn.textContent = '저장 실패';
          btn.disabled = false;
          setTimeout(function () { btn.textContent = 'hwpx파일로'; }, 2000);
          return;
        }
        chrome.runtime.sendMessage({ type: 'open-report-popup' }, function () {
          void chrome.runtime.lastError;
          btn.textContent = 'hwpx파일로';
          btn.disabled = false;
        });
      });
    });

    bar.appendChild(btn);
    var parent = el.parentElement;
    if (parent) parent.insertBefore(bar, el.nextSibling);
    else el.appendChild(bar);
  }

  function scan() {
    var containers = findContainers();
    for (var i = 0; i < containers.length; i++) {
      addButton(containers[i]);
    }
  }

  scan();
  var scanTimer = null;
  var observer = new MutationObserver(function () {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 600);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
