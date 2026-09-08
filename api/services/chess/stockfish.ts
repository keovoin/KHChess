import net from 'net'
import { Chess } from 'chess.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Stockfish client — talks to the shared engine daemon (engine-daemon.js).
 *
 * WHY A DAEMON (not an in-process engine)
 * ───────────────────────────────────────
 * Motia runs every step request in a fresh, short-lived Node worker. An
 * in-module engine pool is therefore per-worker: the /chess/models step and
 * the ai-player step each spawned their own ~133MB Stockfish (embedded NNUE
 * net) and two concurrent workers OOM-killed the 512MB Render container in
 * a loop (verified via Render events: `oomKilled: 512Mi` ×3).
 *
 * One long-lived daemon (`engine-daemon.js`, started by the container
 * entrypoint) owns the single Stockfish process and serves ALL workers over
 * localhost TCP with a FIFO queue. Regardless of how many step workers are
 * alive at once, exactly one engine exists → RAM stays ~320-400MB < 512MB.
 *
 * This module is the client side: connect → send one JSON line
 * `{"fen","movetime"}` → read one JSON line → close. Connection is
 * per-call (~1-3ms local), so there is no long-lived socket to babysit and
 * no per-worker state to leak.
 *
 * LOCAL DEV: if the daemon isn't running (dev machines), `ensureDaemon`
 * spawns it on demand (same binary candidates as before).
 */

export type EngineMove = {
  move: string
  depth?: number
  scoreCp?: number
  mate?: number
  /** engine reported no legal move (checkmate / stalemate position) */
  noMove?: boolean
}
export type EngineInfo = { depth: number; scoreCp?: number; pv?: string[] }

// 200ms of CPU-time search ≈ depth 10-18, far above casual strength; on the
// 0.5-CPU prod instance it costs ~2-10s wall (NNUE load + CPU share).
export const BOT_MOVETIME_MS = 200
export const STOCKFISH_MODEL = 'stockfish-19'
export const isEngineModel = (model?: string): boolean => model === STOCKFISH_MODEL

const DAEMON_HOST = process.env.STOCKFISH_DAEMON_HOST || '127.0.0.1'
const DAEMON_PORT = Number(process.env.STOCKFISH_DAEMON_PORT || 7878)
const DEFAULT_TIMEOUT_MS = 30000
const DEV_SPAWN_TIMEOUT_MS = 20000

