# Microsoft Store AppX 아이콘 설정 가이드

이 문서는 Microsoft Store (AppX) 제출 시 필요한 아이콘 설정과 Policy 10.1.1.11 (On Device Tiles) 준수 방법을 설명합니다.

## 🎯 문제 해결: Policy 10.1.1.11

Microsoft Store 제출 시 **"10.1.1.11 On Device Tiles"** 피드백으로 거절되는 경우:

### 핵심 원인
**electron-builder v24.13.3은 `build/appx/` 폴더에서 직접 아이콘 파일을 읽습니다.**
`build/appx/assets/` 하위 폴더에 넣으면 찾지 못합니다!

### 필수 확인 사항
1. ✅ 아이콘이 `build/appx/` 에 직접 위치 (NOT `build/appx/assets/`)
2. ✅ **Square44x44Logo.png** (AppList 로고) - 필수
3. ✅ **Square150x150Logo.png** (기본 타일) - 필수
4. ✅ **StoreLogo.png** (스토어 로고) - 필수
5. ✅ **Wide310x150Logo.png** (와이드 타일) - 필수
6. ✅ **LargeTile.png** (310x310 대형 타일) - 권장
7. ✅ **SmallTile.png** (71x71 소형 타일) - 권장

## 📁 파일 구조

```
build/
  ├── icon.ico                  # Windows 앱 아이콘
  ├── icon.png                  # 기본 앱 아이콘
  ├── icon.icns                 # macOS 앱 아이콘
  ├── store-icons/              # 생성된 모든 스토어 이미지 (원본, gitignored)
  │   ├── Square44x44Logo.png
  │   ├── Square150x150Logo.png
  │   ├── Square310x310Logo.png
  │   └── ... (23개 파일)
  └── appx/                     # ⭐ electron-builder가 읽는 폴더 (직접!)
      ├── Square44x44Logo.png   ⭐ 필수 (AppList)
      ├── Square150x150Logo.png ⭐ 필수 (Default tile)
      ├── StoreLogo.png         ⭐ 필수 (Store logo)
      ├── Wide310x150Logo.png   ⭐ 필수 (Wide tile)
      ├── LargeTile.png         ⭐ 권장 (310x310, electron-builder 전용 이름)
      ├── SmallTile.png         ⭐ 권장 (71x71, electron-builder 전용 이름)
      ├── Square50x50Logo.png
      ├── Square89x89Logo.png
      ├── Square107x107Logo.png
      ├── Square142x142Logo.png
      └── Square284x284Logo.png
```

## 🔧 설정 방법

### 1. electron-builder.json5 설정

```json5
{
  "directories": {
    "buildResources": "build"   // electron-builder가 build/appx/ 폴더를 찾습니다
  },
  "appx": {
    "backgroundColor": "#020617",
    "displayName": "LoopMate"
    // electron-builder는 build/appx/ 폴더의 아이콘을 자동으로 감지합니다
    // 아이콘이 없으면 기본 Electron 아이콘(SampleAppx.*.png)이 사용됩니다!
  }
}
```

### 2. 아이콘 생성 및 준비

#### 방법 1: 자동화된 스크립트 사용 (권장)

```bash
# 모든 스토어 이미지 생성 + AppX 자산 준비
npm run build:appx-assets
```

이 명령어는 다음을 수행합니다:
1. `npm run generate:app-icons` - icon.ico, icon.png 생성
2. `npm run generate:store-icons` - 모든 스토어 이미지 생성
3. `npm run prepare:appx-assets` - AppX에 필요한 아이콘을 `build/appx/`로 복사
   - `Square310x310Logo.png` → `LargeTile.png`으로 이름 변경
   - `Square71x71Logo.png` → `SmallTile.png`으로 이름 변경

### 3. AppX 빌드

```bash
# Microsoft Store용 AppX 빌드 (자산 자동 준비 포함)
npm run build:ms-store
```

