# Microsoft Store 빌드 체크리스트

## 정책 10.1.1.11 및 10.1.1.3 준수 확인

### ✅ 완료된 작업

#### 1. 아이콘 자동 생성 및 교체 (10.1.1.11)
- ✅ `assets/windows.png`를 원본으로 사용하여 모든 Windows 아이콘 재생성
- ✅ `npm run build:appx-assets` 명령어로 모든 규격 아이콘 생성 및 복사
- ✅ **아이콘이 `build/appx/` 폴더에 직접 위치** (NOT `build/appx/assets/`)
- ✅ electron-builder가 자동으로 감지하여 AppX 패키지에 포함
- ✅ 필수 아이콘 4종 (Square44x44Logo, Square150x150Logo, StoreLogo, Wide310x150Logo)
- ✅ 추가 타일 아이콘 (LargeTile.png, SmallTile.png) - electron-builder 전용 이름

#### 2. 기부 UI 완벽 격리 (10.1.1.3)
- ✅ `App.tsx`의 "Buy Me a Coffee" 버튼이 스토어 빌드 시 `null` 반환
- ✅ 빌드 타임 체크: `import.meta.env.VITE_IS_STORE === 'true'`
- ✅ 런타임 체크: `shouldHideDonationState`
- ✅ 기부 관련 코드가 스토어 빌드 번들에 포함되지 않도록 처리

#### 3. 빌드 환경 설정
- ✅ `build:ms-store` 스크립트에 아이콘 생성 워크플로우 포함
- ✅ `VITE_IS_STORE=true` 환경 변수 설정

### 📋 빌드 전 필수 확인 (⭐ 가장 중요)

```bash
# 1. 아이콘 생성 및 올바른 위치로 복사
npm run build:appx-assets

# 2. 아이콘이 build/appx/ 에 직접 있는지 확인 (NOT build/appx/assets/)
ls build/appx/*.png

# 3. 필수 아이콘 4종 + 타일 아이콘 2종 확인
npm run verify:appx-icons
```

#### 필수 파일 위치 확인:
- ✅ `build/appx/Square44x44Logo.png` (NOT `build/appx/assets/Square44x44Logo.png`)
- ✅ `build/appx/Square150x150Logo.png`
- ✅ `build/appx/StoreLogo.png`
- ✅ `build/appx/Wide310x150Logo.png`
- ✅ `build/appx/LargeTile.png` (310x310, electron-builder 전용 이름)
- ✅ `build/appx/SmallTile.png` (71x71, electron-builder 전용 이름)

### 📋 빌드 후 확인 사항

Windows 환경에서 `npm run build:ms-store` 실행 후:

#### AppxManifest.xml 확인
1. 빌드된 `.appx` 파일을 `.zip`으로 변경하여 압축 해제
2. `AppxManifest.xml` 파일 확인:
   ```xml
   <uap:VisualElements
     BackgroundColor="#020617"
     DisplayName="LoopMate"
     Square150x150Logo="assets\Square150x150Logo.png"
     Square44x44Logo="assets\Square44x44Logo.png"
     Description="...">
     <uap:DefaultTile Wide310x150Logo="assets\Wide310x150Logo.png"
       Square310x310Logo="assets\LargeTile.png"
       Square71x71Logo="assets\SmallTile.png" />
   </uap:VisualElements>
   ```
3. 모든 타일 아이콘 경로가 올바르게 설정되어 있는지 확인
4. 기본 Electron 아이콘 참조가 없는지 확인

#### 아이콘 파일 검증
1. 생성된 .appx 파일 내부의 `assets\` 폴더 확인
2. 모든 타일 아이콘이 LoopMate 로고인지 시각적 확인
3. 기본 Electron 아이콘(원자 모양)이 없는지 확인

### 🔧 빌드 명령어

```bash
# Microsoft Store 빌드 (아이콘 생성 + 기부 UI 제거)
npm run build:ms-store

# 아이콘만 재생성
npm run build:appx-assets

# 아이콘 확인
npm run verify:appx-icons
```

### ⚠️ 주의사항

1. **Mac 환경에서는 MSIX 빌드 불가**: Windows 환경 또는 GitHub Actions 필요
2. **아이콘 소스**: `assets/windows.png`를 사용
3. **기부 UI**: 스토어 빌드 시 완전히 제거됨 (null 반환)
4. **아이콘 위치**: 반드시 `build/appx/` 에 직접! (`build/appx/assets/`가 아님)

### 📝 정책 준수 확인

- ✅ **10.1.1.11**: 모든 타일 아이콘이 LoopMate 로고 사용 (기본 Electron 아이콘 없음)
- ✅ **10.1.1.3**: 기부/후원 UI가 스토어 빌드에서 완전히 제거됨
