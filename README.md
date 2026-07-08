# KHChess

**KHChess** is an open-source platform by [keovoin](https://github.com/keovoin) for exploring and benchmarking how large language models (LLMs) perform in chess. Rather than focusing on simple win/loss results, KHChess measures _move quality_ and _game insight_, providing uniquely meaningful feedback on how much AI models truly "understand" chess.

> ⚙️ Built on the [Motia](https://motia.dev) framework. See [Credits](#-credits).

![KHChess Demo](./public/images/chessarena.gif)
_See KHChess in action - watch AI models battle it out with real-time move evaluation and scoring_

## 🚩 Why KHChess?

Modern LLMs struggle to genuinely _win_ at chess: most LLM-based games end in draws, and true chess mastery still eludes these models.

That's why we score _move-by-move quality_ and _insight_ rather than simply tracking wins!

## 🎯 How Move Evaluation Works

Every single move played by an LLM is immediately:

- Evaluated by [Stockfish](https://stockfishchess.org/), the strongest open-source chess engine.
- Compared to Stockfish's recommended best move.
- The difference ("move swing") is recorded in _centipawns_.
- If the move swing is **>100 centipawns**, we count it as a blunder.

This system produces a leaderboard rewarding the most insightful and accurate play, rather than luck or brute force.

## 🏆 Features

## Demo Video

Click the image below to watch the demo:

[![Project Demo](https://img.youtube.com/vi/lbndv3hybJ8/maxresdefault.jpg)](https://youtu.be/lbndv3hybJ8 'Click to watch the demo')

- **LLM Chess Leaderboard:** See how multiple language models compare, move-by-move.
- **Real-Time Streaming:** Built on Motia Streams, every move and score updates live.
- **Open-Source, Event-Driven:** Built with [Motia](https://motia.dev/) for easy customization, real-time features, and code-first clarity.

## 🚀 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [PNPM](https://pnpm.io/)
- [Python 3.x](https://www.python.org/)
- [Stockfish Chess Engine](https://stockfishchess.org/)

### Step 1: Clone and Install Dependencies

```bash
git clone https://github.com/keovoin/KHChess.git
cd KHChess
pnpm install
```

### Step 2: Install Stockfish

#### Option A: Using Homebrew (macOS - Recommended)

```bash
brew install stockfish
```

#### Option B: Using the project installer

```bash
pnpm install-stockfish <platform>
```

Supported platforms:

- `linux-x86`
- `mac-m1`

#### Option C: Manual Installation

Download directly from [stockfishchess.org](https://stockfishchess.org/) and install according to your platform's instructions.

---

## 🚀 Deployment

The frontend (`app`) deploys to any static host (e.g. **Vercel**). The backend (`api`) is a
Motia server that you can **self-host** — you are not tied to Motia Cloud.

### Backend on Fly.io (self-hosted)

This repo ships a root [`Dockerfile`](./Dockerfile) and [`fly.toml`](./fly.toml) that bundle
Node, Python (for the move-evaluation step), and the Stockfish engine into one image.

**Prerequisites:** a [Fly.io](https://fly.io) account and [`flyctl`](https://fly.io/docs/flyctl/install/) installed.

```bash
# 1. From the repo root, create the app (detects the existing fly.toml + Dockerfile).
#    Pick a unique app name and your region; do NOT deploy yet.
fly launch --no-deploy

# 2. Set the runtime secrets (never commit these).
fly secrets set \
  OPENAI_API_KEY=... \
  GEMINI_API_KEY=... \
  ANTHROPIC_API_KEY=... \
  XAI_API_KEY=... \
  JWT_SECRET=... \
  SUPABASE_URL=... \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=...

# 3. Deploy.
fly deploy
```

Your backend will be available at `https://<your-app>.fly.dev` (HTTP + WebSocket).

Notes:

- Non-secret config (`PORT`, `STOCKFISH_BIN_PATH`, `JWT_EXPIRATION`, `NODE_ENV`) lives in `fly.toml` `[env]`.
- The machine is kept always-on (`min_machines_running = 1`, `auto_stop_machines = "off"`) because the app runs background AI-vs-AI games, a cron cleanup step, and live streams.
- See [`api/.env.sample`](./api/.env.sample) for the full list of backend variables.

### Point the frontend at your backend

Set these in your frontend host (e.g. Vercel project env), using your Fly URL:

```bash
VITE_API_URL=https://<your-app>.fly.dev
VITE_SOCKET_URL=wss://<your-app>.fly.dev
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Alternative: Motia Cloud

The included `.github/workflows/deploy.yml` deploys the backend to Motia Cloud instead. If you
go that route, replace the hardcoded `MOTIA_ENV_ID` with your own environment ID and add the
matching repository secrets.

---

## 🙏 Credits

KHChess is built on the [Motia](https://motia.dev) framework and is based on Motia's open-source
[ChessArena.ai](https://github.com/MotiaDev/chessarena-ai) example. Huge thanks to the Motia team
for the framework, the real-time streaming primitives, and the original implementation that made
this project possible.

- **Framework & backend runtime:** [Motia](https://github.com/MotiaDev/motia)
- **Original project:** [MotiaDev/chessarena-ai](https://github.com/MotiaDev/chessarena-ai)
- **Chess evaluation engine:** [Stockfish](https://stockfishchess.org/)

Maintained by [keovoin](https://github.com/keovoin).
