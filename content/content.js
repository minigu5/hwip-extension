'use strict';

/*
 * LaTeX → 한글(HWP) 수식 복사 — content script
 *
 * 수식(.katex)에 마우스를 올리면 오른쪽 아래 "HWP 복사" 버튼이 뜨고, 클릭하면
 * <annotation encoding="application/x-tex">의 원본 LaTeX를 변환·복사한다.
 * (강제 적용 모드에서는 MathJax · MathML도 지원)
 */
(function () {
  if (window.__hwpFormulaCopyInjected) return; // 중복 주입 방지
  window.__hwpFormulaCopyInjected = true;

  var BTN_LABEL = 'HWP 복사';

  // 강제 적용 사이트면 셀렉터와 추출 경로를 확장한다(content-forced.js 가 먼저 세팅).
  var FORCED_MODE = !!window.__hwpForceFullCompat;
  var HOVER_SELECTOR = FORCED_MODE
    ? '.katex, mjx-container, math'
    : '.katex';

  var currentKatex = null;
  var hideTimer = null;

  function convert(latex) {
    return (window.LatexToHwp && window.LatexToHwp.convert)
      ? window.LatexToHwp.convert(latex) : '';
  }
  function hasAnnotation(el) {
    return !!(el && el.querySelector('annotation[encoding="application/x-tex"]'));
  }
  // Gemini: .katex 부모 요소의 data-math 속성에 원본 LaTeX 저장
  function closestDataMath(el) {
    var cur = el;
    while (cur) {
      if (cur.getAttribute && cur.getAttribute('data-math')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  // 강제 모드 또는 알려진 추출 경로가 있으면 true
  function hasExtractable(el) {
    if (!el) return false;
    if (hasAnnotation(el)) return true;
    if (closestDataMath(el)) return true;  // Gemini
    if (!FORCED_MODE) return false;
    if (el.querySelector('script[type="math/tex"], script[type^="math/tex"]')) return true;
    if (el.tagName && el.tagName.toLowerCase() === 'math') return true;
    if (el.querySelector('math')) return true;
    return !!((el.textContent || '').trim());
  }

  // ── 클립보드 복사 (app.js copyText 패턴) ───────────────────────
  function copyText(text, onSuccess) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess, legacy);
    } else {
      legacy();
    }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        if (document.execCommand('copy') && onSuccess) onSuccess();
      } catch (err) { /* 복사 불가 환경 */ }
      document.body.removeChild(ta);
    }
  }

  // ── 공유 버튼 ──────────────────────────────────────────────────
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'hwp-copy-btn';
  btn.textContent = BTN_LABEL;
  document.documentElement.appendChild(btn);

  function positionRect(rect) {
    var bw = btn.offsetWidth || 64;
    var bh = btn.offsetHeight || 24;
    var left = rect.right - bw + 6;     // 수식 오른쪽 아래 모서리에 살짝 걸치도록
    var top = rect.bottom - 4;
    left = Math.max(4, Math.min(left, window.innerWidth - bw - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - bh - 4));
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
  }

  function showConvert(katex) {
    currentKatex = katex;
    btn.setAttribute('aria-label', '이 수식을 한글(HWP) 수식 문법으로 복사');
    resetLabel();
    btn.style.display = 'inline-flex';
    positionRect(katex.getBoundingClientRect());
  }
  function hide() { btn.style.display = 'none'; currentKatex = null; }
  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 220); }
  function cancelHide() { clearTimeout(hideTimer); }

  // 페이지 내 수식 컨테이너들을 문서 순서대로 수집(중첩 <math>는 부모 컨테이너로 흡수).
  // content-forced.js 가 채워둔 window.__hwpRawMathSources[i] 와 같은 인덱스로 매칭한다.
  function collectMathContainers() {
    var nodes = document.querySelectorAll('.katex, mjx-container, math');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var e = nodes[i];
      var tag = e.tagName && e.tagName.toLowerCase();
      // KaTeX 출력은 .katex > .katex-mathml > math 구조 — 안쪽 math는 .katex 로 흡수
      if (tag === 'math' && (e.closest('.katex') || e.closest('mjx-container'))) continue;
      out.push(e);
    }
    return out;
  }

  function indexOfContainer(el) {
    var container = (el.closest && (el.closest('.katex') || el.closest('mjx-container'))) ||
                    (el.tagName && el.tagName.toLowerCase() === 'math' ? el : null);
    if (!container) return -1;
    var all = collectMathContainers();
    return all.indexOf(container);
  }

  function extractLatex(el) {
    // 1) Gemini: 부모 요소의 data-math 속성에 원본 LaTeX 저장
    var dmEl = closestDataMath(el);
    if (dmEl) return dmEl.getAttribute('data-math').trim();
    // 2) KaTeX/MathJax 공통 — annotation 에 raw LaTeX
    var ann = el.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent) return ann.textContent.trim();
    // 2) 강제 모드 — MathJax v2 의 <script type="math/tex"> 에 raw LaTeX
    if (FORCED_MODE) {
      var sc = el.querySelector('script[type="math/tex"], script[type^="math/tex"]');
      if (sc && sc.textContent) return sc.textContent.trim();
    }
    // 3) 강제 모드 — content-forced.js 가 받아둔 raw 소스(.md 원문 등)에서 인덱스로 lookup
    if (FORCED_MODE && Array.isArray(window.__hwpRawMathSources) && window.__hwpRawMathSources.length) {
      var idx = indexOfContainer(el);
      if (idx >= 0 && idx < window.__hwpRawMathSources.length) {
        var rec = window.__hwpRawMathSources[idx];
        if (rec && rec.src) return rec.src;
      }
    }
    // 4) MathML <math> textContent
    var mml = (el.tagName && el.tagName.toLowerCase() === 'math') ? el : el.querySelector('math');
    if (mml && mml.textContent) return mml.textContent.trim();
    // 5) 마지막 폴백 — 보이는 텍스트 (시각 문자라 정확도 낮음)
    return (el.textContent || '').trim();
  }

  var labelTimer = null;
  function flash(msg) {
    clearTimeout(labelTimer);
    btn.textContent = msg;
    btn.classList.add('copied');
    labelTimer = setTimeout(resetLabel, 1200);
  }
  function resetLabel() {
    clearTimeout(labelTimer);
    btn.textContent = BTN_LABEL;
    btn.classList.remove('copied');
  }

  // ── 호버 변환 버튼 ─────────────────────────────────────────────
  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t === btn) { cancelHide(); return; }
    var el = t.closest(HOVER_SELECTOR);
    if (el && hasExtractable(el)) { cancelHide(); showConvert(el); }
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target;
    if (!t) return;
    if (t === btn || (t.closest && t.closest(HOVER_SELECTOR))) scheduleHide();
  });

  // fixed 좌표가 어긋나므로 스크롤/리사이즈 시 숨김 (다음 호버에서 재계산)
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  // ── 버튼 클릭 ──────────────────────────────────────────────────
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var latex = currentKatex ? extractLatex(currentKatex) : '';
    if (!latex) { flash('수식 없음'); return; }
    var hwp = convert(latex) || latex;
    if (!hwp) { flash('변환 실패'); return; }
    copyText(hwp, function () { flash('복사됨!'); });
  });
  btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
})();
