import { spawn, type ChildProcess } from 'child_process'
import { Chess } from 'chess.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * Stockfish UCI client — the "bot" move engine (replaces the LLM path).
 *
 * Design notes
 *  ───────────
 *  • A small POOL of persistent engine processes (UCI over stdio).
 *    Spawning + initialising Stockfish costs ~1-4s wall on this 0.5-CPU
 *    instance, so reusing engines is what makes a move "near-instant":
 *    the search itself is only BOT_MOVETIME_MS (~200ms).
 *  • One move per engine at a time (UCI is sequential); extra concurrent
 *    games queue (FIFO).
 *  • Idle engines close after IDLE_MS to free memory.
 *  • Fallback: if the pool engine dies, a fresh one-shot engine is tried.
 *
 *  Capacity: 25 concurrent live games → each turn is one ~200ms search +
 *  ~20ms protocol; engines are shared, so CPU stays tiny. 50 DAU is a
 *  non-issue (see SESSION_LOG capacity note).
 */

export type EngineMove = {
  move: string
  depth?: number
  scoreCp?: number
  /** engine reported no legal move (checkmate / stalemate position) */
  noMove?: boolean
}
export type EngineInfo = { depth: number; scoreCp?: number; pv?: string[] }

// NOTE: on a 0.5-CPU instance "movetime" counts CPU time, so 500ms of
// search took 2-4s wall. 200ms keeps replies snappy and the bot still plays
// at depth ~10-14, far above casual-opponent strength.
export const BOT_MOVETIME_MS = 200
export const STOCKFISH_MODEL = 'stockfish-19'
export const isEngineModel = (model?: string): boolean => model === STOCKFISH_MODEL

// Capacity budget: 512MB instance. Each engine (Hash=16) holds ~40-60MB.
// 2 warm engines ≈ 120MB; bursts queue FIFO on those two (a 25-game surge
// adds ≤ ~2s worst-case wait, CPU stays near zero).
const POOL_MAX = 2
const IDLE_MS = 120_000
const DEFAULT_TIMEOUT_MS = 4000
const HANDSHAKE_TIMEOUT_MS = 15000
const ENGINE_HASH_MB = 16

