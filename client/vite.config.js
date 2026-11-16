import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * A local Boxity stack: the API, the play (matchmaker) service and the portal. Static
 * files come from the local API too.
 */
const LOCAL_BLOXITY_ENV = {
  env: 'local',
  apiUrl: 'http://localhost:4000',
  playUrl: 'http://localhost:2567',
  portalUrl: 'http://localhost:3000',
  staticUrl: 'http://localhost:4000',
}

/**
 * The environment to hand the page in `vite dev`: a local Boxity stack by default, or
 * any other one given whole as JSON in the shell (never in a file), e.g.
 *   BLOXITY_DEV_ENV='{"env":"stage","apiUrl":"...","playUrl":"...","portalUrl":"...","staticUrl":"..."}' npm run dev
 */
function devEnvironment() {
  const raw = process.env.BLOXITY_DEV_ENV
  if (!raw) return LOCAL_BLOXITY_ENV
  try {
    const env = JSON.parse(raw)
    if (env && typeof env === 'object' && env.env && env.apiUrl && env.playUrl && env.portalUrl && env.staticUrl) return env
  } catch {
    // Falls through to the warning.
  }
  console.warn('[bloxity] BLOXITY_DEV_ENV must be a whole environment as JSON; using the local stack')
  return LOCAL_BLOXITY_ENV
}

/**
 * `vite dev` only (`apply: 'serve'`, never in a build): tells the Boxity SDK - and
 * src/bloxity/env.js - which environment to use, by injecting `window.BLOXITY_ENV`
 * ahead of every other script (so ahead of the SDK tag). Without it the SDK, seeing
 * localhost, would point its API and login at the Vite server.
 *
 * Production builds get nothing: the page Boxity hosts the game in provides it.
 */
function bloxityDevEnv() {
  return {
    name: 'bloxity-dev-env',
    apply: 'serve',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          children: `window.BLOXITY_ENV = ${JSON.stringify(devEnvironment())};`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [bloxityDevEnv(), react(), tailwindcss()],
  resolve: {
    alias: {
      // Game rules and world layout, shared with the server.
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    // ../shared lives outside the client root.
    fs: { allow: ['..'] },
  },
  optimizeDeps: {
    // Dev-only perf overlay, imported lazily; pre-bundle it so the first ?perf load
    // doesn't hit a mid-session dependency re-optimisation.
    include: ['r3f-perf'],
  },
})
