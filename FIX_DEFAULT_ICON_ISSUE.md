# 기본 Electron 아이콘 문제 해결 가이드

## 문제 설명

Microsoft Store 제출 시 다음 오류로 거절될 수 있습니다:
- **"The available product tile icons include a default image"**
- 앱이 Electron 프레임워크의 기본 아이콘(원자 모양)을 사용하고 있음

## 원인

electron-builder가 `build/appx/assets/` 폴더의 아이콘을 찾지 못하거나, 빌드 전에 아이콘이 준비되지 않았을 때 기본 Electron 아이콘이 포함됩니다.

## 해결 방법

### 1. 필수 아이콘 확인

빌드 전에 다음 아이콘이 모두 존재하는지 확인:

```bash
# 필수 아이콘 확인
ls -la build/appx/assets/ | grep -E "(Square44x44|Square150x150|StoreLogo)"
```

필수 아이콘:
- ✅ `Square44x44Logo.png` (AppList 로고 - Policy 10.1.1.11 필수)
- ✅ `Square150x150Logo.png` (기본 타일 - Policy 10.1.1.11 필수)
- ✅ `StoreLogo.png` (스토어 로고 - Policy 10.1.1.11 필수)
- ✅ 기타 타일 크기 (50x50, 71x71, 89x89, 107x107, 142x142, 284x284, 310x310, Wide310x150)

### 2. 아이콘 생성 및 준비

빌드 전에 반드시 아이콘을 생성하고 준비해야 합니다:

```bash
# AppX 자산 준비 (아이콘 생성 + 복사)
npm run build:appx-assets
```

이 명령어는:
1. `assets/windows.png`를 기반으로 모든 스토어 아이콘 생성
2. 필수 AppX 아이콘을 `build/appx/assets/` 폴더로 복사

### 3. 올바른 빌드 워크플로우

**❌ 잘못된 방법:**
```bash
npm run build:ms-store  # 아이콘이 없으면 기본 Electron 아이콘이 포함됨
```

**✅ 올바른 방법:**
```bash
# 방법 1: build:ms-store는 자동으로 아이콘을 준비합니다
npm run build:ms-store

# 방법 2: 수동으로 준비 후 빌드
npm run build:appx-assets
npm run build:win:store
```

### 4. electron-builder.json5 설정 확인

`electron-builder.json5`의 설정이 올바른지 확인:

```json5
{
  "directories": {
    "buildResources": "build"  // build/appx/assets/ 폴더를 찾습니다
  },
  "appx": {
    // electron-builder는 build/appx/assets/ 폴더를 자동으로 감지합니다
    // 모든 아이콘이 빌드 전에 준비되어 있어야 합니다
  }
}
```

### 5. 빌드된 패키지 검증

빌드 후 생성된 `.appx` 파일을 확인:

1. `.appx` 파일을 `.zip`으로 이름 변경
2. 압축 해제
3. `AppxManifest.xml` 파일 확인
4. `Assets/` 폴더에 올바른 아이콘이 포함되어 있는지 확인

## 체크리스트

빌드 전 확인사항:

- [ ] `npm run build:appx-assets` 실행 완료
- [ ] `build/appx/assets/Square44x44Logo.png` 존재 확인
- [ ] `build/appx/assets/Square150x150Logo.png` 존재 확인
- [ ] `build/appx/assets/StoreLogo.png` 존재 확인
- [ ] 모든 아이콘 파일이 PNG 형식인지 확인
- [ ] 아이콘 파일 이름이 정확한지 확인 (대소문자 포함)
- [ ] `build/appx/assets/` 폴더에 총 11개 아이콘이 있는지 확인

## 문제 해결

### 문제: 여전히 기본 Electron 아이콘이 포함됨

**해결:**
1. `build/appx/assets/` 폴더를 완전히 삭제
2. `npm run build:appx-assets` 재실행
3. 모든 아이콘이 올바르게 생성되었는지 확인
4. 빌드 전에 `build/appx/assets/` 폴더 내용 확인

### 문제: 아이콘이 빌드에 포함되지 않음

**해결:**
1. `electron-builder.json5`의 `buildResources` 설정 확인
2. `build/appx/assets/` 폴더 경로 확인
3. 파일 이름이 정확한지 확인 (대소문자 포함)
4. 빌드 로그에서 아이콘 관련 오류 확인

## 참고 자료

- [Microsoft Store Policy 10.1.1.11](https://learn.microsoft.com/en-us/windows/uwp/publish/store-policies)
- [electron-builder AppX Configuration](https://www.electron.build/configuration/appx)
- [UWP App Icons and Logos](https://learn.microsoft.com/en-us/windows/apps/design/style/app-icons-and-logos)
