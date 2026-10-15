import pytest

from backend.game import AI, COLS, EMPTY, HUMAN, ROWS, alpha_beta, drop_piece, is_draw, legal_moves, minimax, new_board, winner


def make_line(direction: str, piece: int = HUMAN):
    board = new_board()
    if direction == "horizontal":
        for c in range(4): board[ROWS - 1][c] = piece
    elif direction == "vertical":
        for r in range(4): board[ROWS - 1 - r][0] = piece
    elif direction == "diagonal":
        for i in range(4): board[ROWS - 1 - i][i] = piece
    else:
        for i in range(4): board[ROWS - 1 - i][COLS - 1 - i] = piece
    return board


@pytest.mark.parametrize("direction", ["horizontal", "vertical", "diagonal", "anti_diagonal"])
def test_detects_wins_in_every_direction(direction):
    assert winner(make_line(direction)) == HUMAN


def test_drop_piece_and_full_column_rejection():
    board = new_board()
    assert drop_piece(board, 2, HUMAN) == ROWS - 1
    for _ in range(ROWS - 1): drop_piece(board, 2, AI)
    assert 2 not in legal_moves(board)
    with pytest.raises(ValueError): drop_piece(board, 2, HUMAN)
    with pytest.raises(ValueError): drop_piece(board, COLS, HUMAN)


def test_full_board_draw():
    board = [
        [AI, HUMAN, HUMAN, AI, AI, HUMAN, AI],
        [HUMAN, AI, AI, AI, HUMAN, HUMAN, AI],
        [AI, AI, HUMAN, HUMAN, AI, AI, HUMAN],
        [HUMAN, HUMAN, AI, AI, AI, HUMAN, AI],
        [HUMAN, AI, HUMAN, HUMAN, HUMAN, AI, HUMAN],
        [HUMAN, AI, HUMAN, AI, HUMAN, HUMAN, AI],
    ]
    assert winner(board) is None
    assert is_draw(board)


def test_alpha_beta_matches_minimax_value_and_explores_no_more_nodes():
    board = new_board()
    drop_piece(board, 3, HUMAN)
    drop_piece(board, 2, AI)
    before = [row[:] for row in board]
    plain, pruned = minimax(board, 2), alpha_beta(board, 2)
    assert plain.score == pruned.score
    assert plain.column in legal_moves(board) and pruned.column in legal_moves(board)
    assert pruned.nodes <= plain.nodes
    assert board == before


def test_depth_only_accepts_supported_levels():
    with pytest.raises(ValueError): minimax(new_board(), 3)