const findStockfishCandidates = (): string[] => {
  const out: string[] = []
  const pushIf = (p?: string) => {
    if (!p || out.includes(p) || !fs.existsSync(p)) return
    if (fs.statSync(p).isDirectory()) {
      const names = os.platform() === 'win32'
        ? ['stockfish-windows-x86-64-sse41-popcnt.exe', 'stockfish-windows-x86-64-avx2-popcnt.exe']
        : ['stockfish-linux-x86-64-universal', 'stockfish-linux-x86-64-avx2-popcnt']
      for (const n of names) pushIf(path.join(p, n))
      return
    }
    out.push(p)
  }
  pushIf(process.env.STOCKFISH_BIN_PATH)
  pushIf('/app/api/lib/stockfish')
  pushIf('/app/api/lib/stockfish/stockfish-linux-x86-64-universal')
  const here = __dirname
  for (const rel of [
    path.join(here, '../../lib/stockfish'),
    path.join(here, '../../lib/stockfish/stockfish-linux-x86-64-universal'),
    path.join(here, '../../lib/stockfish/stockfish-windows-x86-64-sse41-popcnt.exe'),
    path.join(here, 'lib/stockfish/stockfish-linux-x86-64-universal'),
  ]) pushIf(rel)
  const which = os.platform() === 'win32' ? 'where' : 'which'
  try {
    const { execSync } = require('child_process') as typeof import('child_process')
    const w = execSync(`${which} stockfish`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split(/\r?\n/)[0]
    pushIf(w)
  } catch {
    /* not on PATH */
  }
  return out
}

// ── Daemon liveness / lazy spawn (dev only) ────────────────────────────────
const pingDaemon = (): Promise<boolean> =>
  new Promise((resolve) => {
    const s = net.connect(DAEMON_PORT, DAEMON_HOST)
    const done = (ok: boolean) => {
      try {
        s.destroy()
      } catch {
        /* already gone */
      }
      resolve(ok)
    }
    s.setTimeout(1500)
    s.on('connect', () => {
      s.write(JSON.stringify({ ping: true }) + '\n')
    })
    s.on('data', () => done(true))
    s.on('timeout', () => done(false))
    s.on('error', () => done(false))
  })

let daemonSpawnPromise: Promise<boolean> | null = null
const spawnDaemon = (): Promise<boolean> => {
  if (!daemonSpawnPromise) {
    daemonSpawnPromise = (async () => {
      // Prefer the bundled daemon (api/engine-daemon.js). In prod the
      // entrypoint already started it; in local dev we start it here.
      const candidates = [
        process.env.STOCKFISH_DAEMON_PATH,
        path.join(__dirname, '../../engine-daemon.js'),
        path.join(__dirname, '../engine-daemon.js'),
        '/app/api/engine-daemon.js',
      ].filter((p): p is string => !!p)
      for (const p of candidates) {
        if (!fs.existsSync(p)) continue
        const { spawn } = require('child_process') as typeof import('child_process')
        const env = { ...process.env }
        const bin = findStockfishCandidates()[0]
        if (bin) env.STOCKFISH_BIN_PATH = bin
        env.STOCKFISH_DAEMON_PORT = String(DAEMON_PORT)
        env.STOCKFISH_DAEMON_HOST = DAEMON_HOST
        const child = spawn(process.execPath, [p], {
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
          cwd: path.dirname(p),
        })
        child.unref()
        child.stdout?.on('data', (d: Buffer) => {
          const line = d.toString().trim()
          if (line) console.log(`[stockfish] ${line}`)
        })
        child.stderr?.on('data', (d: Buffer) => {
          const line = d.toString().trim()
          if (line) console.error(`[stockfish] ${line}`)
        })
        // Wait until the port answers ping (engine boot can take a few s).
        const t0 = Date.now()
        while (Date.now() - t0 < DEV_SPAWN_TIMEOUT_MS) {
          if (await pingDaemon()) return true
          await new Promise((r) => setTimeout(r, 250))
        }
        return false
      }
      return false
    })()
  }
  return daemonSpawnPromise
}

const ensureDaemon = async (): Promise<boolean> => {
  if (await pingDaemon()) return true
  return spawnDaemon()
}

// ── One move from the daemon ───────────────────────────────────────────────
const requestMove = (fen: string, movetimeMs: number, timeoutMs: number): Promise<EngineMove> =>
  new Promise((resolve) => {
    let settled = false
    let s: net.Socket
    const finish = (r: EngineMove) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        s.destroy()
      } catch {
        /* already gone */
      }
      resolve(r)
    }
    const timer = setTimeout(() => finish({ move: '(none)', noMove: true }), timeoutMs)
    try {
      s = net.connect(DAEMON_PORT, DAEMON_HOST)
    } catch {
      return finish({ move: '(none)', noMove: true })
    }
    s.setTimeout(timeoutMs + 2000)
    let buf = ''
    s.on('connect', () => {
      s.write(JSON.stringify({ fen, movetime: movetimeMs }) + '\n')
    })
    s.on('data', (d: Buffer) => {
      buf += d.toString('utf8')
      const i = buf.indexOf('\n')
      if (i < 0) return
      const line = buf.slice(0, i).trim()
      try {
        const r = JSON.parse(line) as EngineMove & { error?: string }
        if (r.error || !r.move) {
          finish({ move: '(none)', noMove: true })
          return
        }
        finish({
          move: r.move,
          depth: r.depth,
          scoreCp: r.scoreCp,
          mate: r.mate,
          noMove: r.noMove,
        })
      } catch {
        finish({ move: '(none)', noMove: true })
      }
    })
    s.on('error', () => finish({ move: '(none)', noMove: true }))
    s.on('timeout', () => finish({ move: '(none)', noMove: true }))
  })

/**
 * Compute the bot's next move for `fen` via the shared daemon.
 * Never throws — callers rely on the (none) contract.
 */
export const getStockfishMove = async (
  fen: string,
  _side: 'white' | 'black',
  movetimeMs = BOT_MOVETIME_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EngineMove> => {
  // Validate FEN up front — a bad FEN makes Stockfish refuse to search.
  try {
    new Chess(fen)
  } catch {
    return { move: '(none)', noMove: true }
  }
  try {
    if (!(await ensureDaemon())) {
      return { move: '(none)', noMove: true }
    }
    return await requestMove(fen, movetimeMs, timeoutMs)
  } catch {
    return { move: '(none)', noMove: true }
  }
}

/**
 * No-op in daemon mode — the daemon owns the engine for the container
 * lifetime. Kept for API compatibility with the step handlers.
 */
export const warmPool = (_count = 1): void => {
  // Fire-and-forget: make sure the daemon is up so the first real move
  // doesn't pay the spawn+boot cost.
  void ensureDaemon()
}

export type EngineDiagnosticResult = {
  platform: string
  arch: string
  envBinPath: string | null
  candidates: Array<{ path: string; exists: boolean; executable: boolean }>
  testMove: string | null
  testOk: boolean
}

export const engineDiagnostic = async (): Promise<EngineDiagnosticResult> => {
  const candidates = findStockfishCandidates()
  const base: EngineDiagnosticResult = {
    platform: `${process.platform}/${process.arch}`,
    arch: process.arch,
    envBinPath: process.env.STOCKFISH_BIN_PATH || null,
    candidates: candidates.map((p) => ({
      path: p,
      exists: true,
      executable: !!(fs.statSync(p).mode & 0o111),
    })),
    testMove: null,
    testOk: false,
  }
  // Exercise the real path (daemon → engine) with a cheap 250ms search.
  const test = await getStockfishMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'white', 250, 20000)
  base.testMove = test.move
  base.testOk = !test.noMove && !!test.move && test.move !== '(none)'
  return base
}
