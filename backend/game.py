"""Connect Four rules and fixed-depth search algorithms."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Literal

ROWS = 6
COLS = 7
EMPTY = 0
HUMAN = 1
AI = 2
WIN_SCORE = 1_000_000
Board = list[list[int]]


def new_board() -> Board:
    return [[EMPTY for _ in range(COLS)] for _ in range(ROWS)]


def legal_moves(board: Board) -> list[int]:
    return [c for c in range(COLS) if board[0][c] == EMPTY]


def drop_piece(board: Board, column: int, piece: int) -> int:
    if piece not in (HUMAN, AI):
        raise ValueError("piece must be 1 or 2")
    if column not in range(COLS) or board[0][column] != EMPTY:
        raise ValueError("column is full or out of range")
    for row in range(ROWS - 1, -1, -1):
        if board[row][column] == EMPTY:
            board[row][column] = piece
            return row
    raise ValueError("column is full")


def winner(board: Board) -> int | None:
    for r in range(ROWS):
        for c in range(COLS):
            piece = board[r][c]
            if piece == EMPTY:
                continue
            for dr, dc in ((0, 1), (1, 0), (1, 1), (-1, 1)):
                end_r, end_c = r + 3 * dr, c + 3 * dc
                if 0 <= end_r < ROWS and 0 <= end_c < COLS and all(
                    board[r + i * dr][c + i * dc] == piece for i in range(1, 4)
                ):
                    return piece
    return None


def is_draw(board: Board) -> bool:
    return winner(board) is None and not legal_moves(board)


def evaluate(board: Board) -> int:
    """Score a position from AI's perspective, including a center preference."""
    score = sum(3 if board[r][3] == AI else -3 if board[r][3] == HUMAN else 0 for r in range(ROWS))
    windows: list[list[int]] = []
    for r in range(ROWS):
        for c in range(COLS - 3):
            windows.append([board[r][c + i] for i in range(4)])
    for r in range(ROWS - 3):
        for c in range(COLS):
            windows.append([board[r + i][c] for i in range(4)])
    for r in range(ROWS - 3):
        for c in range(COLS - 3):
            windows.append([board[r + i][c + i] for i in range(4)])
            windows.append([board[r + 3 - i][c + i] for i in range(4)])
    weights = {1: 1, 2: 12, 3: 90}
    for window in windows:
        ai_count, human_count, empty_count = window.count(AI), window.count(HUMAN), window.count(EMPTY)
        if ai_count and human_count:
            continue
        if ai_count:
            score += weights.get(ai_count, 0)
            if ai_count == 3 and empty_count == 1:
                score += 35
        elif human_count:
            score -= weights.get(human_count, 0)
            if human_count == 3 and empty_count == 1:
                score -= 40
    return score


@dataclass(frozen=True)
class SearchResult:
    column: int | None
    score: int
    nodes: int
    elapsed_ms: float


def _search(board: Board, depth: int, pruning: bool) -> SearchResult:
    if depth not in (2, 4, 6):
        raise ValueError("depth must be 2, 4, or 6")
    if winner(board) is not None or not legal_moves(board):
        raise ValueError("cannot search a finished position")
    started = perf_counter()
    nodes = 0

    def visit(remaining: int, maximizing: bool, alpha: float, beta: float, ply: int) -> int:
        nonlocal nodes
        nodes += 1
        won = winner(board)
        if won == AI:
            return WIN_SCORE - ply
        if won == HUMAN:
            return -WIN_SCORE + ply
        moves = legal_moves(board)
        if remaining == 0 or not moves:
            return evaluate(board)
        if maximizing:
            value = -float("inf")
            for col in moves:
                row = drop_piece(board, col, AI)
                value = max(value, visit(remaining - 1, False, alpha, beta, ply + 1))
                board[row][col] = EMPTY
                if pruning:
                    alpha = max(alpha, value)
                    if alpha >= beta:
                        break
            return int(value)
        value = float("inf")
        for col in moves:
            row = drop_piece(board, col, HUMAN)
            value = min(value, visit(remaining - 1, True, alpha, beta, ply + 1))
            board[row][col] = EMPTY
            if pruning:
                beta = min(beta, value)
                if alpha >= beta:
                    break
        return int(value)

    moves = legal_moves(board)
    maximizing = board_count(board, AI) == board_count(board, HUMAN)
    best_col = moves[0]
    best_value = -float("inf") if maximizing else float("inf")
    alpha, beta = -float("inf"), float("inf")
    for col in moves:
        row = drop_piece(board, col, AI if maximizing else HUMAN)
        value = visit(depth - 1, not maximizing, alpha, beta, 1)
        board[row][col] = EMPTY
        if (maximizing and value > best_value) or (not maximizing and value < best_value):
            best_value, best_col = value, col
        if pruning:
            if maximizing:
                alpha = max(alpha, best_value)
            else:
                beta = min(beta, best_value)
    return SearchResult(best_col, int(best_value), nodes, (perf_counter() - started) * 1000)


def board_count(board: Board, piece: int) -> int:
    return sum(cell == piece for row in board for cell in row)


def minimax(board: Board, depth: int) -> SearchResult:
    return _search(board, depth, pruning=False)


def alpha_beta(board: Board, depth: int) -> SearchResult:
    return _search(board, depth, pruning=True)

