# 휩 Windows 보조 프로그램

웹 브라우저가 한글의 네이티브 수식 개체 클립보드 형식을 직접 만들 수 없기 때문에, 설치형 한글 Automation을 이용해 수식 개체를 만들고 클립보드에 복사하는 작은 로컬 프로그램이다.

## 사용자 흐름

1. `HwipCompanion.exe`를 내려받아 실행하고 **예**를 눌러 설치한다.
2. 목록에서 휩 확장을 사용할 Chrome 프로필을 선택한다.
3. 선택한 각 프로필에서 열린 크롬 웹스토어의 **Chrome에 추가**를 한 번씩 누른다.
4. 휩 확장 설정에서 **Windows 수식 개체 변환**을 켠 뒤 수식을 복사한다.
5. 한글 본문에서 `Ctrl+V`를 누른다.

문단 전체를 옮기려면 ChatGPT·Gemini 등에서 텍스트와 수식이 섞인 영역을 선택해 `Ctrl+C`를 누른 뒤, 변환 완료 알림이 뜨면 한글에서 `Ctrl+V`를 누른다. 텍스트는 일반 본문으로, 수식은 각각 편집 가능한 한글 수식 개체로 붙는다.

변환된 클립보드는 한글 전용 `Hwp Native` 형식과 원래 선택한 일반 텍스트를 동시에 가진다. 한글에 붙이면 수식 개체를 사용하고, Codex·메모장·브라우저 입력창 같은 다른 프로그램에 붙이면 수식이 생략되지 않은 원문 텍스트를 사용한다.

설치 프로그램은 `%LOCALAPPDATA%\Hwip\HwipCompanion.exe`에 자신을 복사하고 현재 사용자 시작 프로그램에 등록한다. 관리자 권한은 필요하지 않다. 설치하지 않고 이번에만 실행하려면 첫 화면에서 **아니요**를 누른다.

보조 프로그램은 클립보드를 감시하거나 복사한 문자열을 추측해 변환하지 않는다. 사용자가 확장에서 기능을 명시적으로 켜고 복사했을 때 확장이 로컬 HTTP API로 보낸 요청만 처리한다. 변환이 실패하면 브라우저가 복사한 원문은 그대로 유지된다.

프로그램은 작업 표시줄 알림 영역에서 실행된다. 종료하려면 알림 영역 아이콘을 우클릭해 **종료**를 선택한다.
같은 메뉴에서 Windows 자동 실행을 끄거나 Chrome 프로필 선택 창을 다시 열 수 있다.
직접 종료할 때는 HWP 수식 복사와 수식 개체 자동 변환을 이용할 수 없다는 확인창이 표시되며, 기본 선택은 **아니요(계속 실행)**이다.

## 보안 경계

- `127.0.0.1:38473`에만 바인딩하며 외부 네트워크에서는 접근할 수 없다.
- 웹스토어 휩 확장 Origin(`chrome-extension://meahkfhlalnljlgllhmhmfdhpkknfncg`)과 `https://hwip.dshs.dev`만 기본 허용한다.
- 개발용 unpacked 확장은 실행 옵션으로 Origin을 명시한 경우에만 허용한다.
- 임의 한글 Automation 명령을 받지 않고 수식 개체 생성·복사만 제공한다.
- 요청 내용은 PC 안에서만 처리하며 저장하거나 외부로 전송하지 않는다.
- HTTP 본문 1MB, 수식 50,000자, 처리 15초, 동시 처리 1건으로 제한한다.
- 프로그램 종료 시 숨겨진 한글 Automation 인스턴스도 종료한다.

## 빌드

Windows PowerShell에서 다음을 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File companion/windows/build.ps1
```

Windows에 포함된 .NET Framework C# 컴파일러를 사용하며 별도 패키지를 내려받지 않는다. 결과물은 `companion/windows/dist/HwipCompanion.exe`와 SHA-256 파일이다.

개발용 unpacked 확장과 시험할 때만 해당 확장 ID를 명시해 portable 모드로 실행한다.

```powershell
.\companion\windows\dist\HwipCompanion.exe --portable --extension-origin=chrome-extension://개발용확장ID
```

## API

- `GET /health`
- `POST /v1/equation/copy` — `{ "equation": "{a} over {b}" }`
- `POST /v1/fragment/copy` — `{ "segments": [{ "type": "text|equation", "value": "..." }], "fallbackText": "..." }`

브라우저의 Private Network Access preflight를 위해 `OPTIONS`와 `Access-Control-Allow-Private-Network: true`를 지원한다.
