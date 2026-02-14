# 기본 Electron 아이콘 문제 해결 가이드

## 문제 설명

Microsoft Store 제출 시 다음 오류로 거절될 수 있습니다:
- **"The available product tile icons include a default image"**
- **Policy 10.1.1.11 On Device Tiles** 위반
- 앱이 Electron 프레임워크의 기본 아이콘(원자 모양)을 사용하고 있음

## 근본 원인 (2026년 2월 확인)

**electron-builder v24.13.3은 `build/appx/` 폴더에서 직접 아이콘을 읽습니다.**

`AppxTarget.js`의 `computeUserAssets()` 함수가 `readdir(build/appx/)`를 실행하여 파일 목록을 가져옵니다.

### ❌ 잘못된 위치 (이전 설정)
```
build/appx/assets/Square44x44Logo.png  ← electron-builder가 찾지 못함!
```

`readdir(build/appx/)` → `['assets']` → `'assets'.includes('.')` → `false` → 필터링됨 → `userAssets = []` → **기본 Electron 아이콘 사용!**

### ✅ 올바른 위치
```
build/appx/Square44x44Logo.png  ← electron-builder가 직접 찾음
build/appx/Square150x150Logo.png
build/appx/StoreLogo.png
build/appx/Wide310x150Logo.png
build/appx/LargeTile.png        ← 310x310 타일 (electron-builder 전용 이름)
build/appx/SmallTile.png        ← 71x71 타일 (electron-builder 전용 이름)
```

### electron-builder의 타일 아이콘 이름 규칙

electron-builder는 `defaultTileTag()` 함수에서 특수한 파일 이름을 사용합니다:

| 용도 | electron-builder가 찾는 이름 | Manifest에서의 이름 |
|------|----------------------------|-------------------|
| 대형 타일 (310x310) | `LargeTile.png` | `Square310x310Logo` |
| 소형 타일 (71x71) | `SmallTile.png` | `Square71x71Logo` |
| 잠금 화면 | `BadgeLogo.png` | `BadgeLogo` |
| 스플래시 화면 | `SplashScreen.png` | `SplashScreen` |

## 해결 방법

### 1. 아이콘 생성 및 준비

```bash
# AppX 자산 준비 (아이콘 생성 + 올바른 위치로 복사)
npm run build:appx-assets
```

이 명령어는:
1. `assets/windows.png`를 기반으로 모든 스토어 아이콘 생성 (`build/store-icons/`)
2. 필수 AppX 아이콘을 `build/appx/` 폴더로 복사 (올바른 이름으로 변환 포함)
3. `Square310x310Logo.png` → `LargeTile.png`으로 이름 변경
4. `Square71x71Logo.png` → `SmallTile.png`으로 이름 변경

### 2. 아이콘 확인

```bash
# 올바른 위치에 아이콘이 있는지 확인
ls -la build/appx/*.png

# 자동 검증
npm run verify:appx-icons
```

### 3. 빌드

```bash
# Microsoft Store용 빌드 (아이콘 자동 준비 포함)
npm run build:ms-store
```

### 4. 빌드된 패키지 검증

```bash
# 1. 빌드 실행
npm run build:ms-store

# 2. .appx 파일을 .zip으로 이름 변경하여 내용 확인
cd release/<version>
cp LoopMate-Store-*.appx LoopMate-check.zip
unzip LoopMate-check.zip -d appx-contents

# 3. Assets 폴더 확인 - LoopMate 로고가 있어야 함 (Electron 원자 아이콘 X)
open appx-contents/assets

# 4. AppxManifest.xml 확인
cat appx-contents/AppxManifest.xml
```

## 체크리스트

빌드 전 확인사항:

- [ ] `npm run build:appx-assets` 실행 완료
- [ ] `build/appx/Square44x44Logo.png` 존재 확인 ⭐
- [ ] `build/appx/Square150x150Logo.png` 존재 확인 ⭐
- [ ] `build/appx/StoreLogo.png` 존재 확인 ⭐
- [ ] `build/appx/Wide310x150Logo.png` 존재 확인 ⭐
- [ ] `build/appx/LargeTile.png` 존재 확인 (310x310)
- [ ] `build/appx/SmallTile.png` 존재 확인 (71x71)
- [ ] `build/appx/assets/` 하위 폴더가 없는지 확인 (있으면 삭제됨)
- [ ] 모든 아이콘이 LoopMate 로고인지 시각적 확인

## 참고: electron-builder 소스코드 분석

`node_modules/app-builder-lib/out/targets/AppxTarget.js`:

```js
// electron-builder가 아이콘을 찾는 방법:
const userAssetDir = await this.packager.getResource(undefined, "appx");
// → build/appx/ 폴더를 가리킴

// 파일 목록 읽기:
userAssets = (await readdir(userAssetDir)).filter(it => 
  !it.startsWith(".") && !it.endsWith(".db") && it.includes(".")
);
// → "assets" 디렉토리는 "."이 없어서 필터링됨!

// 기본 아이콘 fallback:
const vendorAssetsForDefaultAssets = {
  "StoreLogo.png": "SampleAppx.50x50.png",           // ← 기본 Electron 아이콘
  "Square150x150Logo.png": "SampleAppx.150x150.png",  // ← 기본 Electron 아이콘
  "Square44x44Logo.png": "SampleAppx.44x44.png",      // ← 기본 Electron 아이콘
  "Wide310x150Logo.png": "SampleAppx.310x150.png",    // ← 기본 Electron 아이콘
};
```

## 참고 자료

- [Microsoft Store Policy 10.1.1.11](https://learn.microsoft.com/en-us/windows/uwp/publish/store-policies)
- [electron-builder AppX Configuration](https://www.electron.build/configuration/appx)
- [UWP App Icons and Logos](https://learn.microsoft.com/en-us/windows/apps/design/style/app-icons-and-logos)
