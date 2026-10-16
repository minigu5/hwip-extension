# 크롬 웹 스토어 등록 문안 — 휩 (v0.7.7)

> 대시보드(개발자 콘솔) 입력용 초안. 한국어가 기본 언어, 영어는 현지화 탭에 입력.

## 이름 (manifest `name` 과 동일)
- 한국어: `휩 - AI to 한글(HWP)`
- English: `Hwip - AI to HWP`  ← `_locales/en` 에서 자동 반영됨 (대시보드 입력 불필요)

## 요약 (132자 이내, manifest `description` 과 동일)
- 한국어: `AI 사이트 수식에 마우스 올리면 한글(HWP) 수식 문법으로 변환·복사. 긴 AI 보고서 답변은 감지해 HWPX 문서로 바로 변환합니다.`
- English: `Hover over math on AI sites to copy it as HWP equation syntax. Turn long AI answers into HWPX documents in one click.`  ← `_locales/en` 에서 자동 반영됨

## 자세한 설명 (한국어)
```
ChatGPT, Claude, Gemini 같은 AI가 알려준 수식을 한글(HWP)에 붙여넣으면 깨지나요?
휩은 AI 답변 속 LaTeX 수식을 한글 수식 편집기 문법으로 바꿔 줍니다.

■ 수식 호버 복사
AI 답변의 수식 위에 마우스를 올리면 "HWP 복사" 버튼이 나타납니다. 한 번 클릭하면 한글 수식 편집기에 바로 붙여넣을 수 있는 형태로 변환해 클립보드에 복사합니다. 렌더된 화면을 긁어 복사할 때 사라지는 위·아래 첨자 정보도 원본 LaTeX에서 읽어 오므로 손실이 없습니다.

■ 긴 답변 → HWPX 문서
제목이 2개 이상이거나 긴 보고서형 답변 아래에 "hwpx파일로" 버튼이 나타납니다. 누르면 사이드패널이 열려 글꼴, 글자 크기, 파일명을 정하고 A4 미리보기(수식 렌더링 포함)를 확인한 뒤 .hwpx 파일로 다운로드할 수 있습니다. 제목·목록·표·코드 블록·수식 서식이 유지됩니다.

■ 수동 변환 팝업
확장 아이콘을 눌러 LaTeX를 직접 입력하면 한글 수식으로 자동 변환됩니다.

■ 지원 사이트
ChatGPT, Claude, Gemini, Google AI Studio, Perplexity, Grok, DeepSeek, Poe, Mistral 등. 목록에 없는 페이지는 확장 팝업의 "이 페이지에서 켜기"로 직접 활성화할 수 있습니다.

■ 참고
- 호버 복사와 보고서 변환은 팝업 설정에서 각각 켜고 끌 수 있습니다.
- 웹 버전(붙여넣기·이미지 OCR·파일 변환)도 제공됩니다: https://hwip.vercel.app
```

## Detailed description (English)
```
Pasting math from ChatGPT, Claude or Gemini into HWP breaks it, because LaTeX and the HWP equation editor use different syntax. Hwip converts it for you.

* Hover to copy: hover over any equation in an AI answer and click "Copy HWP" to copy it as HWP equation-editor syntax. The original LaTeX is read from the page, so sub/superscripts are never lost.
* Long answers to HWPX: a button appears under report-style answers. Pick a font, size and file name, check an A4 preview (math rendered), and download a .hwpx document with headings, lists, tables, code blocks and equations preserved.
* Manual popup: type LaTeX into the toolbar popup and get HWP equation syntax instantly.
* Works on ChatGPT, Claude, Gemini, Google AI Studio, Perplexity, Grok, DeepSeek, Poe, Mistral and more. Enable any other page from the popup.

Web version (paste, image OCR, file conversion): https://hwip.vercel.app
```

## 카테고리 / 언어
- 카테고리: 생산성 (Productivity)
- 언어: 한국어 (기본), English

## 그래픽 자산 (`store/out/`)
| 용도 | 파일 | 크기 |
|---|---|---|
| 스토어 아이콘 | `store/store-icon-128.png` | 128×128 (96px 아트 + 16px 투명 여백) |
| 스크린샷 1~5 | `out/screenshot-1.png` … `screenshot-5.png` | 1280×800 |
| 작은 프로모션 타일 | `out/promo-small-440x280.png` | 440×280 |
| 마키 프로모션 타일 | `out/promo-marquee-1400x560.png` | 1400×560 |

스크린샷 순서 권장: 1 수식 호버 복사 → 2 보고서→HWPX 버튼 → 3 사이드패널 미리보기 → 4 수동 변환 팝업 → 5 지원 사이트.

## 개인정보 보호(Privacy practices) 탭

**단일 목적 설명**: AI 챗봇 답변 속 LaTeX 수식과 보고서를 한컴 한글(HWP) 수식 문법·HWPX 문서로 변환한다.

**권한 사유**
| 권한 | 사유 |
|---|---|
| `host_permissions` (AI 사이트들) | 해당 사이트의 응답에서 렌더된 수식과 보고서 본문을 읽고, 변환 버튼을 표시하기 위해 |
| `host_permissions` `https://hwip.vercel.app/*` | 수식 LaTeX 텍스트를 한글 수식 문법으로 변환하는 API 호출 |
| `clipboardWrite` | 변환된 수식을 클립보드에 복사 |
| `clipboardRead` | Google AI Studio의 "Copy as markdown" 결과를 읽어 보고서 변환에 사용 |
| `storage` | 설정(기능 켜기/끄기, 글꼴) 저장, 추출한 마크다운을 사이드패널로 일시 전달 |
| `sidePanel` | HWPX 변환 설정·미리보기·다운로드 UI 표시 |
| `scripting` / `activeTab` | 사용자가 "이 페이지에서 켜기"를 눌렀을 때만 해당 탭에 스크립트 주입 |
| `optional_host_permissions` | 목록에 없는 페이지를 사용자가 직접 활성화할 때만 요청 |

**데이터 사용 공개 (처리방침 개정 반영)**
- 개인정보 처리방침 URL: `https://hwip.vercel.app/privacy.html` — **메인 저장소를 푸시해 Vercel 배포가 끝난 뒤** 제출할 것(배포 전에는 옛 문구가 보인다).
- 수집·전송 데이터 유형: **웹사이트 콘텐츠**(수식 LaTeX 텍스트가 변환을 위해 `hwip.vercel.app` 으로 전송됨)에 체크. 개인 식별 정보·건강·금융·인증·위치·웹 기록·사용자 활동은 체크하지 않음.
- 인증 항목 3개 모두 체크: 승인된 용도 외 사용·전송 안 함 / 목적과 무관한 용도로 사용·전송 안 함 / 신용도·대출 목적으로 사용·전송 안 함.
- 원격 코드 사용: **아니요** (모든 스크립트가 패키지에 포함됨. CDN에서는 사이드패널 KaTeX 스타일시트만 불러옴).
