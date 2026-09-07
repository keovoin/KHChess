import chess
import chess.engine
import os
from pathlib import Path
from pydantic import BaseModel, Field

class EvaluatePlayerMoveInput(BaseModel):
    fenBefore: str = Field(description="The FEN of the game before the move")
    fenAfter: str = Field(description="The FEN of the game after the move")
    gameId: str = Field(description="The ID of the game")
    moveId: str = Field(description="The ID of the move")
    player: str = Field(description="The player who made the move")

config = {
    "type": "event",
    "name": "EvaluatePlayerMove",
    "description": "Evaluates the move picked by a player",
    "subscribes": ["evaluate-player-move"], 
    "emits": [],
    "flows": ["chess"],
    "input": EvaluatePlayerMoveInput.model_json_schema(),
    "includeFiles": ["../../lib/stockfish/stockfish-linux-x86-64-universal"]
}

# Binary names to look for, in priority order (cloud runs Linux, local dev runs Windows/macOS)
STOCKFISH_BINARY_CANDIDATES = [
    "stockfish-linux-x86-64-universal",
    "stockfish-windows-x86-64-sse41-popcnt.exe",
    "stockfish-ubuntu-x86-64-avx2",
    "stockfish-macos-m1-apple-silicon",
    "stockfish",
]

def _find_stockfish() -> str | None:
    """Locate the stockfish binary: STOCKFISH_BIN_PATH env first, then the bundled folder."""
    env_path = os.getenv("STOCKFISH_BIN_PATH")
    if env_path and Path(env_path).exists():
        return env_path
    # includeFiles bundles lib/stockfish next to the step package root
    root = Path(__file__).resolve().parents[2]
    bundled = root / "lib" / "stockfish"
    for name in STOCKFISH_BINARY_CANDIDATES:
        candidate = bundled / name
        if candidate.exists():
            return str(candidate)
    return None

class Evaluation(BaseModel):
    centipawn_score: int = Field(description="The evaluation in centipawns")
    best_move: str = Field(description="The best move")

async def evaluate_position(
    engine: chess.engine.SimpleEngine,
    board: chess.Board,
    player: str,
    time_limit: float = 1.5
) -> Evaluation:
    """Evaluate a chess position and return analysis results."""
    analysis = await engine.analyse(
        board, 
        chess.engine.Limit(time=time_limit),
        info=chess.engine.INFO_ALL
    )
    
    score = analysis["score"]
    centipawn_score = score.white().score() if player == "white" else score.black().score()
    move = analysis.get("pv", [None])[0]

    return Evaluation(
        centipawn_score=centipawn_score if centipawn_score is not None else 0,
        best_move=move.uci() if move is not None else None
    )

async def handler(input: EvaluatePlayerMoveInput, ctx):
    logger = ctx.logger
    logger.info("Received event", input)

    # Get FEN strings from input
    fen_before = input.get("fenBefore")
    fen_after = input.get("fenAfter")
    game_id = input.get("gameId")
    move_id = input.get("moveId")
    player = input.get("player")

    if not fen_before or not fen_after:
        logger.error("Both fenBefore and fenAfter must be provided")
        raise ValueError("Both fenBefore and fenAfter must be provided")

    # Initialize Stockfish engine
    engine_path = _find_stockfish()
    if not engine_path:
        logger.error("Stockfish binary not found", { "candidates": STOCKFISH_BINARY_CANDIDATES })
        raise EnvironmentError("Stockfish binary not found (set STOCKFISH_BIN_PATH or bundle lib/stockfish)")
    
    logger.info("Initializing Stockfish engine", { "enginePath": engine_path })
    _, engine = await chess.engine.popen_uci(engine_path)
    logger.info("Stockfish engine initialized")
    
    try:
        # Create boards from the positions
        board_before = chess.Board(fen_before)
        board_after = chess.Board(fen_after)
    
        eval_before = await evaluate_position(engine, board_before, player)
        eval_after = await evaluate_position(engine, board_after, player)

        best_move = chess.Move.from_uci(eval_before.best_move)
        board_before.push(best_move)
        eval_best_move = await evaluate_position(engine, board_before, player)

        logger.info("Evaluation", {
            "before": eval_before,
            "after": eval_after,
            "best_move": eval_best_move,
        })

        evaluation_swing = max(0, eval_best_move.centipawn_score - eval_after.centipawn_score)
        blunder = evaluation_swing > 100

        evaluation = {
            "centipawnScore": eval_after.centipawn_score,
            "bestMove": eval_after.best_move,
            "evaluationSwing": evaluation_swing,
            "blunder": blunder,
        }

        logger.info("Move evaluation results", { "evaluation": evaluation })

        logger.info("Fetching game move from Streams", { "moveId": move_id })
        move_stream = await ctx.streams.chessGameMove.get(game_id, move_id)
        logger.info("Game move fetched from Streams", { "move": move_stream })

        if not move_stream:
            logger.error("Move not found", { "moveId": move_id })
            raise ValueError("Move not found")
        
        move_stream["evaluation"] = evaluation

        logger.info("Updating game move with evaluation", {
            "moveId": move_id,
            "evaluation": evaluation,
        })
        await ctx.streams.chessGameMove.set(game_id, move_id, move_stream)
        logger.info("Game move updated with evaluation", { "move": move_stream })
    except Exception as e:
        logger.error("Error evaluating move", { "error": str(e) })
        raise e
    finally:
        await engine.quit()
