# syntax=docker/dockerfile:1
#
# KHChess API — self-hosted Motia backend image (for Fly.io or any container host).
#
# This is a pnpm monorepo: the `api` package depends on the `types` workspace
# package, runs a Python step (chess/pydantic via `motia install`), and needs the
# Stockfish engine binary. So the image bundles Node + Python + Stockfish together.
#
# Build context MUST be the repo root (so the workspace + types package are available).

FROM node:20-bookworm-slim

# --- System deps: Python (for the Motia Python step) + curl (Stockfish download) ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- pnpm via corepack (pinned to the repo's packageManager version) ---
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# --- Workspace manifests + lockfile ---
# Copy the api + types sources in full (api's postinstall `motia install` needs
# requirements.txt), plus app's manifest only so the workspace matches the lockfile.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY types/ ./types/
COPY api/ ./api/
COPY app/package.json ./app/package.json

# --- Install only the api + its workspace deps (skips the frontend deps) ---
# api's `postinstall` runs `motia install`, which sets up the Python venv from
# api/requirements.txt — hence Python must already be present above.
RUN pnpm install --filter "@chessarena/api..." --frozen-lockfile

# --- Stockfish engine binary ---
# sse41-popcnt is broadly compatible across cloud CPUs. Swap to the avx2 build for
# more speed if your host CPU supports AVX2.
RUN mkdir -p /app/api/lib \
    && curl -L https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-ubuntu-x86-64-sse41-popcnt.tar -o /tmp/stockfish.tar \
    && tar -xf /tmp/stockfish.tar -C /tmp \
    && mv /tmp/stockfish/stockfish-ubuntu-x86-64-sse41-popcnt /app/api/lib/stockfish \
    && chmod +x /app/api/lib/stockfish \
    && rm -rf /tmp/stockfish.tar /tmp/stockfish

# --- Build the Motia app (outputs to api/dist) ---
RUN pnpm --filter "@chessarena/api" run build

# --- Runtime config ---
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV STOCKFISH_BIN_PATH=/app/api/lib/stockfish

WORKDIR /app/api
EXPOSE 3000

# Runs the Motia production server.
CMD ["npx", "motia", "start"]
