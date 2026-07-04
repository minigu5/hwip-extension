'use strict';

(function () {
  var status = document.getElementById('status');
  var downloadBtn = document.getElementById('downloadBtn');
  var fontFamilySel = document.getElementById('fontFamily');
  var fontSizeSel = document.getElementById('fontSize');
  var loadLocalFontsBtn = document.getElementById('loadLocalFontsBtn');
  var fileNameInput = document.getElementById('fileNameInput');

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

  function loadLocalFonts() {
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
  }

  // 이미 허용된 경우 자동 로드, 아직 미허용이면 조용히 건너뜀
  function tryAutoLoad() {
    if (!('queryLocalFonts' in window)) {
      loadLocalFontsBtn.disabled = true;
      loadLocalFontsBtn.title = '이 브라우저는 Local Font Access API를 지원하지 않습니다';
      return;
    }
    // queryLocalFonts를 직접 호출 — 이미 허용됐으면 프롬프트 없이 바로 반환
    // 아직 허용 안 됐으면 NotAllowedError로 거부되므로 catch에서 조용히 처리
    window.queryLocalFonts().then(function (fonts) {
      var familySet = {};
      fonts.forEach(function (f) { if (f.family) familySet[f.family] = true; });
      populateFontSelect(Object.keys(familySet));
      loadLocalFontsBtn.textContent = 'PC 글꼴 새로고침';
    }).catch(function () {
      // 아직 미허용 — 버튼으로 명시적 요청 대기
    });
  }

  if (loadLocalFontsBtn) {
    // 버튼 클릭 시 직접 queryLocalFonts() 호출 — 브라우저가 권한 프롬프트 표시
    loadLocalFontsBtn.addEventListener('click', function () {
      if (!('queryLocalFonts' in window)) return;
      loadLocalFonts();
    });
  }

  fontFamilySel.addEventListener('change', function () {
    chrome.storage.local.set({ 'mh.ext.font': fontFamilySel.value });
    if (md && !downloadBtn.disabled) {
      setStatus('설정을 변경했습니다. 다운로드 버튼을 누르세요.', '');
    }
  });
  fontSizeSel.addEventListener('change', function () {
    if (md && !downloadBtn.disabled) {
      setStatus('설정을 변경했습니다. 다운로드 버튼을 누르세요.', '');
    }
  });

  function extractMdTitle(text) {
    if (!text) return '';
    var m = text.match(/^#\s+(.+)/m);
    return m ? m[1].replace(/[*_`]/g, '').trim() : '';
  }

  function sanitizeFilename(name) {
    return (name || '').replace(/[\\/:*?"<>|\t\n\r]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'output';
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
        downloadBtn.textContent = '다시 다운로드';
        downloadBtn.classList.add('success');
        downloadBtn.disabled = false;
        setTimeout(function () {
          downloadBtn.classList.remove('success');
          downloadBtn.textContent = '다운로드';
        }, 2500);
      })
      .catch(function (err) {
        setStatus('변환 실패: ' + (err && err.message || String(err)), 'error');
        downloadBtn.textContent = '다시 시도';
        downloadBtn.disabled = false;
      });
  }

  downloadBtn.addEventListener('click', doConvert);

  // 저장된 글꼴 복원 후 초기화
  function init() {
    chrome.storage.local.get('mh.ext.font', function (data) {
      savedFont = (data && data['mh.ext.font']) || '';
      populateFontSelect();
      tryAutoLoad();
      loadMd();
    });
  }

  function loadMd() {
    chrome.storage.local.get('hwpxReportMd', function (data) {
      if (chrome.runtime.lastError) {
        setStatus('저장소 오류: ' + chrome.runtime.lastError.message, 'error');
        downloadBtn.disabled = true;
        return;
      }
      md = (data && data.hwpxReportMd) || '';
      if (!md) {
        setStatus('변환할 내용이 없습니다. 페이지에서 다시 버튼을 눌러주세요.', 'error');
        downloadBtn.disabled = true;
      } else {
        chrome.storage.local.remove('hwpxReportMd');
        var preview = md.slice(0, 60).replace(/\n/g, ' ');
        setStatus('준비됨: ' + preview + (md.length > 60 ? '…' : ''), '');
        downloadBtn.disabled = false;
        if (fileNameInput && !fileNameInput.value.trim()) {
          var autoTitle = extractMdTitle(md);
          if (autoTitle) fileNameInput.value = autoTitle;
        }
      }
    });
  }

  init();
})();
