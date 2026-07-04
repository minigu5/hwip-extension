'use strict';

(function () {
  var status = document.getElementById('status');
  var downloadBtn = document.getElementById('downloadBtn');
  var fontFamilySel = document.getElementById('fontFamily');
  var fontSizeSel = document.getElementById('fontSize');
  var loadLocalFontsBtn = document.getElementById('loadLocalFontsBtn');
  var fileNameInput = document.getElementById('fileNameInput');
  var previewContent = document.getElementById('previewContent');

  var md = '';
  var savedFont = '';

  var DEFAULT_FONTS = [
    '함초롬바탕', '함초롬돋움', '맑은 고딕', '바탕', '바탕체',
    '굴림', '굴림체', '돋움', '돋움체', '궁서', '궁서체',
    'HY헤드라인M', 'HY견고딕', 'HY견명조',
    'Noto Sans KR', 'Noto Serif KR', 'Nanum Gothic', 'Nanum Myeongjo',
    'Times New Roman', 'Arial'
  ];

  function setStatus(msg, cls) {
    status.textContent = msg;
    status.className = 'status' + (cls ? ' ' + cls : '');
  }

  function populateFontSelect(localFonts) {
    var prev = fontFamilySel.value;
    fontFamilySel.innerHTML = '';

    var defOpt = document.createElement('option');
    defOpt.value = ''; defOpt.textContent = '기본 (함초롬바탕)';
    fontFamilySel.appendChild(defOpt);

    function addGroup(label, list) {
      var g = document.createElement('optgroup');
      g.label = label;
      list.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f; o.textContent = f;
        g.appendChild(o);
      });
      fontFamilySel.appendChild(g);
    }

    addGroup('한글 기본 글꼴', DEFAULT_FONTS);

    if (localFonts && localFonts.length) {
      var seen = {};
      DEFAULT_FONTS.forEach(function (f) { seen[f] = true; });
      var extras = [];
      localFonts.forEach(function (f) {
        if (!seen[f]) { seen[f] = true; extras.push(f); }
      });
      extras.sort(function (a, b) { return a.localeCompare(b, 'ko'); });
      if (extras.length) {
        addGroup('내 PC 글꼴 (' + extras.length + ')', extras);
      }
    }

    var toSelect = prev || savedFont || '함초롬바탕';
    var found = Array.from(fontFamilySel.options).some(function (o) {
      if (o.value === toSelect) { o.selected = true; return true; }
      return false;
    });
    if (!found) fontFamilySel.value = '';
  }

  function tryAutoLoad() {
    if (!('queryLocalFonts' in window)) {
      loadLocalFontsBtn.disabled = true;
      loadLocalFontsBtn.title = '이 브라우저는 Local Font Access API를 지원하지 않습니다';
      return;
    }
    window.queryLocalFonts().then(function (fonts) {
      var familySet = {};
      fonts.forEach(function (f) { if (f.family) familySet[f.family] = true; });
      populateFontSelect(Object.keys(familySet));
      loadLocalFontsBtn.textContent = 'PC 글꼴 새로고침';
    }).catch(function () {});
  }

  if (loadLocalFontsBtn) {
    loadLocalFontsBtn.addEventListener('click', function () {
      if (!('queryLocalFonts' in window)) return;
      loadLocalFontsBtn.disabled = true;
      var origText = loadLocalFontsBtn.textContent;
      loadLocalFontsBtn.textContent = '불러오는 중…';
      window.queryLocalFonts().then(function (fonts) {
        var familySet = {};
        fonts.forEach(function (f) { if (f.family) familySet[f.family] = true; });
        populateFontSelect(Object.keys(familySet));
        loadLocalFontsBtn.textContent = 'PC 글꼴 새로고침';
        loadLocalFontsBtn.disabled = false;
      }).catch(function () {
        loadLocalFontsBtn.textContent = origText;
        loadLocalFontsBtn.disabled = false;
      });
    });
  }

  fontFamilySel.addEventListener('change', function () {
    chrome.storage.local.set({ 'mh.ext.font': fontFamilySel.value });
  });

  function extractMdTitle(text) {
    if (!text) return '';
    var m = text.match(/^#\s+(.+)/m);
    return m ? m[1].replace(/[*_`]/g, '').trim() : '';
  }

  function sanitizeFilename(name) {
    return (name || '').replace(/[\\/:*?"<>|\t\n\r]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'output';
  }

  // 마크다운 → A4 미리보기
  function renderPreview(mdText) {
    if (!mdText || !window.marked) {
      previewContent.innerHTML = '<div class="preview-placeholder">미리보기를 불러올 수 없습니다.</div>';
      return;
    }
    try {
      var html = window.marked.parse(mdText);
      previewContent.innerHTML = html;
      if (window.renderMathInElement) {
        try {
          renderMathInElement(previewContent, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
              { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
          });
        } catch (e) { /* KaTeX 오프라인 시 조용히 실패 */ }
      }
    } catch (e) {
      previewContent.innerHTML = '<div class="preview-placeholder">미리보기 렌더링 실패</div>';
    }
  }

  function doConvert() {
    if (!md) { setStatus('마크다운이 없습니다.', 'error'); return; }

    downloadBtn.disabled = true;
    downloadBtn.textContent = '변환 중…';
    setStatus('변환 중… (수식 포함 문서는 잠시 걸릴 수 있습니다)', '');

    var fontFamily = fontFamilySel.value;
    var fontSizePt = parseInt(fontSizeSel.value, 10) || 10;
    var templateUrl = chrome.runtime.getURL('templates/blank.hwpx');

    var deps = {
      JSZip: window.JSZip,
      marked: window.marked,
      LatexToHwp: window.LatexToHwp,
      DOMParser: window.DOMParser,
      XMLSerializer: window.XMLSerializer,
      templateUrl: templateUrl
    };

    var options = {};
    if (fontFamily) options.fontFamily = fontFamily;
    options.fontSizePt = fontSizePt;

    window.MarkdownToHwpx.convertMarkdown(md, options, deps)
      .then(function (blob) {
        var customName = fileNameInput ? fileNameInput.value.trim() : '';
        var stem = customName
          ? sanitizeFilename(customName)
          : extractMdTitle(md) || 'report';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = stem + '.hwpx';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 500);

        setStatus('변환 완료! 파일이 다운로드됩니다.', 'success');
        // 다운로드 후 사이드패널 닫기
        setTimeout(function () {
          chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            var tabId = tabs && tabs[0] && tabs[0].id;
            if (tabId && chrome.sidePanel) {
              chrome.sidePanel.setOptions({ tabId: tabId, enabled: false }, function () {
                void chrome.runtime.lastError;
              });
            }
          });
        }, 800);
      })
      .catch(function (err) {
        setStatus('변환 실패: ' + (err && err.message || String(err)), 'error');
        downloadBtn.textContent = '다시 시도';
        downloadBtn.disabled = false;
      });
  }

  downloadBtn.addEventListener('click', doConvert);

  function applyMd(newMd) {
    md = newMd;
    var preview = md.slice(0, 60).replace(/\n/g, ' ');
    setStatus('준비됨: ' + preview + (md.length > 60 ? '…' : ''), '');
    downloadBtn.disabled = false;
    if (fileNameInput && !fileNameInput.value.trim()) {
      var autoTitle = extractMdTitle(md);
      if (autoTitle) fileNameInput.value = autoTitle;
    }
    renderPreview(md);
  }

  function loadMd() {
    chrome.storage.local.get('hwpxReportMd', function (data) {
      if (chrome.runtime.lastError) {
        setStatus('저장소 오류: ' + chrome.runtime.lastError.message, 'error');
        downloadBtn.disabled = true;
        return;
      }
      var loaded = (data && data.hwpxReportMd) || '';
      if (!loaded) {
        if (!md) {
          setStatus('변환할 내용이 없습니다. 페이지에서 다시 버튼을 눌러주세요.', 'error');
          downloadBtn.disabled = true;
          previewContent.innerHTML = '<div class="preview-placeholder">AI 응답 아래의 <b>hwpx파일로</b> 버튼을 누르세요.</div>';
        }
        return;
      }
      chrome.storage.local.remove('hwpxReportMd');
      applyMd(loaded);
    });
  }

  // 이미 열려있는 사이드패널에 새 마크다운이 들어올 때 자동 갱신
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.hwpxReportMd && changes.hwpxReportMd.newValue) {
      var newMd = changes.hwpxReportMd.newValue;
      chrome.storage.local.remove('hwpxReportMd');
      if (fileNameInput) fileNameInput.value = '';
      applyMd(newMd);
    }
  });

  function init() {
    chrome.storage.local.get('mh.ext.font', function (data) {
      savedFont = (data && data['mh.ext.font']) || '';
      populateFontSelect();
      tryAutoLoad();
      // background에 ready 신호 → 대기 중인 md가 있으면 response로 바로 받음
      chrome.runtime.sendMessage({ type: 'sidepanel-ready' }, function (response) {
        void chrome.runtime.lastError;
        if (response && response.md) {
          applyMd(response.md);
        } else {
          loadMd();
        }
      });
    });
  }

  init();
})();