const findStockfishCandidates = (): string[] => {
  const out: string[] = []
  const pushIf = (p?: string) => {
    if (!p || out.includes(p) || !fs.existsSync(p)) return
    if (fs.statSync(p).isDirectory()) {
      // A directory (local layout) — pick the platform binary inside.
      const names = os.platform() === 'win32'
        ? ['stockfish-windows-x86-64-sse41-popcnt.exe', 'stockfish-windows-x86-64-avx2-popcnt.exe']
        : ['stockfish-linux-x86-64-universal', 'stockfish-linux-x86-64-avx2-popcnt']
      for (const n of names) pushIf(path.join(p, n))
      return
    }
    out.push(p)
  }
  // 1. Explicit override (Dockerfile ENV or local dev).
  pushIf(process.env.STOCKFISH_BIN_PATH)
  // 2. Root Dockerfile builds the app at /app; the engine binary is a FILE.
  pushIf('/app/api/lib/stockfish')
  pushIf('/app/api/lib/stockfish/stockfish-linux-x86-64-universal')
  // 3. Local dev layout.
  const here = __dirname
  for (const rel of [
    path.join(here, '../../lib/stockfish'),
    path.join(here, '../../lib/stockfish/stockfish-linux-x86-64-universal'),
    path.join(here, '../../lib/stockfish/stockfish-windows-x86-64-sse41-popcnt.exe'),
    path.join(here, 'lib/stockfish/stockfish-linux-x86-64-universal'),
  ]) pushIf(rel)
  // 4. System PATH.
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

type Waiting = { resolve: (r: EngineMove) => void; reject: (e: unknown) => void; timer: NodeJS.Timeout }

class UciSession {
  private child?: ChildProcess
  private buf = ''
  private state: 'uci' | 'options' | 'setpos' | 'search' = 'uci'
  private busy = false
  private idleTimer?: NodeJS.Timeout
  private dead = false
  private readonly queue: Waiting[] = []
  // Last search info (reset after each bestmove) — for result metadata.
  private lastDepth?: number
  private lastCp?: number
  private lastMate?: number

  get alive(): boolean {
    return !this.dead && !!this.child
  }
  get isBusy(): boolean {
    return this.busy
  }
  get isDead(): boolean {
    return this.dead
  }

  /** Resolve when this session can take a new move (or spawn a child). */
  async ready(): Promise<boolean> {
    if (this.dead) return false
    if (!this.child) {
      this.spawn()
      await new Promise<void>((res) => {
        const t0 = Date.now()
        const iv = setInterval(() => {
          if (this.state === 'search' || this.dead || Date.now() - t0 > HANDSHAKE_TIMEOUT_MS) {
            clearInterval(iv)
            res()
          }
        }, 50)
      })
      return this.state === 'search' && !this.dead
    }
    if (this.busy) {
      await new Promise<void>((res) => {
        const iv = setInterval(() => {
          if (!this.busy || this.dead) {
            clearInterval(iv)
            res()
          }
        }, 50)
      })
      return !this.dead
    }
    return true
  }

  private spawn(): void {
    const candidates = findStockfishCandidates()
    if (!candidates.length) {
      this.dead = true
      return
    }
    let child: ChildProcess
    try {
      child = spawn(candidates[0], [], { stdio: ['pipe', 'pipe', 'ignore'] })
    } catch {
      this.dead = true
      return
    }
    this.child = child
    this.state = 'uci'
    const out = child.stdout
    if (!out) {
      this.kill()
      return
    }
    out.setEncoding('utf8')
    out.on('data', (d: string) => this.onData(d))
    child.on('error', () => this.onDead())
    child.on('close', () => this.onDead())
    child.stdin?.write('uci\n')
    this.clearIdle()
  }

  private onDead(): void {
    if (this.dead) return
    this.dead = true
    this.kill()
    for (const w of this.queue.splice(0)) {
      clearTimeout(w.timer)
      w.reject(new Error('stockfish process died'))
    }
  }

  private kill(): void {
    try {
      this.child?.kill()
    } catch {
      /* already gone */
    }
    this.child = undefined
    this.clearIdle()
  }

  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = undefined
  }

  private scheduleIdle(): void {
    this.clearIdle()
    this.idleTimer = setTimeout(() => this.kill(), IDLE_MS)
  }

  private onData(data: string): void {
    this.buf += data
    let nl: number
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).trim()
      this.buf = this.buf.slice(nl + 1)
      if (!line) continue
      this.onLine(line)
    }
  }

  private onLine(line: string): void {
    if (line === 'uciok') {
      if (this.state === 'uci') {
        this.state = 'options'
        this.child?.stdin?.write(
          `setoption name Threads value 1\nsetoption name Hash value ${ENGINE_HASH_MB}\nisready\n`,
        )
      }
      return
    }
    if (line === 'readyok') {
      if (this.state === 'options') {
        this.state = 'search'
      }
      return
    }
    if (this.state !== 'search') return
    if (!this.busy) return
    if (line.startsWith('info')) {
      // Keep the last (deepest) info line per search for result metadata.
      const depthM = line.match(/depth (\d+)/)
      const cpM = line.match(/score cp (-?\d+)/)
      const mateM = line.match(/score mate (-?\d+)/)
      if (depthM) this.lastDepth = Number(depthM[1])
      if (mateM) {
        this.lastMate = Number(mateM[1])
        this.lastCp = undefined
      } else if (cpM) {
        this.lastCp = Number(cpM[1])
      }
      return
    }
    if (line.startsWith('bestmove')) {
      const w = this.queue.shift()
      if (!w) return
      clearTimeout(w.timer)
      this.busy = false
      this.scheduleIdle()
      const b = line.split(/\s+/)[1]
      if (!b || b === '(none)') {
        w.resolve({ move: '(none)', noMove: true, depth: this.lastDepth })
      } else {
        w.resolve({
          move: b,
          depth: this.lastDepth,
          scoreCp: this.lastMate !== undefined ? undefined : this.lastCp,
        })
      }
      this.lastDepth = undefined
      this.lastCp = undefined
      this.lastMate = undefined
    }
  }

  ask(fen: string, movetimeMs: number, timeoutMs: number): Promise<EngineMove> {
    return new Promise<EngineMove>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.queue.indexOf(w)
        if (i >= 0) this.queue.splice(i, 1)
        this.busy = false
        this.scheduleIdle()
        // ask() will see the pool fail and fall back to a one-shot engine
        reject(new Error(`stockfish timeout ${timeoutMs}ms`))
      }, timeoutMs)
      const w: Waiting = { resolve, reject, timer }
      this.queue.push(w)
      if (!this.busy) {
        this.busy = true
        this.clearIdle()
        this.child?.stdin?.write(
          `position fen ${fen}\ngo movetime ${movetimeMs}\n`,
        )
      }
    })
  }
}

const pool: UciSession[] = []

/**
 * Pre-spawn + initialise pool engines so the first real move doesn't pay the
 * ~2-4s spawn cost. Fire-and-forget; safe to call repeatedly.
 */
