# KHChess API — standalone (no Motia Cloud)
# Runs the full Motia server locally (Node + Python + Stockfish).
# State persists in .motia/ — mount a VOLUME there (see fly.toml / railway disk).
FROM node:20-slim

# Python for the AI-move evaluation step (chess + pydantic)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Node deps ---
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# --- App code ---
COPY steps/ steps/
COPY services/ services/
COPY types.d.ts types-api.d.ts tsconfig.json motia-workbench.json ./
COPY requirements.txt .env.sample ./

# --- Python venv where Motia expects it ---
RUN python3 -m venv python_modules \
    && python_modules/bin/pip install --no-cache-dir -r requirements.txt

# --- Stockfish 19 (official release binary; pinned) ---
# Note: api/lib/* is gitignored, so the binary must be fetched at build time.
# The release tarball nests the binary under stockfish/stockfish-linux-x86-64-universal,
# so extract to a scratch dir and `install` it to the exact expected path.
RUN mkdir -p /tmp/sfx lib/stockfish \
    && curl -fsSL --retry 3 -o /tmp/sf.tar.gz \
       "https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz" \
    && tar -xzf /tmp/sf.tar.gz -C /tmp/sfx \
    && install -m 0755 /tmp/sfx/stockfish/stockfish-linux-x86-64-universal lib/stockfish/stockfish-linux-x86-64-universal \
    && test -x lib/stockfish/stockfish-linux-x86-64-universal \
    && echo "stockfish binary in place: $(ls -la lib/stockfish/stockfish-linux-x86-64-universal)" \
    && rm -rf /tmp/sf.tar.gz /tmp/sfx

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STOCKFISH_BIN_PATH=/app/lib/stockfish/stockfish-linux-x86-64-universal \
    MOTIA_DOCKER_DISABLE_WORKBENCH=1

EXPOSE 3000

# Render injects PORT (10000+); motia start needs it passed explicitly.
# Boot-time safety net: if the engine binary is missing for any reason
# (build cache, image layer dropped), fetch it before starting so the
# Stockfish provider can never silently fall back to "no move".
CMD ["sh", "-c", "SF=lib/stockfish/stockfish-linux-x86-64-universal; if [ ! -x \"$SF\" ]; then echo 'stockfish missing at boot — downloading sf_19' && curl -fsSL --retry 2 -o /tmp/sf.tar.gz https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz && mkdir -p lib/stockfish /tmp/sfx && tar -xzf /tmp/sf.tar.gz -C /tmp/sfx && install -m 0755 /tmp/sfx/stockfish/stockfish-linux-x86-64-universal lib/stockfish/stockfish-linux-x86-64-universal && rm -rf /tmp/sf.tar.gz /tmp/sfx; fi; exec motia start -p ${PORT:-3000}"]
