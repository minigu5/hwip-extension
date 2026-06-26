'use strict';

/* 팝업: 수동 LaTeX 입력 → hwip.vercel.app API → 출력 → 복사. */
(function () {
  var input = document.getElementById('input');
  var output = document.getElementById('output');
  var copyBtn = document.getElementById('copyBtn');
  var hint = document.getElementById('hint');
  var siteLinkBtn = document.getElementById('siteLinkBtn');

  if (siteLinkBtn) {
    siteLinkBtn.addEventListener('click', function (e) {
      e.preventDefault();
      var url = 'https://latex-to-hwp.vercel.app/';
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: url });
      } else {
        window.open(url, '_blank');
      }
    });
  }

  var API_URL = 'https://hwip.vercel.app/api/convert';
  var DEFAULT_HINT = hint.textContent;
  var hintTimer = null;
  var debounceTimer = null;

  function flashHint(msg) {
    clearTimeout(hintTimer);
    hint.textContent = msg;
    hint.classList.add('copied');
    hintTimer = setTimeout(function () {
      hint.textContent = DEFAULT_HINT;
      hint.classList.remove('copied');
    }, 1500);
  }

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
      } catch (e) { /* noop */ }
      document.body.removeChild(ta);
    }
  }

  function render() {
    var latex = input.value.trim();
    if (!latex) { output.textContent = ''; return; }
    output.textContent = '변환 중…';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latex: latex })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) { output.textContent = data.result || ''; })
      .catch(function() { output.textContent = '변환 실패 (네트워크 오류)'; });
    }, 300);
  }

  input.addEventListener('input', render);

  copyBtn.addEventListener('click', function () {
    copyText(output.textContent, function () {
      copyBtn.textContent = '복사됨!';
      copyBtn.classList.add('copied');
      flashHint('클립보드에 복사됨 ✓');
      setTimeout(function () {
        copyBtn.textContent = '복사';
        copyBtn.classList.remove('copied');
      }, 1200);
    });
  });

  render();
  input.focus();

  // ── 현재 페이지 상태 + 활성화 흐름 ─────────────────────────────
  // 자동 지원 사이트(manifest content_scripts.matches): 그대로 동작.
  // 그 외 페이지는 차단 사유별로 분기 — HTTPS는 권한 요청, file://는 토글 안내,
  // chrome://·웹스토어 등은 우회 불가 안내. 버튼 한 번 누르면 동일한 UX로 진행.
  var pageStatus = document.getElementById('pageStatus');
  var pageStatusText = document.getElementById('pageStatusText');
  var forceOnBtn = document.getElementById('forceOnBtn');
  var guidePanel = document.getElementById('guidePanel');
  var guideTitle = document.getElementById('guideTitle');
  var guideSteps = document.getElementById('guideSteps');
  var guideNote = document.getElementById('guideNote');
  var guideCloseBtn = document.getElementById('guideCloseBtn');
  var guideOpenBtn = document.getElementById('guideOpenBtn');

  if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
    if (pageStatus) pageStatus.hidden = true;
    return;
  }

  // ── 헬퍼 ────────────────────────────────────────────────────
  function matchToRegex(pattern) {
    if (pattern === '<all_urls>') return /^(https?|file):\/\//;
    var m = pattern.match(/^(\*|https?|file):\/\/([^\/]*)(\/.*)$/);
    if (!m) return null;
    var scheme = m[1] === '*' ? 'https?' : m[1];
    var host = m[2]
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/^\*\\\./, '([^/]+\\.)?')
      .replace(/\*/g, '[^/]*');
    var path = m[3]
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp('^' + scheme + '://' + host + path);
  }

  function setStatus(text, cls) {
    pageStatusText.textContent = text;
    pageStatus.className = 'page-status' + (cls ? ' ' + cls : '');
  }

  function hideGuide() { guidePanel.hidden = true; }

  function showGuide(opts) {
    guideTitle.textContent = opts.title || '';
    guideSteps.innerHTML = '';
    (opts.steps || []).forEach(function (step) {
      var li = document.createElement('li');
      // step에 <code> 태그가 포함될 수 있어 innerHTML 사용. 내용은 코드 안에서 통제.
      li.innerHTML = step;
      guideSteps.appendChild(li);
    });
    if (opts.note) { guideNote.textContent = opts.note; guideNote.hidden = false; }
    else { guideNote.hidden = true; }
    if (opts.openUrl) {
      guideOpenBtn.hidden = false;
      guideOpenBtn.textContent = opts.openLabel || '설정 페이지 열기';
      guideOpenBtn.onclick = function () { chrome.tabs.create({ url: opts.openUrl }); };
    } else {
      guideOpenBtn.hidden = true;
      guideOpenBtn.onclick = null;
    }
    guidePanel.hidden = false;
  }

  guideCloseBtn.addEventListener('click', hideGuide);

  var manifest = chrome.runtime.getManifest();
  var matches = (manifest.content_scripts && manifest.content_scripts[0] &&
    manifest.content_scripts[0].matches) || [];
  var INJECT_FILES = (manifest.content_scripts && manifest.content_scripts[0] &&
    manifest.content_scripts[0].js) || ['content/content.js'];
  var INJECT_CSS = (manifest.content_scripts && manifest.content_scripts[0] &&
    manifest.content_scripts[0].css) || ['content/content.css'];

  function probeInjected(tabId) {
    return chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: function () { return !!window.__hwpFormulaCopyInjected; }
    }).then(function (results) {
      return !!(results && results[0] && results[0].result);
    });
  }

  // 페이지 카테고리 분류
  // - auto: 정적 매칭 (자동 지원)
  // - https / http: 정상 권한 요청 흐름
  // - file: file URL 액세스 토글이 필요
  // - webstore: Chrome Web Store (정책 차단)
  // - internal: chrome://, chrome-extension://, edge://, view-source:, devtools:// 등 (정책 차단)
  // - unknown: 그 외 (about:blank 등)
  function classify(url) {
    if (!url) return 'unknown';
    if (/^https:\/\/chromewebstore\.google\.com/.test(url) ||
        /^https:\/\/chrome\.google\.com\/webstore/.test(url)) return 'webstore';
    if (/^https?:\/\//.test(url)) {
      if (matches.some(function (p) { var re = matchToRegex(p); return re && re.test(url); })) return 'auto';
      return 'web';
    }
    if (/^file:\/\//.test(url)) return 'file';
    if (/^(chrome|edge|brave|opera|vivaldi|chrome-extension|chrome-untrusted|view-source|devtools|about):/.test(url)) return 'internal';
    return 'unknown';
  }

  function isPdfUrl(url) {
    try {
      var u = new URL(url);
      return /\.pdf($|[?#])/i.test(u.pathname + u.search);
    } catch (e) { return false; }
  }

  // ── PDF 한계 경고 ───────────────────────────────────────────
  // Chrome 내장 PDF 뷰어는 chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/
  // iframe 안에서 동작 — 확장 스크립트가 그 iframe엔 닿지 않는다. 페이지 자체
  // 활성화는 가능하나 PDF 내부 수식 자동 감지는 안 됨을 안내.
  var PDF_NOTE = 'Chrome PDF 뷰어 내부는 격리된 iframe이라 PDF 안의 수식은 호버 감지가 안 됩니다. 텍스트를 선택해 복사한 뒤, 이 팝업 상단 입력창에 붙여넣어 변환하세요.';

  // ── 활성화 흐름들 ──────────────────────────────────────────
  function requestPermissionAndActivate(tab, originPattern) {
    forceOnBtn.disabled = true;
    forceOnBtn.textContent = '권한 요청 중…';
    chrome.permissions.request({ origins: [originPattern] }, function (granted) {
      if (chrome.runtime.lastError || !granted) {
        var reason = (chrome.runtime.lastError && chrome.runtime.lastError.message)
          || '권한이 거부되어 활성화할 수 없습니다.';
        setStatus(reason, 'disabled');
        forceOnBtn.disabled = false;
        forceOnBtn.textContent = '다시 시도';
        return;
      }
      setStatus('활성화 중…', '');
      forceOnBtn.textContent = '활성화 중…';
      var tries = 0;
      (function poll() {
        probeInjected(tab.id).then(function (ok) {
          if (ok) {
            setStatus('✓ 이 페이지에서 활성화됨. 새로고침해도 유지됩니다.', 'supported');
            forceOnBtn.hidden = true;
            return;
          }
          if (++tries < 8) { setTimeout(poll, 150); return; }
          setStatus('✓ 권한 부여 완료. 새로고침하면 활성화됩니다.', 'supported');
          forceOnBtn.hidden = true;
        }, function () {
          setStatus('✓ 권한 부여 완료. 새로고침하면 활성화됩니다.', 'supported');
          forceOnBtn.hidden = true;
        });
      })();
    });
  }

  function activateForFile(tab) {
    // 1) file URL 액세스 토글 확인 (chrome.extension은 popup에서 사용 가능)
    var allowed;
    try { allowed = chrome.extension.isAllowedFileSchemeAccess; } catch (e) { allowed = null; }
    if (!allowed) {
      // 구버전 호환 — 그냥 권한 요청 시도
      requestPermissionAndActivate(tab, 'file:///*');
      return;
    }
    chrome.extension.isAllowedFileSchemeAccess(function (ok) {
      if (!ok) {
        // 토글이 꺼져 있다 — 안내 + 설정 페이지 자동 오픈 + 권한도 같이 요청
        showFileAccessGuide();
        return;
      }
      // 토글이 켜져 있다 — 일반 권한 요청 흐름
      requestPermissionAndActivate(tab, 'file:///*');
    });
  }

  function showFileAccessGuide() {
    var extId = chrome.runtime.id;
    var settingsUrl = 'chrome://extensions/?id=' + extId;
    showGuide({
      title: '로컬 파일에서 켜려면 한 가지 설정이 필요합니다',
      steps: [
        '아래 <b>설정 페이지 열기</b> 버튼을 누르세요.',
        '열린 페이지에서 <code>파일 URL에 대한 액세스 허용</code> 토글을 켜세요.',
        '이 PDF/HTML 파일 탭으로 돌아와 새로고침하면 자동으로 활성화됩니다.'
      ],
      note: '이 토글은 Chrome 정책상 사용자가 직접 켜야 합니다. 확장이 자동으로 켤 수 없습니다.',
      openUrl: settingsUrl,
      openLabel: '설정 페이지 열기'
    });
    setStatus('파일 URL 액세스 허용이 필요합니다.', 'disabled');
    forceOnBtn.disabled = false;
    forceOnBtn.textContent = '다시 시도';
  }

  function showInternalPageGuide(url) {
    var isPdfLike = /\.pdf/i.test(url || '');
    showGuide({
      title: '이 페이지는 Chrome 보안 정책상 확장이 동작할 수 없습니다',
      steps: isPdfLike ? [
        '이 PDF를 컴퓨터에 <b>다운로드</b>하세요.',
        '다운로드한 파일을 Chrome으로 열면 <code>file://</code> 주소가 됩니다.',
        '그 페이지에서 다시 팝업을 열고 <b>이 페이지에서 켜기</b>를 누르세요. (필요 시 파일 URL 액세스 토글 안내가 한 번 더 뜹니다.)'
      ] : [
        '<code>chrome://</code>, 다른 확장 페이지, Chrome 웹 스토어 등은 어떤 확장도 스크립트를 넣을 수 없도록 Chrome이 막아둔 영역입니다.',
        '수식이 있는 일반 웹 페이지를 새 탭에서 여세요. 거기서 <b>이 페이지에서 켜기</b>가 동작합니다.',
        '급할 땐 수식 LaTeX를 복사해 이 팝업 상단 입력창에 직접 붙여넣어 변환할 수 있습니다.'
      ],
      note: isPdfLike
        ? '브라우저 안에서 보이는 PDF는 내장 PDF 뷰어 확장이 격리된 iframe으로 렌더링합니다. 외부 확장이 그 안에 접근할 방법은 없습니다.'
        : null
    });
    setStatus('이 페이지에서는 사용할 수 없습니다.', 'disabled');
    forceOnBtn.hidden = true;
  }

  // ── 진입점: 현재 탭 분류 후 분기 ───────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    var url = (tab && tab.url) || '';
    var kind = classify(url);

    if (kind === 'auto') {
      setStatus('✓ 이 페이지는 자동으로 지원됩니다.', 'supported');
      forceOnBtn.hidden = true;
      return;
    }

    // web/file/internal/webstore/unknown — 일단 버튼은 항상 보여준다.
    if (kind === 'web') {
      setStatus('현재 페이지 확인 중…', '');
      forceOnBtn.hidden = true;
      probeInjected(tab.id).then(function (injected) {
        if (injected) {
          setStatus('✓ 이 페이지에서 활성화됨. 수식 위에 마우스를 올려보세요.', 'supported');
          forceOnBtn.hidden = true;
        } else {
          setStatus(isPdfUrl(url)
            ? 'PDF 페이지입니다 — 켜기 후에도 PDF 내부엔 접근 못 함을 참고하세요.'
            : '자동 지원 목록에 없는 페이지입니다.', '');
          forceOnBtn.hidden = false;
          forceOnBtn.textContent = '이 페이지에서 켜기';
          forceOnBtn.disabled = false;
        }
      }, function () {
        setStatus('자동 지원 목록에 없는 페이지입니다.', '');
        forceOnBtn.hidden = false;
        forceOnBtn.textContent = '이 페이지에서 켜기';
      });

      forceOnBtn.onclick = function () {
        if (!tab || !tab.id) return;
        var u;
        try { u = new URL(url); } catch (e) {
          setStatus('활성화 실패: URL을 해석할 수 없습니다.', 'disabled');
          return;
        }
        var originPattern = u.protocol + '//' + u.hostname + '/*';
        requestPermissionAndActivate(tab, originPattern);
        if (isPdfUrl(url)) {
          showGuide({
            title: 'PDF 페이지에서의 동작 안내',
            steps: [
              '페이지 자체는 활성화됩니다.',
              'PDF 안의 수식은 텍스트로 선택·복사한 뒤 위 입력창에 붙여넣어 변환하세요.'
            ],
            note: PDF_NOTE
          });
        }
      };
      return;
    }

    if (kind === 'file') {
      setStatus(isPdfUrl(url)
        ? '로컬 PDF 파일입니다 — 켜려면 파일 URL 액세스가 필요할 수 있습니다.'
        : '로컬 파일 페이지입니다.', '');
      forceOnBtn.hidden = false;
      forceOnBtn.textContent = '이 페이지에서 켜기';
      forceOnBtn.disabled = false;
      // 이미 주입돼 있는지 확인
      if (tab && tab.id) {
        probeInjected(tab.id).then(function (injected) {
          if (injected) {
            setStatus('✓ 이 페이지에서 활성화됨.', 'supported');
            forceOnBtn.hidden = true;
          }
        }, function () { /* 무시 */ });
      }
      forceOnBtn.onclick = function () {
        if (!tab || !tab.id) return;
        activateForFile(tab);
        if (isPdfUrl(url)) {
          // PDF는 항상 한계를 함께 안내
          setTimeout(function () {
            if (guidePanel.hidden) {
              showGuide({
                title: '로컬 PDF에서의 동작 안내',
                steps: [
                  '페이지 자체는 활성화됩니다.',
                  'PDF 안의 수식은 텍스트로 선택·복사한 뒤 위 입력창에 붙여넣어 변환하세요.'
                ],
                note: PDF_NOTE
              });
            }
          }, 300);
        }
      };
      return;
    }

    if (kind === 'internal' || kind === 'webstore' || kind === 'unknown') {
      // 차단 페이지 — 버튼은 "활성화 방법 보기"로 바뀐다.
      setStatus(kind === 'webstore'
        ? 'Chrome 웹 스토어에서는 사용할 수 없습니다.'
        : '이 페이지에서는 사용할 수 없습니다.', 'disabled');
      forceOnBtn.hidden = false;
      forceOnBtn.disabled = false;
      forceOnBtn.textContent = '활성화 방법 보기';
      forceOnBtn.onclick = function () { showInternalPageGuide(url); };
      return;
    }
  });
})();
