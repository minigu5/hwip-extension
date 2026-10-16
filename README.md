# 휩 - LaTeX → 한글(HWP) 수식 복사 — 크롬 확장

[GitHub Repository (Separate)](https://github.com/minigu5/latex-to-hwp-extension) · [Chrome 웹 스토어에서 설치](https://chromewebstore.google.com/detail/meahkfhlalnljlgllhmhmfdhpkknfncg)

ChatGPT·Claude 답변의 수식 위에 마우스를 올리면 오른쪽 아래에 **"HWP 복사"** 버튼이 떠서,
클릭 한 번으로 한글(HWP) 수식 편집기 문법으로 변환해 클립보드에 복사한다.
확장 아이콘을 누르면 LaTeX를 직접 입력해 변환하는 팝업도 쓸 수 있다.

헤딩 2개 이상이거나 2000자를 넘는 **긴 AI 답변(보고서)**에는 별도로 **"HWPX로 변환"** 버튼이 떠서,
클릭하면 사이드패널이 열려 글꼴·글자크기·파일명을 설정하고 A4 미리보기(KaTeX 수식 렌더 포함)를
확인한 뒤 `.hwpx` 파일로 바로 다운로드할 수 있다. 두 기능은 팝업 설정 화면에서 각각
켜고 끌 수 있다("수식 변환 자동 감지" / "ai보고서 자동 감지").

## 왜 확장이 더 정확한가

ChatGPT·Claude는 수식을 **KaTeX**로 렌더링하며, 원본 LaTeX를 DOM의
`<annotation encoding="application/x-tex">` 안에 보존한다. 확장은 이 값을 직접 읽으므로
**위/아래 첨자 손실 없이** 원본 LaTeX를 그대로 추출한다. (웹앱에서 렌더된 수식을 복사할 때
첨자가 사라져 휴리스틱으로 복구하던 문제가 확장에서는 발생하지 않는다.)

## 동작 방식 (사이트별)

- **모든 지원 사이트 (ChatGPT·Claude·Gemini·Grok 등):** 수식에 마우스를 올리면 **"HWP 복사"** 버튼이 떠서 원본 LaTeX를 추출·변환·복사한다.
  - KaTeX + annotation 방식 (ChatGPT·Claude·Grok 등): `<annotation encoding="application/x-tex">` 에서 직접 추출.
  - Gemini: `<annotation>` 없이 부모 요소의 `data-math` 속성에 원본 LaTeX 저장 → 동일하게 호버 버튼으로 추출.

## AI 보고서 → HWPX 문서 변환

`content/report-extract.js`가 어시스턴트 답변 컨테이너(`CONTENT_SELECTORS`, 사이트별 셀렉터)를 감시하다가
헤딩(`h1~h4`) 2개 이상 또는 본문 2000자 이상이면 "보고서"로 판단해 **"HWPX로 변환"** 버튼을 띄운다.
(ChatGPT 캔버스가 열린 메시지는 중복 방지를 위해 버튼을 띄우지 않는다.)

버튼 클릭 → `open-report-popup` 메시지를 `background.js`로 보냄 → `chrome.sidePanel`로
`sidepanel/sidepanel.html`을 현재 탭에 연다 → 사이드패널이 `sidepanel-ready` 메시지로 대기 중인
마크다운을 받아 `lib/md-to-hwpx.js`(= 루트 `src/md-to-hwpx.js` 사본)로 변환한다.
사이드패널에서 글꼴(내 PC 글꼴 로드 지원)·글자크기·파일명을 조정하며 A4 미리보기(KaTeX 렌더 포함)로
확인 후 다운로드한다. `convert/` 폴더는 사이드패널 도입 전의 팝업 UI로 현재 manifest·background.js
어디에서도 참조되지 않는 미사용 코드다.

## 설치

**권장:** [Chrome 웹 스토어](https://chromewebstore.google.com/detail/meahkfhlalnljlgllhmhmfdhpkknfncg)에서 "Chrome에 추가"를 누르면 된다.

### 개발자 모드로 설치 (소스에서 직접)

1. 크롬에서 `chrome://extensions` 접속
2. 우측 상단 **개발자 모드** 켜기
3. **압축해제된 확장 프로그램 로드** → 이 `chrome-extension/` 폴더 선택

## 구조

```
manifest.json               MV3 매니페스트 (AI 사이트에 content script 주입, side_panel 등록)
background.js               사이드패널 열기/닫기, 동적 content script 등록·권한 동기화
lib/converter.js            ⚠️ src/converter.js 의 사본 (직접 수정 금지)
lib/md-to-hwpx.js           ⚠️ src/md-to-hwpx.js 의 사본 (직접 수정 금지)
lib/i18n.js                 popup/sidepanel 공용 다국어 헬퍼 (hwpT, data-i18n* 치환)
_locales/ko, _locales/en    UI 문자열 (ko = 기본 언어, en = 영어). manifest 의 __MSG_*__ 와 JS 메시지가 참조
content/content.js          호버 감지 + LaTeX 추출 + 변환·복사 (플로팅 "HWP 복사" 버튼)
content/content-forced.js   자동 지원 목록 밖 페이지에 수동 주입되는 버전
content/content.css         플로팅 버튼 스타일
content/report-extract.js   AI 보고서 감지 + "HWPX로 변환" 버튼 삽입
popup/                      확장 아이콘 팝업 — 수동 LaTeX 입력 UI + 설정(자동 감지 토글 2종) + 페이지 상태
sidepanel/                  "HWPX로 변환" 클릭 시 열리는 사이드패널 — 글꼴/크기/파일명 + A4 미리보기 + 다운로드
convert/                    (미사용) 사이드패널 도입 전 레거시 팝업 UI, manifest에서 참조 안 함
templates/blank.hwpx        md-to-hwpx.js가 기반으로 쓰는 빈 HWPX 템플릿
icons/                      16/48/128 아이콘
```

## 다국어 (한국어 / English)

브라우저 UI 언어가 한국어면 한국어, 영어면 영어로 표시된다. 그 외 언어는 기본 언어(ko)로 폴백한다.

- 문자열은 `_locales/<언어>/messages.json` 에 있다. **새 문자열은 ko·en 둘 다에 추가**할 것.
- manifest 는 `__MSG_extName__` 처럼 참조한다. (`default_locale: "ko"`)
- popup·sidepanel HTML 은 `data-i18n`(텍스트) / `data-i18n-html` / `data-i18n-title` / `data-i18n-placeholder` 속성을 쓰고 `lib/i18n.js` 가 치환한다. JS 는 `window.hwpT('key')`.
- content script 는 `hwpMsg('key', '한국어 폴백')` 로컬 헬퍼를 쓴다 (chrome.i18n 실패 시 한국어로 표시).
- messages.json 에서 리터럴 `$` 는 `$$` 로 써야 한다 (플레이스홀더 문법).
- 번역 대상이 아닌 것: `lib/md-to-hwpx.js` 가 만드는 문서 안 문구(예: 이미지 자리표시자 `[그림: …]`), 한글 글꼴 이름.

## 변환 로직 동기화

`lib/converter.js`·`lib/md-to-hwpx.js`는 프로젝트 루트 `src/converter.js`·`src/md-to-hwpx.js`의
**사본**이다. `npm run sync:ext` 같은 자동 스크립트는 없다 — 원본을 고치면 루트에서 수동 복사한다:

```bash
cp src/converter.js chrome-extension/lib/converter.js
cp src/md-to-hwpx.js chrome-extension/lib/md-to-hwpx.js
```

## 지원 사이트

ChatGPT·Claude·Gemini·AI Studio·Perplexity·Copilot·Bing·Poe·DeepSeek·Mistral·Grok(grok.com, x.com)·
HuggingChat·Phind·You.com·ChatGLM·Tongyi·Doubao·Kimi 등 주요 AI 사이트에 **자동 주입**된다
(전체 목록은 `manifest.json`의 `content_scripts.matches`).

### 목록에 없는 페이지 — 강제 On

자동 지원 목록에 없는 페이지에서는 **확장 아이콘 → "이 페이지에서 켜기"** 버튼으로
현재 탭에 수동 주입할 수 있다(`activeTab` + `scripting` 권한, `chrome.scripting.executeScript`).
팝업은 현재 탭 URL을 manifest의 `matches`와 대조해 상태(자동 지원 / 강제 On 가능 / 사용 불가)를 표시한다.

(KaTeX를 쓰는 사이트면 어디서든 동작한다. MathJax 기반 사이트는 원본 TeX 보존이 불확실해
별도 대응이 필요 — 추후 확장.)

### 브라우저 내부 / 로컬 파일 페이지

- **로컬 파일(`file://`)** — 팝업의 켜기 버튼이 `file:///*` 호스트 권한을 요청한다.
  Chrome의 "파일 URL에 대한 액세스 허용" 토글이 꺼져 있으면 안내 패널과 함께 설정 페이지
  (`chrome://extensions/?id=<ID>`)를 열어 한 번에 활성화할 수 있게 가이드한다.
- **`chrome://`, 다른 확장 페이지, Chrome 웹 스토어** — Chrome 정책상 어떤 확장도 스크립트를
  넣을 수 없는 영역이라 우회 불가. 버튼을 누르면 "활성화 방법 보기" 안내 패널이 뜨고,
  PDF인 경우 다운로드 → 로컬 파일로 열기 우회법을 제시한다.
- **PDF 페이지(`*.pdf`)** — Chrome 내장 PDF 뷰어는 격리된 `chrome-extension://mhjfb…/`
  iframe에서 동작하므로 PDF 내부 텍스트엔 직접 접근하지 못한다. 페이지 자체 활성화는
  되지만, PDF 안의 수식은 사용자가 선택·복사해 팝업 입력창에 붙여넣는 흐름을 안내한다.
