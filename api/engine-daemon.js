#!/usr/bin/env node
/*
 * KHChess Stockfish daemon — ONE engine for the whole container.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Motia runs each step request in a fresh, short-lived Node worker. Any
 * in-module engine "pool" is therefore per-worker: the /chess/models step and
 * the ai-player step each spawned their own ~133MB Stockfish (embedded NNUE
 * net), and two concurrent workers OOM-killed the 512MB Render container in
 * a loop. A pool cannot survive across worker processes.
 *
 * The fix: a single long-lived daemon process owns ONE Stockfish and serves
 * every step worker over localhost TCP. No matter how many workers are alive
 * at once, exactly one engine process exists (~133MB) + this daemon
 * (~60MB) + the app — comfortably under 512MB.
 *
 * PROTOCOL (one JSON line each way)
 * ─────────────────────────────────
 *   client → daemon: {"fen":"...","movetime":200}\n
 *                    {"ping":true}\n
 *   daemon → client: {"move":"e2e4","depth":12,"scoreCp":5,"mate":null}\n
 *                    {"ok":true,"engine":"stockfish-19"}\n
 *   on no legal move: {"move":"(none)","noMove":true}\n
 *   on error:         {"error":"..."}\n
 *
 * Stockfish is queried strictly serially (one child, FIFO queue) — extra
 * concurrent clients just queue, which is exactly what we want on 0.5 CPU.
 */
'use strict'

const net = require('net')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.STOCKFISH_DAEMON_PORT || 7878)
const HOST = process.env.STOCKFISH_DAEMON_HOST || '127.0.0.1'
const THREADS = Number(process.env.STOCKFISH_THREADS || 1)
const HASH_MB = Number(process.env.STOCKFISH_HASH_MB || 16)
const ENGINE_NAME = 'stockfish-19'
const BOOT_TIMEOUT_MS = 20000
const MIN_SEARCH_TIMEOUT_MS = 8000

function findBinary() {
  const cands = [
    process.env.STOCKFISH_BIN_PATH,
    '/app/api/lib/stockfish',
    '/app/api/lib/stockfish/stockfish-linux-x86-64-universal',
    path.join(__dirname, 'lib/stockfish/stockfish-linux-x86-64-universal'),
    path.join(__dirname, 'lib/stockfish/stockfish-ubuntu-x86-64-sse41-popcnt'),
  ].filter(Boolean)
  for (const c of cands) {
    let st
    try {
      st = fs.statSync(c)
    } catch {
      continue
    }
    if (st.isFile()) return c
    if (st.isDirectory()) {
      for (const n of ['stockfish-linux-x86-64-universal', 'stockfish-ubuntu-x86-64-sse41-popcnt', 'stockfish']) {
        try {
          if (fs.statSync(path.join(c, n)).isFile()) return path.join(c, n)
        } catch {}
      }
    }
  }
  return null
}

const BIN = findBinary()

// ── Single UCI engine, strictly serial ────────────────────────────────────
let child = null
let state = 'none' // none | booting | ready | searching
let bootResolvers = []
let lineBuf = ''
let current = null // active search context

function engWrite(s) {
  try {
    if (child && child.stdin) child.stdin.write(s)
  } catch (e) {
    console.error('[sf-daemon] stdin write failed', e.message)
  }
}

function onStdout(data) {
  lineBuf += data.toString('utf8')
  let i
  while ((i = lineBuf.indexOf('\n')) >= 0) {
    const line = lineBuf.slice(0, i).trim()
    lineBuf = lineBuf.slice(i + 1)
    onLine(line)
  }
}

function onLine(line) {
  if (!line) return
  if (state === 'booting') {
    if (line === 'uciok') {
      engWrite(`setoption name Threads value ${THREADS}\nsetoption name Hash value ${HASH_MB}\nisready\n`)
    } else if (line === 'readyok') {
      state = 'ready'
      console.log('[sf-daemon] engine ready (threads=' + THREADS + ', hash=' + HASH_MB + 'MB)')
      const rs = bootResolvers
      bootResolvers = []
      for (const r of rs) r()
    }
    return
  }
  if (state === 'searching' && current) {
    if (line.startsWith('info')) {
      const d = line.match(/depth (\d+)/)
      if (d) current.lastDepth = Number(d[1])
      const mate = line.match(/score mate (-?\d+)/)
      const cp = line.match(/score cp (-?\d+)/)
      if (mate) {
        current.lastMate = Number(mate[1])
        current.lastCp = undefined
      } else if (cp) {
        current.lastCp = Number(cp[1])
        current.lastMate = undefined
      }
    } else if (line.startsWith('bestmove')) {
      const b = line.split(/\s+/)[1]
      const cur = current
      current = null
      state = 'ready'
      clearTimeout(cur.timer)
      if (!b || b === '(none)') cur.resolve({ move: '(none)', noMove: true, depth: cur.lastDepth })
      else
        cur.resolve({
          move: b,
          depth: cur.lastDepth,
          scoreCp: cur.lastMate !== undefined ? undefined : cur.lastCp,
          mate: cur.lastMate !== undefined ? cur.lastMate : null,
        })
    }
  }
}

