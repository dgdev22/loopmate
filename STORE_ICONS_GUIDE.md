# Microsoft Store Icons Guide

이 문서는 Microsoft Store 등록을 위한 아이콘 생성 및 사용 방법을 설명합니다.

## 📁 파일 구조

```
assets/
  └── windows.png          # 원본 아이콘 소스 (GitHub에 커밋)
build/
  └── store-icons/         # 생성된 스토어 이미지들 (GitHub에 커밋하지 않음)
      ├── [App Package Icons - 11 files]
      ├── PosterArt_720x1080.png
      ├── PosterArt_1440x2160.png
      ├── BoxArt_1080x1080.png
      ├── BoxArt_2160x2160.png
      ├── AppTileIcon_300x300.png
      ├── AppTileIcon_150x150.png
      ├── AppTileIcon_71x71.png
      ├── HeroArt_1920x1080.png
      ├── HeroArt_3840x2160.png
      ├── Xbox_BrandKeyArt_584x800.png
      ├── Xbox_TitleHeroArt_1920x1080.png
      └── Xbox_PromotionalSquareArt_1080x1080.png
```

## 🎨 아이콘 생성

### Microsoft Store 아이콘 생성

```bash
npm run generate:store-icons
```

이 명령어는 `assets/windows.png`를 기반으로 Microsoft Store에 필요한 모든 이미지를 생성합니다 (총 23개):
- App Package Icons (11개)
- 9:16 Poster Art - Xbox (2개) ⭐ 적극 권장
- 1:1 Box Art (2개) ⭐ 권장
- 1:1 App Tile Icons (3개) ⭐ 권장
- 16:9 Super Hero Art (2개)
- Xbox Images (3개)

### Electron 빌드 아이콘 생성 (선택사항)

Electron 앱의 실행 파일 아이콘(.ico, .icns)을 생성하려면:

```bash
npm run generate:electron-icons
```

이 명령어는 `assets/windows.png`를 기반으로 Windows용 `.ico` 파일과 기타 플랫폼 아이콘을 생성합니다.

## 📦 Microsoft Store 등록 방법

### 방법 1: 수동 업로드 (권장)

1. `npm run generate:store-icons` 실행
2. `build/store-icons/` 폴더의 모든 아이콘을 확인
3. Microsoft Partner Center에서 앱 제출 시 각 아이콘을 해당 필드에 업로드

### 방법 2: electron-builder 자동 생성

electron-builder의 `appx` 타겟은 `win.icon` (현재 `build/icon.ico`)을 기반으로 스토어 아이콘을 자동 생성합니다. 하지만 더 정확한 제어를 원한다면 수동 업로드를 권장합니다.

## ❓ FAQ

### Q: Electron 아이콘으로도 사용해야 하나요?

**A: 선택사항입니다.**

- **Microsoft Store 전용으로만 사용**: `build/store-icons/`의 아이콘들은 스토어 등록 시에만 사용하고, Electron 빌드 아이콘(`build/icon.ico`)은 기존 것을 그대로 사용
- **Electron 아이콘도 업데이트**: `npm run generate:electron-icons`를 실행하여 `windows.png`를 기반으로 Electron 아이콘도 새로 생성

현재 설정:
- Windows Portable: `build/icon.ico` 사용
- Microsoft Store: `build/store-icons/`의 아이콘들 사용 (또는 electron-builder 자동 생성)

### Q: GitHub에 커밋해야 하나요?

**A: 원본만 커밋, 생성된 파일은 제외**

- ✅ **커밋**: `assets/windows.png` (원본 소스)
- ❌ **커밋하지 않음**: `build/store-icons/` (생성된 파일, `.gitignore`에 포함됨)

이유:
- 생성된 아이콘들은 `npm run generate:store-icons` 명령어로 언제든 재생성 가능
- 저장소 용량 절약
- 원본 소스만 관리하면 됨

### Q: 아이콘을 수정하고 싶어요

1. `assets/windows.png` 파일을 수정
2. `npm run generate:store-icons` 실행
3. 새로 생성된 아이콘들을 확인하고 Microsoft Partner Center에 업로드

## 📋 Microsoft Store 이미지 목록

### 1. App Package Icons (앱 패키지 아이콘)

앱 패키지에 포함되는 기본 아이콘들입니다.

