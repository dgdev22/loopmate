# Contributing to LoopMate

Thank you for your interest in contributing to LoopMate! 🎉

We welcome contributions of all kinds: bug reports, feature suggestions, code improvements, translations, and documentation updates.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Guidelines](#coding-guidelines)
- [Internationalization (i18n)](#internationalization-i18n)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Project Structure](#project-structure)

---

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our code of conduct: be respectful, constructive, and collaborative.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **Git**
- **FFmpeg**: Bundled via `ffmpeg-static` (no separate installation needed)

### Fork and Clone

1. Fork this repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/loopmate.git
cd loopmate
```

3. Add upstream remote:

```bash
git remote add upstream https://github.com/dgdev22/loopmate.git
```

---

## 🛠️ Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

This will start:
- Vite dev server for React UI
- Electron app in development mode with hot-reload

### 3. Build for Production

```bash
npm run build
```

This will:
- Build the React app with Vite
- Build the Electron main process
- Create distributable packages in `dist/` folder

---

## 📝 Coding Guidelines

### General Principles

- **TypeScript First**: Use TypeScript for all code. Strongly typed, avoid `any`.
- **Functional Components**: Use React functional components with Hooks.
- **Dark Theme**: Maintain consistency with the existing dark theme (Tailwind CSS + shadcn/ui).
- **No Hardcoded Text**: **ALWAYS** use translation keys via `useTranslation()` hook.

### Code Style

- **Indentation**: 2 spaces
- **Line Length**: Max 120 characters
- **Quotes**: Single quotes for strings (except JSX props)
- **Semicolons**: Always use semicolons
- **Naming Conventions**:
  - Components: `PascalCase` (e.g., `FileDropZone.tsx`)
  - Files: `camelCase` for utils, `PascalCase` for components
  - Variables/Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`

### Component Structure

```typescript
// 1. Imports (group by external, internal, types)
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { Job } from '@/types'

// 2. Types/Interfaces
interface MyComponentProps {
  title: string
  onComplete: () => void
}

// 3. Component
export function MyComponent({ title, onComplete }: MyComponentProps) {
  const { t } = useTranslation()
  const [count, setCount] = useState(0)

  // ... component logic

  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <Button onClick={onComplete}>{t('buttons.complete')}</Button>
    </div>
  )
}
```

---

## 🌍 Internationalization (i18n)

### ⚠️ CRITICAL: Translation Keys

**NEVER hardcode user-facing text.** Always use the `t()` function from `react-i18next`.

#### ❌ Bad

```typescript
<button>작업 큐에 추가</button>
<label>Select Image</label>
```

#### ✅ Good

```typescript
const { t } = useTranslation()

<button>{t('buttons.addToQueue')}</button>
<label>{t('labels.selectImage')}</label>
```

### Adding New Translation Keys

When adding new features, you **MUST** add translation keys to **ALL 15 locale files**:

```
src/locales/
  ├── en.json (English - Primary)
  ├── ko.json (Korean)
  ├── ja.json (Japanese)
  ├── zh.json (Chinese)
  ├── es.json (Spanish)
  ├── fr.json (French)
  ├── de.json (German)
  ├── pt.json (Portuguese)
  ├── ru.json (Russian)
  ├── hi.json (Hindi)
  ├── ar.json (Arabic)
  ├── id.json (Indonesian)
  ├── vi.json (Vietnamese)
  ├── th.json (Thai)
  └── it.json (Italian)
```

#### Step-by-Step Process

1. **Add key to `en.json`** (primary language):

```json
{
  "buttons": {
    "myNewButton": "My New Button"
  }
}
```

2. **Add to `ko.json`** (Korean):

```json
{
  "buttons": {
    "myNewButton": "내 새 버튼"
  }
}
```

3. **Add to all other 13 locale files** with appropriate translations. If you don't know the translation, use English as fallback and open an Issue requesting translation help.

4. **Use Python script for batch updates** (if adding many keys):

```python
# scripts/update_locales.py
import json
import os

locales = ['ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'hi', 'ar', 'id', 'vi', 'th', 'it']
translations = {
    'ja': '私の新しいボタン',
    'zh': '我的新按钮',
    # ... add all translations
}

for locale in locales:
    file_path = f'src/locales/{locale}.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data['buttons']['myNewButton'] = translations[locale]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
```

### Translation Key Structure

Follow existing patterns:

```json
{
  "tabs": {
    "imagePlusMusic": { "title": "...", "description": "..." }
  },
  "buttons": { "addToQueue": "...", "cancel": "..." },
  "labels": { "selectImage": "...", "audioFiles": "..." },
  "job": { "imagePlusMusic": "...", "loopVideo": "..." },
  "errors": { "noImage": "...", "noAudio": "..." },
  "settings": { "language": "...", "fileExtensions": "..." }
}
```

---

## 🧪 Testing

### Unit Tests (Jest)

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

#### Writing Unit Tests

- Place tests in `__tests__` folders or next to the file as `*.test.ts(x)`
- Mock Electron APIs and `electron-store`
- Example:

```typescript
// src/lib/__tests__/utils.test.ts
import { formatDuration } from '../utils'

describe('formatDuration', () => {
  it('should format seconds correctly', () => {
    expect(formatDuration(90)).toBe('1:30')
  })
})
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

#### Writing E2E Tests

- Tests are in `tests/` folder
- Test critical user flows (e.g., creating a video, processing queue)
- Example:

```typescript
// tests/image-plus-music.spec.ts
import { test, expect } from '@playwright/test'

test('should create video from image and audio', async ({ page }) => {
  await page.click('text=Image + Music')
  await page.setInputFiles('input[type="file"]', 'test-image.jpg')
  await page.setInputFiles('input[type="file"]', 'test-audio.mp3')
  await page.click('button:has-text("Add to Queue")')
  await expect(page.locator('.job-queue')).toContainText('Image + Music')
})
```

### Test Coverage

Aim for **>80% coverage** on critical paths:
- Video processing functions (`electron/utils/ffmpeg/`)
- IPC handlers (`electron/main.ts`)
- Business logic (`src/lib/`, `src/hooks/`)

---

## 🔀 Pull Request Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-new-feature
```

### 2. Make Your Changes

- Follow coding guidelines
- Add/update tests
- Add/update translations (all 15 languages)
- Update documentation if needed

### 3. Test Your Changes

```bash
# Lint check
npm run lint

# Type check
npm run build:check

# Run tests
npm run test
npm run test:e2e
```

### 4. Commit Your Changes

Follow **Conventional Commits** format:

```bash
git commit -m "feat: add new video effect"
git commit -m "fix: resolve audio sync issue"
git commit -m "docs: update README with new features"
git commit -m "refactor: simplify FFmpeg command builder"
git commit -m "test: add E2E tests for concat feature"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, build config)

### 5. Push and Create PR

```bash
git push origin feature/my-new-feature
```

Then open a Pull Request on GitHub with:
- **Clear title** (follow Conventional Commits)
- **Description** of what changed and why
- **Screenshots/GIFs** for UI changes
- **Testing notes** (how you tested it)

### 6. Code Review

- Maintainers will review your PR
- Address feedback and update your branch
- Once approved, your PR will be merged!

---

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps to reproduce the issue
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**:
   - OS: macOS/Windows version
   - LoopMate version
   - Error logs (if any)
6. **Screenshots/Videos**: If applicable

### Feature Requests

When suggesting features:

1. **Description**: Clear description of the feature
2. **Use Case**: Why is this feature needed?
3. **Proposed Solution**: How would you implement it?
4. **Alternatives**: Any alternative solutions you've considered?

---

## 📁 Project Structure

```
loopmate/
├── electron/              # Electron main process
│   ├── main.ts            # Main entry point, IPC handlers
│   ├── preload.ts         # Preload script (contextBridge)
│   ├── utils/             # Utility functions
│   │   ├── ffmpeg/        # FFmpeg processing logic
│   │   │   ├── videoProcessor.ts    # Video processing functions
│   │   │   ├── audioProcessor.ts    # Audio processing functions
│   │   │   ├── metadataAnalyzer.ts  # Metadata extraction
│   │   │   └── ...
│   │   ├── logger.ts      # Logging utilities
│   │   ├── security.ts    # Security utilities
│   │   └── ...
│   └── __tests__/         # Electron unit tests
├── src/                   # React renderer process
│   ├── App.tsx            # Main app component
│   ├── components/        # React components
│   │   ├── tabs/          # Tab components
│   │   ├── ui/            # shadcn/ui components
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   │   ├── useJobQueue.ts
│   │   └── useHistory.ts
│   ├── store/             # Zustand stores
│   │   └── useSettingsStore.ts
│   ├── lib/               # Utility functions
│   │   ├── utils.ts
│   │   └── timestampUtils.ts
│   ├── locales/           # Translation files (15 languages)
│   │   ├── en.json
│   │   ├── ko.json
│   │   └── ...
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts
│   └── __tests__/         # React unit tests
├── tests/                 # E2E tests (Playwright)
├── build/                 # Build assets (icons, etc.)
├── dist/                  # Build output (React app)
├── dist-electron/         # Build output (Electron main)
└── ...
```

### Key Files

- **`electron/main.ts`**: Main process entry point, IPC handlers
- **`electron/preload.ts`**: Exposes safe APIs to renderer via `window.electronAPI`
- **`src/App.tsx`**: Main React component with tabs and state management
- **`src/hooks/useJobQueue.ts`**: Job queue management logic
- **`electron/utils/ffmpeg/videoProcessor.ts`**: Core video processing functions
- **`src/locales/*.json`**: Translation files for all languages
- **`package.json`**: Dependencies and scripts
- **`electron-builder.json5`**: Electron build configuration

---

## 💡 Development Tips

### IPC Communication Pattern

LoopMate uses a secure IPC pattern:

```
Renderer (React)  →  Preload (contextBridge)  →  Main Process (Electron)
                 ←                             ←
```

**Example:**

```typescript
// 1. Main Process (electron/main.ts)
ipcMain.handle('video:process', async (_event, { inputPath, iterations }) => {
  // Process video
  return { success: true, outputPath: '/path/to/output.mp4' }
})

// 2. Preload (electron/preload.ts)
contextBridge.exposeInMainWorld('electronAPI', {
  processVideo: (data) => ipcRenderer.invoke('video:process', data)
})

// 3. Renderer (src/App.tsx)
const result = await window.electronAPI.processVideo({ inputPath, iterations })
```

### FFmpeg Path Handling

FFmpeg binaries are bundled via `ffmpeg-static`. Always use the path from the package:

```typescript
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath!)
```

**Important**: Handle ASAR unpacked paths for production builds.

### State Management

- **Local State**: `useState` for component-specific state
- **Global State**: Zustand stores (e.g., `useSettingsStore`)
- **Persistence**: `electron-store` for app settings

### Error Handling

Always provide user-friendly error messages:

```typescript
try {
  await processVideo(inputPath)
} catch (error) {
  console.error('Video processing failed:', error)
  showToast(t('errors.videoProcessingFailed'), 'error')
}
```

---

## 🙏 Thank You!

Your contributions make LoopMate better for everyone. We appreciate your time and effort!

If you have any questions, feel free to open an Issue or reach out to the maintainers.

Happy coding! 🎉