function ensureEngine() {
  return new Promise((resolve) => {
    if (state === 'ready' || state === 'searching') return resolve()
    if (state === 'booting') return bootResolvers.push(resolve)
    if (!BIN) return resolve()
    state = 'booting'
    bootResolvers.push(resolve)
    try {
      child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (e) {
      console.error('[sf-daemon] spawn failed', e.message)
      state = 'none'
      const rs = bootResolvers
      bootResolvers = []
      for (const r of rs) r()
      return
    }
    child.stdout.on('data', onStdout)
    child.stderr.on('data', () => {})
    child.on('error', (e) => console.error('[sf-daemon] engine error', e.message))
    child.on('close', () => {
      console.log('[sf-daemon] engine exited; will respawn on demand')
      if (current) {
        const cur = current
        current = null
        clearTimeout(cur.timer)
        cur.resolve({ move: '(none)', noMove: true, engineDown: true })
      }
      state = 'none'
      child = null
      const rs = bootResolvers
      bootResolvers = []
      for (const r of rs) r()
    })
    engWrite('uci\n')
    setTimeout(() => {
      if (state === 'booting') {
        console.error('[sf-daemon] engine boot timeout')
        state = 'none'
        const rs = bootResolvers
        bootResolvers = []
        for (const r of rs) r()
      }
    }, BOOT_TIMEOUT_MS)
  })
}

// One search; caller guarantees the queue (we are the only caller of
// searchOnce, via the FIFO queue below).
function searchOnce(fen, movetimeMs) {
  return new Promise((resolve) => {
    ensureEngine().then(() => {
      if (!child || state !== 'ready') {
        return resolve({ move: '(none)', noMove: true, engineDown: !child })
      }
      const timeoutMs = Math.max(MIN_SEARCH_TIMEOUT_MS, movetimeMs * 4)
      const cur = {
        lastDepth: undefined,
        lastCp: undefined,
        lastMate: undefined,
        timer: null,
        resolve,
      }
      cur.timer = setTimeout(() => {
        if (current !== cur) return
        current = null
        state = 'ready'
        // Cancel the runaway search so the engine frees for the next client.
        engWrite('stop\n')
        // The engine will still emit a bestmove for the cancelled search;
        // state is now 'ready' so onLine ignores it (no waiter, no corruption
        // of the next search, because stdin commands are processed in order
        // and the next search only starts after we write its `position`).
        resolve({ move: '(none)', noMove: true, timeout: true })
      }, timeoutMs)
      current = cur
      state = 'searching'
      engWrite(`position fen ${fen}\ngo movetime ${movetimeMs}\n`)
    })
  })
}

// ── FIFO queue: at most one search in flight ───────────────────────────────
const queue = []
let pumping = false
function enqueue(fn) {
  return new Promise((resolve) => {
    queue.push({ fn, resolve })
    pump()
  })
}
async function pump() {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const { fn, resolve } = queue.shift()
    try {
      resolve(await fn())
    } catch (e) {
      resolve({ error: e.message })
    }
  }
  pumping = false
}

// ── TCP server ────────────────────────────────────────────────────────────
const server = net.createServer()
server.on('error', (e) => console.error('[sf-daemon] server error', e.message))
server.on('connection', (sock) => {
  sock.on('error', () => {})
  let buf = ''
  sock.on('data', (data) => {
    buf += data.toString('utf8')
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const raw = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!raw) continue
      let req
      try {
        req = JSON.parse(raw)
      } catch {
        try {
          sock.write('{"error":"bad json"}\n')
        } catch {}
        continue
      }
      if (req.ping) {
        try {
          sock.write(JSON.stringify({ ok: true, engine: ENGINE_NAME, bin: BIN || null, state }) + '\n')
        } catch {}
        continue
      }
      const fen = typeof req.fen === 'string' ? req.fen : ''
      const movetime = Math.max(1, Math.min(Number(req.movetime) || 200, 2000))
      if (!fen) {
        try {
          sock.write('{"error":"missing fen"}\n')
        } catch {}
        continue
      }
      enqueue(() => searchOnce(fen, movetime)).then((res) => {
        try {
          sock.write(JSON.stringify(res) + '\n')
        } catch {}
      })
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[sf-daemon] listening on ${HOST}:${PORT}, engine binary=${BIN || 'NOT FOUND'}`)
  ensureEngine()
    .then(() => console.log('[sf-daemon] initial boot done, state=' + state))
    .catch((e) => console.error('[sf-daemon] boot error', e))
})

process.on('uncaughtException', (e) => console.error('[sf-daemon] uncaught', e))
process.on('unhandledRejection', (e) => console.error('[sf-daemon] unhandled rejection', e))
