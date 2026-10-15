from fastapi.testclient import TestClient

from backend.main import app
from backend.game import new_board

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_play_response_has_alpha_beta_metrics():
    response = client.post("/api/move", json={"board": new_board(), "mode": "play", "difficulty": 2})
    assert response.status_code == 200
    data = response.json()
    assert data["column"] in range(7)
    assert set(data["metrics"]) == {"alpha_beta"}
    assert data["metrics"]["alpha_beta"]["nodes"] > 0
    assert data["request_ms"] >= data["metrics"]["alpha_beta"]["search_ms"]


def test_accepts_the_first_human_move_in_a_human_first_game():
    board = new_board()
    board[5][3] = 1
    response = client.post(
        "/api/move",
        json={"board": board, "side_to_move": 2, "mode": "play", "difficulty": 2},
    )
    assert response.status_code == 200
    assert response.json()["column"] in range(7)


def test_comparison_returns_both_searches():
    response = client.post("/api/move", json={"board": new_board(), "mode": "comparison", "difficulty": 2})
    assert response.status_code == 200
    data = response.json()
    assert set(data["metrics"]) == {"alpha_beta", "minimax"}
    assert data["column"] == data["metrics"]["alpha_beta"]["column"]
    assert data["metrics"]["alpha_beta"]["score"] == data["metrics"]["minimax"]["score"]


def test_rejects_invalid_board_dimensions():
    assert client.post("/api/move", json={"board": [[0]], "difficulty": 2}).status_code == 422