## 📋 아이콘 목록

### 필수 아이콘 (electron-builder 기본 fallback 있음)

이 4개 아이콘이 `build/appx/`에 없으면 **기본 Electron 아이콘(원자 모양)**이 사용됩니다:

| 파일 이름 | 크기 | 용도 |
|-----------|------|------|
| **Square44x44Logo.png** | 44×44 | AppList 로고 (시작 메뉴, 검색 결과) |
| **Square150x150Logo.png** | 150×150 | 기본 타일 |
| **StoreLogo.png** | 50×50 | 스토어 로고 |
| **Wide310x150Logo.png** | 310×150 | 와이드 타일 |

### 추가 타일 아이콘 (electron-builder 전용 이름)

| 파일 이름 | 크기 | Manifest에서의 이름 |
|-----------|------|-------------------|
| **LargeTile.png** | 310×310 | Square310x310Logo |
| **SmallTile.png** | 71×71 | Square71x71Logo |

### 기타 아이콘

| 파일 이름 | 크기 | 용도 |
|-----------|------|------|
| Square50x50Logo.png | 50×50 | 추가 크기 |
| Square89x89Logo.png | 89×89 | 추가 크기 |
| Square107x107Logo.png | 107×107 | 추가 크기 |
| Square142x142Logo.png | 142×142 | 추가 크기 |
| Square284x284Logo.png | 284×284 | 추가 크기 |

## ⚠️ 중요 사항

### 1. 파일 위치 (가장 중요!)

- **`build/appx/` 폴더에 직접** 아이콘을 넣어야 합니다
- ~~`build/appx/assets/`~~ ← 이 하위 폴더는 **사용하지 마세요!**
- electron-builder의 `readdir()`는 하위 디렉토리를 무시합니다

### 2. electron-builder의 전용 파일 이름

- `LargeTile.png` (NOT `Square310x310Logo.png`) → 대형 310x310 타일
- `SmallTile.png` (NOT `Square71x71Logo.png`) → 소형 71x71 타일

### 3. 파일 이름 규칙

- **대소문자 정확히 일치**: `Square44x44Logo.png` (대문자 S, 대문자 L)
- **확장자**: 반드시 `.png`

## 🔍 문제 해결

### 문제: "10.1.1.11 On Device Tiles" 피드백

**원인**: 아이콘이 `build/appx/assets/`에 있어서 electron-builder가 찾지 못함

**해결**:
1. `npm run build:appx-assets` 실행 (아이콘을 `build/appx/`로 복사)
2. `npm run verify:appx-icons` 실행하여 확인
3. `npm run build:ms-store` 실행

### 문제: 여전히 기본 Electron 아이콘이 포함됨

**해결**:
1. `build/appx/assets/` 폴더가 있다면 삭제
2. `build/appx/` 폴더를 완전히 삭제
3. `npm run build:appx-assets` 재실행
4. `ls build/appx/*.png` 으로 파일 확인
5. 다시 빌드

## ✅ 체크리스트

빌드 전 확인사항:

- [ ] `npm run build:appx-assets` 실행
- [ ] `build/appx/Square44x44Logo.png` 존재 (NOT `build/appx/assets/`!)
- [ ] `build/appx/Square150x150Logo.png` 존재
- [ ] `build/appx/StoreLogo.png` 존재
- [ ] `build/appx/Wide310x150Logo.png` 존재
- [ ] `build/appx/LargeTile.png` 존재
- [ ] `build/appx/SmallTile.png` 존재
- [ ] 아이콘이 LoopMate 로고인지 시각적 확인

## 📚 참고 자료

- [Microsoft Store Policy 10.1.1.11](https://learn.microsoft.com/en-us/windows/uwp/publish/store-policies)
- [electron-builder AppX Configuration](https://www.electron.build/configuration/appx)
- [UWP App Icons and Logos](https://learn.microsoft.com/en-us/windows/apps/design/style/app-icons-and-logos)
