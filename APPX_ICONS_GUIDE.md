# Microsoft Store AppX 아이콘 설정 가이드

이 문서는 Microsoft Store (AppX) 제출 시 필요한 아이콘 설정과 Policy 10.1.1.11 (On Device Tiles) 준수 방법을 설명합니다.

## 🎯 문제 해결: Policy 10.1.1.11

Microsoft Store 제출 시 **"10.1.1.11 On Device Tiles"** 피드백으로 거절되는 경우, 다음을 확인하세요:

1. ✅ **Square44x44Logo.png** (AppList 로고) - 필수
2. ✅ **Square150x150Logo.png** (기본 타일) - 필수
3. ✅ **StoreLogo.png** (스토어 로고) - 필수
4. ✅ 모든 필수 아이콘 크기 포함

## 📁 파일 구조

```
build/
  ├── store-icons/          # 생성된 모든 스토어 이미지 (원본)
  │   ├── Square44x44Logo.png
  │   ├── Square150x150Logo.png
  │   └── ... (23개 파일)
  └── appx/
      └── assets/           # electron-builder가 사용하는 AppX 아이콘
          ├── Square44x44Logo.png    ⭐ 필수 (AppList)
          ├── Square50x50Logo.png
          ├── Square71x71Logo.png
          ├── Square89x89Logo.png
          ├── Square107x107Logo.png
          ├── Square142x142Logo.png
          ├── Square150x150Logo.png  ⭐ 필수
          ├── Square284x284Logo.png
          ├── Square310x310Logo.png
          ├── Wide310x150Logo.png
          └── StoreLogo.png          ⭐ 필수
```

## 🔧 설정 방법

### 1. electron-builder.json5 설정

`electron-builder.json5`의 `appx` 섹션은 기본 설정만 포함합니다:

```json5
"appx": {
  // ... 기타 설정 (publisher, identityName, etc.) ...
  "backgroundColor": "#020617",
  "displayName": "LoopMate"
  // Note: electron-builder automatically detects icons from build/appx/assets/ folder
  // Required icons are automatically included if present in build/appx/assets/
}
```

**중요**: electron-builder 24.13.3은 `assets`와 `visualElements` 속성을 지원하지 않습니다. 대신 `build/appx/assets/` 폴더에 올바른 이름의 아이콘 파일이 있으면 자동으로 감지하여 사용합니다.

### 2. 아이콘 생성 및 준비

#### 방법 1: 자동화된 스크립트 사용 (권장)

```bash
# 모든 스토어 이미지 생성 + AppX 자산 준비
npm run build:appx-assets
```

이 명령어는 다음을 수행합니다:
1. `npm run generate:store-icons` - 모든 스토어 이미지 생성
2. `npm run prepare:appx-assets` - AppX에 필요한 아이콘을 올바른 위치로 복사

#### 방법 2: 단계별 실행

```bash
# 1. 스토어 이미지 생성
npm run generate:store-icons

# 2. AppX 자산 준비
npm run prepare:appx-assets
```

### 3. AppX 빌드

```bash
# Microsoft Store용 AppX 빌드 (자산 자동 준비 포함)
npm run build:ms-store
```

또는

```bash
# 수동으로 자산 준비 후 빌드
npm run build:appx-assets
npm run build:win:store
```

## 📋 필수 아이콘 목록

| 아이콘 이름 | 크기 | 용도 | 필수 여부 |
|------------|------|------|----------|
| **Square44x44Logo.png** | 44×44 | AppList 로고 (시작 메뉴, 검색 결과) | ⭐ **필수** |
| Square50x50Logo.png | 50×50 | 작은 타일 | 권장 |
| Square71x71Logo.png | 71×71 | 작은 타일 | 권장 |
| Square89x89Logo.png | 89×89 | 중간 타일 | 권장 |
| Square107x107Logo.png | 107×107 | 큰 타일 | 권장 |
| Square142x142Logo.png | 142×142 | 큰 타일 | 권장 |
| **Square150x150Logo.png** | 150×150 | 기본 타일 | ⭐ **필수** |
| Square284x284Logo.png | 284×284 | 큰 타일 | 권장 |
| Square310x310Logo.png | 310×310 | 큰 타일 | 권장 |
| Wide310x150Logo.png | 310×150 | 와이드 타일 | 권장 |
| **StoreLogo.png** | 50×50 | 스토어 로고 | ⭐ **필수** |

## ⚠️ 중요 사항

### 1. 파일 이름 규칙

- **대소문자 정확히 일치**: `Square44x44Logo.png` (대문자 S, 대문자 L)
- **확장자**: 반드시 `.png`
- **이름 변경 금지**: electron-builder가 정확한 이름을 요구합니다

### 2. AppList 로고 (Square44x44Logo)

- **Policy 10.1.1.11 준수 필수**
- Windows 시작 메뉴, 검색 결과, 앱 목록에 표시
- 누락 시 제출 거절

### 3. 파일 위치

- **생성 위치**: `build/store-icons/` (원본)
- **사용 위치**: `build/appx/assets/` (electron-builder가 참조)
- `prepare:appx-assets` 스크립트가 자동으로 복사합니다

## 🔍 문제 해결

### 문제: "10.1.1.11 On Device Tiles" 피드백

**원인**: 필수 아이콘(특히 Square44x44Logo.png)이 누락되었거나 잘못된 위치에 있음

**해결**:
1. `npm run build:appx-assets` 실행하여 아이콘 생성 및 복사 확인
2. `build/appx/assets/Square44x44Logo.png` 파일 존재 확인
3. `electron-builder.json5`의 `visualElements` 설정 확인
4. 빌드 전에 항상 `npm run build:appx-assets` 실행

### 문제: 아이콘이 AppX 패키지에 포함되지 않음

**원인**: `build/appx/assets/` 폴더에 아이콘이 없거나 이름이 잘못됨

**해결**:
1. `build/appx/assets/` 폴더 확인
2. 파일 이름이 정확한지 확인 (대소문자 포함)
3. `npm run build:appx-assets` 실행하여 아이콘 준비 확인
4. electron-builder는 `build/appx/assets/` 폴더를 자동으로 스캔합니다

### 문제: 빌드 시 아이콘을 찾을 수 없다는 오류

**원인**: 아이콘 생성 또는 복사가 누락됨

**해결**:
```bash
# 전체 프로세스 재실행
npm run build:appx-assets
```

## 📚 참고 자료

- [Microsoft Store Policy 10.1.1.11](https://learn.microsoft.com/en-us/windows/uwp/publish/store-policies)
- [electron-builder AppX Configuration](https://www.electron.build/configuration/appx)
- [UWP App Icons and Logos](https://learn.microsoft.com/en-us/windows/apps/design/style/app-icons-and-logos)

## ✅ 체크리스트

빌드 전 확인사항:

- [ ] `npm run build:appx-assets` 실행 완료
- [ ] `build/appx/assets/Square44x44Logo.png` 존재 확인
- [ ] `build/appx/assets/Square150x150Logo.png` 존재 확인
- [ ] `build/appx/assets/StoreLogo.png` 존재 확인
- [ ] `electron-builder.json5`의 `visualElements` 설정 확인
- [ ] 모든 파일 이름이 정확한지 확인 (대소문자 포함)

## 🚀 빌드 워크플로우

```bash
# 1. 소스 빌드
npm run build

# 2. AppX 자산 준비 (아이콘 생성 + 복사)
npm run build:appx-assets

# 3. AppX 패키지 빌드
npm run build:ms-store
```

또는 한 번에:

```bash
npm run build:ms-store  # 자동으로 자산 준비 포함
```
