from __future__ import annotations

import os
from time import perf_counter
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

from .game import AI, COLS, EMPTY, HUMAN, ROWS, alpha_beta, board_count, legal_moves, minimax, winner

app = FastAPI(title="Connect Four AI", version="1.0.0")
frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class MoveRequest(BaseModel):
    board: list[list[int]]
    side_to_move: Literal[1, 2]
    mode: Literal["play", "comparison"] = "play"
    difficulty: Literal[2, 4, 6] = 4

    @model_validator(mode="after")
    def validate_position(self) -> "MoveRequest":
        if len(self.board) != ROWS or any(len(row) != COLS for row in self.board):
            raise ValueError("board must have 6 rows and 7 columns")
        if any(cell not in (EMPTY, HUMAN, AI) for row in self.board for cell in row):
            raise ValueError("board cells must be 0, 1, or 2")
        for col in range(COLS):
            seen_empty = False
            for row in range(ROWS - 1, -1, -1):
                if self.board[row][col] == EMPTY:
                    seen_empty = True
                elif seen_empty:
                    raise ValueError("board contains a piece floating above an empty cell")
        humans, ais = board_count(self.board, HUMAN), board_count(self.board, AI)
        if not (humans == ais or humans == ais + 1):
            raise ValueError("piece counts do not describe a valid human-first game")
        if winner(self.board) is not None or not legal_moves(self.board):
            raise ValueError("game is already finished")
        expected = HUMAN if humans == ais else AI
        if self.side_to_move != expected:
            raise ValueError("side_to_move does not match the board")
        return self


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/move")
def get_move(request: MoveRequest) -> dict:
    started = perf_counter()
    try:
        board = [row[:] for row in request.board]
        chosen = alpha_beta(board, request.difficulty)
        algorithms = {"alpha_beta": chosen}
        if request.mode == "comparison":
            algorithms["minimax"] = minimax([row[:] for row in request.board], request.difficulty)
        elapsed = (perf_counter() - started) * 1000
        return {
            "column": chosen.column,
            "score": chosen.score,
            "difficulty": request.difficulty,
            "metrics": {
                name: {"search_ms": round(result.elapsed_ms, 4), "nodes": result.nodes, "column": result.column, "score": result.score}
                for name, result in algorithms.items()
            },
            "request_ms": round(elapsed, 4),
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