| 아이콘 이름 | 크기 | 용도 |
|------------|------|------|
| Square44x44Logo.png | 44×44 | 작은 타일 |
| Square50x50Logo.png | 50×50 | 작은 타일 |
| Square71x71Logo.png | 71×71 | 중간 타일 |
| Square89x89Logo.png | 89×89 | 중간 타일 |
| Square107x107Logo.png | 107×107 | 큰 타일 |
| Square142x142Logo.png | 142×142 | 큰 타일 |
| Square150x150Logo.png | 150×150 | 기본 타일 |
| Square284x284Logo.png | 284×284 | 큰 타일 |
| Square310x310Logo.png | 310×310 | 큰 타일 |
| Wide310x150Logo.png | 310×150 | 와이드 타일 |
| StoreLogo.png | 50×50 | 스토어 로고 |

### 2. 9:16 Poster Art (포스터 아트) ⭐ 적극 권장

Xbox에 표시하는 데 필요합니다. Windows 10/11 고객에게 기본 로고로 사용됩니다.

| 이미지 이름 | 크기 | 용도 |
|------------|------|------|
| PosterArt_720x1080.png | 720×1080 | Xbox 표시용 |
| PosterArt_1440x2160.png | 1440×2160 | Xbox 표시용 (고해상도) |

**중요**: Xbox 고객에게 제대로 표시되는 데 필요합니다.

### 3. 1:1 Box Art (박스 아트) ⭐ 권장

Microsoft Store 표시용 이미지입니다. 9:16 포스터 아트가 제공되지 않는 경우 기본 로고로 사용됩니다.

| 이미지 이름 | 크기 | 용도 |
|------------|------|------|
| BoxArt_1080x1080.png | 1080×1080 | Store 표시용 |
| BoxArt_2160x2160.png | 2160×2160 | Store 표시용 (고해상도) |

**중요**: 가장 눈에 잘 띄게 표시하기 위해 권장됩니다. 다양한 Microsoft Store 레이아웃에서 사용할 수 있습니다.

### 4. 1:1 App Tile Icons (앱 타일 아이콘) ⭐ 권장

Microsoft Store 표시용 이미지입니다. Microsoft Store는 앱 패키지에 포함된 아이콘보다 이 아이콘을 우선적으로 사용합니다.

| 이미지 이름 | 크기 | 용도 |
|------------|------|------|
| AppTileIcon_300x300.png | 300×300 | Windows 10/11 Store 표시 |
| AppTileIcon_150x150.png | 150×150 | Store 표시 |
| AppTileIcon_71x71.png | 71×71 | Store 표시 (작은 크기) |

**중요**: 로고 이미지 외에 사용됩니다. Microsoft Store는 패키지의 로고 이미지보다 이 아이콘을 우선적으로 사용합니다.

### 5. 16:9 Super Hero Art (수퍼히어로 아트)

Windows 10 버전 1607 이상(Xbox 포함) 고객의 경우 Microsoft Store 목록 상단에(또는 동영상 트레일러 재생이 끝난 후) 표시됩니다.

| 이미지 이름 | 크기 | 용도 |
|------------|------|------|
| HeroArt_1920x1080.png | 1920×1080 | Store 목록 상단 표시 |
| HeroArt_3840x2160.png | 3840×2160 | Store 목록 상단 표시 (고해상도) |

**중요**: 
- 제품 제목을 포함해서는 안 됩니다.
- 예고편 중 하나를 Microsoft Store 목록의 맨 위에 표시하려면 필요합니다.

### 6. Xbox Images (Xbox 이미지)

Xbox 전용 이미지들입니다.

| 이미지 이름 | 크기 | 용도 |
|------------|------|------|
| Xbox_BrandKeyArt_584x800.png | 584×800 | Xbox 브랜드 키 아트 |
| Xbox_TitleHeroArt_1920x1080.png | 1920×1080 | Xbox 타이틀 히어로 아트 |
| Xbox_PromotionalSquareArt_1080x1080.png | 1080×1080 | Xbox 특별 홍보용 정사각형 아트 |

## 🔧 기술 세부사항

- **이미지 처리**: `sharp` 라이브러리 사용
- **배경**: 
  - App Package Icons, App Tile Icons: 투명 배경 유지
  - Poster Art, Box Art, Hero Art, Xbox Images: 다크 배경 (#020617) 사용
- **리사이징**: `contain` 모드로 비율 유지하며 리사이징
- **출력 형식**: PNG (투명도 지원)
- **파일 크기 제한**: 
  - 로고 이미지: 50MB 미만
  - Store 표시 이미지: 5MB 미만

## 📚 참고 자료

- [Microsoft Store 앱 아이콘 가이드](https://docs.microsoft.com/en-us/windows/uwp/design/style/app-icons-and-logos)
- [electron-builder AppX 설정](https://www.electron.build/configuration/appx)
