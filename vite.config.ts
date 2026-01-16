import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV === 'test'
      ? []
      : [
          electron({
            main: {
              // Main process entry point
              entry: 'electron/main.ts',
              // [Important] Add build settings here to exclude libraries from bundling.
              vite: {
                build: {
                  rollupOptions: {
                    external: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static', 'electron'],
                  },
                },
              },
            },
            preload: {
              input: path.join(__dirname, 'electron/preload.ts'),
              vite: {
                build: {
                  rollupOptions: {
                    output: {
                      format: 'cjs',
                      entryFileNames: 'preload.cjs',
                    },
                  },
                },
              },
            },
            renderer: {},
          }),
        ]),
    // Plugin to copy splash HTML file to dist-electron
    {
      name: 'copy-splash-html',
      closeBundle() {
        const splashSource = path.join(__dirname, 'electron', 'splash.html')
        const splashDest = path.join(__dirname, 'dist-electron', 'splash.html')
        const distElectronDir = path.dirname(splashDest)
        
        if (fs.existsSync(splashSource)) {
          // Ensure dist-electron directory exists
          if (!fs.existsSync(distElectronDir)) {
            fs.mkdirSync(distElectronDir, { recursive: true })
          }
          fs.copyFileSync(splashSource, splashDest)
          console.log('✓ Copied splash.html to dist-electron')
        } else {
          console.warn('⚠ splash.html not found, skipping copy')
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})