export const warmPool = (count = POOL_MAX): void => {
  // Bounded by POOL_MAX: concurrent calls are harmless (extra loop
  // iterations are skipped as pool.length grows).
  for (let i = 0; i < count && pool.length < POOL_MAX; i++) {
    const s = new UciSession()
    pool.push(s)
    s.ready().catch(() => undefined)
  }
}

function takeSession(): Promise<UciSession | undefined> {
  return (async () => {
    for (const s of pool) if (s.alive && !s.isBusy) return s
    if (pool.length < POOL_MAX) {
      const s = new UciSession()
      pool.push(s)
      return (await s.ready()) ? s : undefined
    }
    // All busy — wait for the first alive one to free up (queue head).
    const head = pool.find((s) => s.alive)
    if (!head) return undefined
    const ok = await head.ready()
    return ok ? head : undefined
  })()
}

/** One-shot engine (diagnostics / fallback): spawn, move, kill. */
const oneShot = (
  candidates: string[],
  fen: string,
  movetimeMs: number,
  timeoutMs: number,
): Promise<EngineMove> =>
  new Promise((resolve) => {
    if (!candidates.length) {
      resolve({ move: '(none)', noMove: true })
      return
    }
    let child: ChildProcess
    try {
      child = spawn(candidates[0], [], { stdio: ['pipe', 'pipe', 'ignore'] })
    } catch {
      resolve({ move: '(none)', noMove: true })
      return
    }
    let done = false
    const finish = (move: string | undefined, info?: EngineInfo) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        /* already gone */
      }
      resolve({ move: move ?? '(none)', depth: info?.depth, scoreCp: info?.scoreCp, noMove: !move })
    }
    const timer = setTimeout(() => finish(undefined), timeoutMs + 2000)
    child.on('error', () => finish(undefined))
    child.on('close', () => finish(undefined))
    const out = child.stdout
    if (!out) {
      finish(undefined)
      return
    }
    let buf = ''
    let state: 'uci' | 'options' | 'search' = 'uci'
    out.setEncoding('utf8')
    out.on('data', (d: string) => {
      buf += d
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line || done) continue
        if (line === 'uciok') {
          if (state === 'uci') {
            state = 'options'
            child.stdin?.write(`setoption name Threads value 1\nsetoption name Hash value ${ENGINE_HASH_MB}\nisready\n`)
          }
          continue
        }
        if (line === 'readyok') {
          if (state === 'options') {
            state = 'search'
            child.stdin?.write(`position fen ${fen}\ngo movetime ${movetimeMs}\n`)
          }
          continue
        }
        if (state !== 'search') continue
        if (line.startsWith('bestmove')) {
          const b = line.split(/\s+/)[1]
          finish(b && b !== '(none)' ? b : undefined)
        }
      }
    })
    child.stdin?.write('uci\n')
  })

/**
 * Compute the bot's next move for `fen`.
 * Uses the pool; falls back to a one-shot engine if the pool fails.
 */
export const getStockfishMove = async (
  fen: string,
  _side: 'white' | 'black',
  movetimeMs = BOT_MOVETIME_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<EngineMove> => {
  const candidates = findStockfishCandidates()
  if (!candidates.length) {
    return { move: '(none)', noMove: true }
  }

  // Validate FEN up front — a bad FEN makes Stockfish refuse to search.
  try {
    new Chess(fen)
  } catch {
    return { move: '(none)', noMove: true }
  }

  try {
    const session = await takeSession()
    if (session) {
      return await session.ask(fen, movetimeMs, timeoutMs)
    }
  } catch {
    /* pool failed → one-shot below */
  }
  return oneShot(candidates, fen, movetimeMs, timeoutMs)
}

export type EngineDiagnosticResult = {
  candidates: string[]
  resolved?: string
  exists?: boolean
  executable?: boolean
  platform: string
  arch: string
  testMove?: string
  testMs?: number
  ok: boolean
}

export const engineDiagnostic = async (): Promise<EngineDiagnosticResult> => {
  const candidates = findStockfishCandidates()
  const base: EngineDiagnosticResult = {
    candidates,
    platform: `${process.platform}/${process.arch}`,
    arch: process.arch,
    ok: false,
  }
  if (!candidates.length) return base
  const bin = candidates[0]
  base.resolved = bin
  base.exists = fs.existsSync(bin)
  base.executable = fs.statSync(bin).mode & 0o111 ? true : fs.accessSync(bin, fs.constants.X_OK) === undefined ? true : false
  const t0 = Date.now()
  const test = await oneShot(candidates, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 250, 8000)
  base.testMove = test.move
  base.testMs = Date.now() - t0
  base.ok = !test.noMove && !!test.move
  return base
}
