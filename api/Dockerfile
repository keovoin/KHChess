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
COPY lib/ lib/
COPY types.d.ts types-api.d.ts tsconfig.json motia-workbench.json ./
COPY requirements.txt .env.sample ./

# --- Python venv where Motia expects it ---
RUN python3 -m venv python_modules \
    && python_modules/bin/pip install --no-cache-dir -r requirements.txt

# Stockfish (linux binary already in lib/)
RUN chmod +x lib/stockfish/stockfish-linux-x86-64-universal

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STOCKFISH_BIN_PATH=/app/lib/stockfish/stockfish-linux-x86-64-universal \
    MOTIA_DOCKER_DISABLE_WORKBENCH=1

EXPOSE 3000

# Render injects PORT (10000+); motia start needs it passed explicitly
CMD ["sh", "-c", "exec motia start -p ${PORT:-3000}"]
