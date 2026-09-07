#!/usr/bin/env python
"""Mock LLM server for KHChess smoke test.

Implements:
  POST /v1/chat/completions  (OpenAI protocol) -> JSON in message.content
  POST /v1/messages          (Anthropic protocol) -> tool_use block

Picks a legal move from the FEN in the prompt (prefers captures/checks,
else random), so the game engine's validation passes.
"""
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from random import choice, randrange

import chess

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


def pick_move(board: chess.Board):
    moves = list(board.legal_moves)
    if not moves:
        return None
    # Prefer checks, then captures, else random
    checks = [m for m in moves if board.gives_check(m)]
    caps = [m for m in moves if board.is_capture(m)]
    pool = checks or caps or moves
    m = choice(pool)
    return {"from": chess.square_name(m.from_square), "to": chess.square_name(m.to_square)}


def extract_fen(text: str):
    for m in re.finditer(r"`([^`]+)`", text):
        t = m.group(1).strip()
        board = t.split()[0] if t else ""
        ranks = board.split("/")
        if len(ranks) == 8 and all(re.match(r"^[pnbrqkPNBRQK1-8]+$", r) and sum(int(c) if c.isdigit() else 1 for c in r) == 8 for r in ranks):
            parts = t.split()
            if len(parts) == 1:
                return board + " w - - 0 1"
            return t
    return None


def make_action(prompt: str):
    fen = extract_fen(prompt)
    if fen:
        try:
            board = chess.Board(fen)
            mv = pick_move(board)
            if mv:
                return {"thought": "Mock move.", "move": mv}
        except Exception:
            pass
    return {"thought": "Falling back.", "move": {"from": "e2", "to": "e4"}}


class H(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[mock]", fmt % args, flush=True)

    def _read(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def _send(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        data = self._read()
        if self.path.endswith("/chat/completions"):
            # OpenAI
            content = None
            for m in data.get("messages", []):
                c = m.get("content")
                if c:
                    content = c
                    break
            if content is None:
                self._send({"error": "no content in messages"}, 400)
                return
            action = make_action(content if isinstance(content, str) else str(content))
            self._send({
                "id": "mock-1", "object": "chat.completion", "model": "mock",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": json.dumps(action)}, "finish_reason": "stop"}],
            })
        elif self.path.endswith("/messages"):
            # Anthropic
            msgs = data.get("messages", [])
            content = msgs[0].get("content", "") if msgs else ""
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if isinstance(b, dict))
            action = make_action(content)
            self._send({
                "id": "mock-1", "type": "message", "role": "assistant", "model": "mock",
                "content": [{"type": "tool_use", "id": "tu_1", "name": "move_action", "input": action}],
                "stop_reason": "tool_use",
            })
        else:
            self._send({"error": "unknown path " + self.path}, 404)


print(f"[mock] LLM mock listening on :{PORT}", flush=True)
ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
