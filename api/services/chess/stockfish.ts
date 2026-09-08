import { spawn, type ChildProcess } from 'child_process'
import { Chess } from 'chess.js'
import fs from 'fs'
import path from 'path'

/**
 * Stockfish UCI client — the "bot" move engine.
 *
 * Replaces the LLM move path for engine games: the engine searches the
 * position directly (no prompt, no tokens, no blunders — moves are always
 * legal). One short-lived process per move, single-threaded so N concurrent
 * games share CPU fairly. Binary resolution mirrors the Python eval step:
 * STOCKFISH_BIN_PATH env first, then lib/stockfish relative to the step
 * package root (works both in the Render image and local dev).
 */

export const STOCKFISH_MODEL = 'stockfish-19'
export const BOT_MOVETIME_MS = 500

export const isEngineModel = (model?: string): boolean => model === STOCKFISH_MODEL

const CANDIDATES = [
  'stockfish-linux-x86-64-universal',
  'stockfish-windows-x86-64-sse41-popcnt.exe',
  'stockfish-ubuntu-x86-64-avx2',
  'stockfish-macos-m1-apple-silicon',
  'stockfish',
]

const findStockfishCandidates = (): string[] => {
  const out: string[] = []
  const envPath = process.env.STOCKFISH_BIN_PATH
  if (envPath && fs.existsSync(envPath)) out.push(envPath)
  // step lives in <root>/steps/chess/ or services/chess/ → lib is at <root>/lib/stockfish
  const dir = path.join(__dirname, '..', '..', 'lib', 'stockfish')
  for (const name of CANDIDATES) {
    const candidate = path.join(dir, name)
    if (fs.existsSync(candidate)) out.push(candidate)
  }
  return out
}

export type EngineMove = {
  /** UCI move (e.g. "e2e4" or "e7e8q") — always legal when present. */
  uci?: string
  /** Score from the bot's perspective, e.g. "+0.35" / "Mate in 4". */
  evalText?: string
  depth?: number
  /** Principal variation as SAN, e.g. "e4 e5 Nf3 Nc6". */
  pvSan?: string
}

type Info = { depth?: number; cp?: number; mate?: number; pv?: string[] }

// Stockfish reports scores from the side-to-move's view; normalize to the bot's.
const parseInfo = (line: string, side: 'white' | 'black'): Info | undefined => {
  if (!line.startsWith('info') || !line.includes(' pv ')) return undefined
  const parts = line.split(' ')
  const info: Info = {}
  for (let i = 1; i < parts.length - 1; i++) {
    const k = parts[i]
    const v = parts[i + 1]
    if (k === 'depth') {
      info.depth = parseInt(v, 10)
    } else if (k === 'score') {
      if (v === 'cp') {
        info.cp = parseInt(parts[i + 2], 10)
      } else if (v === 'mate') {
        info.mate = parseInt(parts[i + 2], 10)
        i++
      }
    } else if (k === 'pv') {
      info.pv = parts.slice(i + 1)
      break
    }
  }
  const sign = side === 'white' ? 1 : -1
  if (info.mate !== undefined) info.mate *= sign
  if (info.cp !== undefined) info.cp *= sign
  return info
}

const formatEval = (info: Info | undefined): string | undefined => {
  if (!info) return undefined
  if (info.mate !== undefined) return info.mate > 0 ? `Mate in ${info.mate}` : `Mated in ${Math.abs(info.mate)}`
  if (info.cp !== undefined) {
    const p = info.cp / 100
    return `${p > 0 ? '+' : ''}${p.toFixed(2)}`
  }
  return undefined
}

const pvToSan = (fen: string, pv?: string[]): string | undefined => {
  if (!pv?.length) return undefined
  try {
    const board = new Chess(fen)
    const sans: string[] = []
    for (const uci of pv.slice(0, 6)) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break
      const m = board.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? (uci[4] as 'q') : undefined,
      })
      if (!m) break
      sans.push(m.san)
    }
    return sans.join(' ') || undefined
  } catch {
    return undefined
  }
}

export const getStockfishMove = (fen: string, side: 'white' | 'black', movetimeMs = BOT_MOVETIME_MS, timeoutMs = 6000): Promise<EngineMove> => {
  const candidates = findStockfishCandidates()
  if (!candidates.length) return Promise.resolve({})
  return tryCandidate(candidates, 0, fen, side, movetimeMs, timeoutMs)
}

const tryCandidate = (
  candidates: string[],
  index: number,
  fen: string,
  side: 'white' | 'black',
  movetimeMs: number,
  timeoutMs: number,
): Promise<EngineMove> =>
  new Promise((resolve) => {
    const bin = candidates[index]

    const nextOrEmpty = (): Promise<EngineMove> =>
      index + 1 < candidates.length
        ? tryCandidate(candidates, index + 1, fen, side, movetimeMs, timeoutMs)
        : Promise.resolve({})

    let child: ChildProcess
    try {
      child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch {
      resolve(nextOrEmpty())
      return
    }

    let finished = false
    const finish = (uci?: string, info?: Info) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try {
        child.kill()
      } catch {
        /* already gone */
      }
      resolve({ uci, evalText: formatEval(info), depth: info?.depth, pvSan: pvToSan(fen, info?.pv) })
    }

    const timer = setTimeout(() => finish(bestRef.best, bestRef.info), timeoutMs)

    // Binary present but not runnable on this platform → try the next candidate.
    child.once('error', () => {
      if (!finished) {
        finished = true
        clearTimeout(timer)
        resolve(nextOrEmpty())
      }
    })

    let bestRef: { best: string | undefined; info: Info | undefined } = { best: undefined, info: undefined }
    let buf = ''
    let state: 'uci' | 'options' | 'search' = 'uci'

    child.on('close', () => finish(bestRef.best, bestRef.info))

    const out = child.stdout
    const err = child.stderr
    if (!out || !err) {
      if (!finished) {
        finished = true
        clearTimeout(timer)
      }
      resolve(nextOrEmpty())
      return
    }
    err.on('data', () => undefined)

    out.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      let nl = buf.indexOf('\n')
      while (nl >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        nl = buf.indexOf('\n')
        if (!line) continue

        if (line.startsWith('bestmove')) {
          const b = line.split(' ')[1]
          finish(b && b !== '(none)' ? b : undefined, bestRef.info)
          continue
        }
        if (line.startsWith('info')) {
          const parsed = parseInfo(line, side)
          if (parsed) bestRef.info = parsed
          continue
        }
        if (state === 'uci' && line === 'uciok') {
          // Single thread: concurrent games share CPU fairly instead of
          // oversubscribing the host (25 games x 4 threads = disaster).
          child.stdin?.write('setoption name Threads value 1\n')
          child.stdin?.write('setoption name Hash value 32\n')
          child.stdin?.write('isready\n')
          state = 'options'
        } else if (state === 'options' && line === 'readyok') {
          child.stdin?.write(`position fen ${fen}\n`)
          child.stdin?.write(`go movetime ${movetimeMs}\n`)
          state = 'search'
        }
      }
    })

    child.stdin?.write('uci\n')
  })
