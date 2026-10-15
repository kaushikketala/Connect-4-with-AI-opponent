"use client";

import { useMemo, useState } from "react";

type Cell = 0 | 1 | 2;
type Board = Cell[][];
type Position = { row: number; column: number };
type WinningLine = { piece: Cell; cells: Position[]; direction: "horizontal" | "vertical" | "diagonal" };
type Metrics = { search_ms: number; nodes: number; column: number; score: number };
type ComparisonMetrics = { alpha_beta: Metrics; minimax: Metrics };
type MoveResponse = { column: number; request_ms: number; metrics: { alpha_beta: Metrics; minimax?: Metrics } };
const ROWS = 6, COLS = 7;
const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));

function findWinningLine(board: Board): WinningLine | null {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = board[r][c]; if (!p) continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [-1, 1]]) {
      const endR = r + 3 * dr, endC = c + 3 * dc;
      if (endR >= 0 && endR < ROWS && endC >= 0 && endC < COLS && [1, 2, 3].every(i => board[r + i * dr][c + i * dc] === p)) {
        return {
          piece: p,
          cells: Array.from({ length: 4 }, (_, i) => ({ row: r + i * dr, column: c + i * dc })),
          direction: dr === 0 ? "horizontal" : dc === 0 ? "vertical" : "diagonal",
        };
      }
    }
  }
  return null;
}

export default function Home() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [mode, setMode] = useState<"play" | "comparison">("play");
  const [depth, setDepth] = useState<2 | 4 | 6>(4);
  const [lastAiMove, setLastAiMove] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAiBoard, setPendingAiBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<ComparisonMetrics[]>([]);
  const [latencies, setLatencies] = useState<number[]>([]);
  const winningLine = useMemo(() => findWinningLine(board), [board]);
  const win = winningLine?.piece ?? 0;
  const winningCells = new Set(winningLine?.cells.map(({ row, column }) => `${row}-${column}`) ?? []);
  const full = board[0].every(Boolean);
  const finished = Boolean(win || full);
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  function reset(nextMode = mode) {
    setBoard(emptyBoard()); setTurns([]); setLatencies([]); setLastAiMove(null); setPendingAiBoard(null); setError(""); setBusy(false); setMode(nextMode);
  }

  async function playColumn(column: number) {
    if (busy || pendingAiBoard || finished || board[0][column]) return;
    const humanBoard = board.map(row => [...row]);
    for (let r = ROWS - 1; r >= 0; r--) if (!humanBoard[r][column]) { humanBoard[r][column] = 1; break; }
    if (findWinningLine(humanBoard) || humanBoard[0].every(Boolean)) { setBoard(humanBoard); return; }
    setBoard(humanBoard); setBusy(true); setError("");
    await requestAiMove(humanBoard);
  }

  async function requestAiMove(position: Board) {
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const response = await fetch(`${api}/api/move`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: position, side_to_move: 2, mode, difficulty: depth }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const detail = body?.detail;
        const message = typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map(item => typeof item === "string" ? item : item?.msg ?? JSON.stringify(item)).join("; ")
            : `Backend returned ${response.status}`;
        throw new Error(message);
      }
      const result: MoveResponse = await response.json();
      if (mode === "comparison" && !result.metrics.minimax) throw new Error("Comparison metrics were missing from the backend response.");
      const nextBoard = position.map(row => [...row]);
      let aiRow = -1;
      for (let r = ROWS - 1; r >= 0; r--) if (!nextBoard[r][result.column]) { nextBoard[r][result.column] = 2; aiRow = r; break; }
      if (aiRow < 0) throw new Error("The AI returned a full column. Please retry the move.");
      setBoard(nextBoard);
      setLastAiMove({ row: aiRow, column: result.column });
      setPendingAiBoard(null);
      if (mode === "comparison") {
        setTurns(previous => [...previous, { alpha_beta: result.metrics.alpha_beta, minimax: result.metrics.minimax! }]);
        setLatencies(previous => [...previous, performance.now() - started]);
      }
    } catch (cause) {
      setPendingAiBoard(position);
      setError(cause instanceof Error ? cause.message : "Could not reach the game server.");
    } finally { setBusy(false); }
  }

  const totals = useMemo(() => turns.reduce((acc, row) => ({
    abMs: acc.abMs + row.alpha_beta.search_ms, mmMs: acc.mmMs + (row.minimax?.search_ms ?? 0),
    abNodes: acc.abNodes + row.alpha_beta.nodes, mmNodes: acc.mmNodes + (row.minimax?.nodes ?? 0),
  }), { abMs: 0, mmMs: 0, abNodes: 0, mmNodes: 0 }), [turns]);
  const timeSaved = totals.mmMs > 0 ? (totals.mmMs - totals.abMs) / totals.mmMs * 100 : 0;
  const nodesAvoided = totals.mmNodes > 0 ? Math.max(0, (totals.mmNodes - totals.abNodes) / totals.mmNodes * 100) : 0;
  const status = win === 1 ? "You win!" : win === 2 ? "AI wins" : full ? "It’s a draw" : busy ? "AI is thinking…" : pendingAiBoard ? "Retry the AI move to continue" : "Your turn — choose a column";

  return <main className="shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-icon">4</span> FOUR<span className="brand-light">CAST</span></a><span className="top-note"><i /> PYTHON ENGINE · NEXT.JS FRONTEND</span></header>
    <section className="hero"><div><p className="eyebrow">THE CLASSIC, REWIRED</p><h1>Connect four.<br /><em>Think smarter.</em></h1><p className="lede">Play against an AI opponent, or watch two search algorithms compete on every move.</p></div><div className="hero-stats"><div><b>7<span>×</span>6</b><small>GRID</small></div><div><b>2</b><small>ALGORITHMS</small></div><div><b>6</b><small>MAX DEPTH</small></div></div></section>
    <section className="workspace">
      <div className="game-column">
        <div className="toolbar">
          <div className="mode-switch" role="group" aria-label="Game mode"><button className={mode === "play" ? "active" : ""} onClick={() => reset("play")}>Play</button><button className={mode === "comparison" ? "active" : ""} onClick={() => reset("comparison")}>Compare</button></div>
          <label className="difficulty">DIFFICULTY<select value={depth} onChange={e => { setDepth(Number(e.target.value) as 2 | 4 | 6); reset(); }}><option value={2}>Easy · depth 2</option><option value={4}>Medium · depth 4</option><option value={6}>Hard · depth 6</option></select></label>
          <button className="reset-button" onClick={() => reset()}>↻ <span>New game</span></button>
        </div>
        <div className="board-heading"><div className="turn-label"><span className={`disc-mini ${win === 1 ? "red" : "yellow"}`} />{status}</div><span className="mode-tag">{mode === "play" ? "PLAYER VS AI" : "LIVE COMPARISON"}</span></div>
        {winningLine && <div className={`result-banner ${win === 1 ? "human-result" : "ai-result"}`} role="status"><span className="result-icon">{win === 1 ? "✓" : "✳"}</span><div><strong>{win === 1 ? "You win!" : "AI wins!"}</strong><small>Four connected {winningLine.direction}.</small></div></div>}
        {error && <div className="error" role="alert"><span>{error} — your piece is still on the board.</span><button onClick={() => pendingAiBoard && requestAiMove(pendingAiBoard)}>Retry AI move</button></div>}
        <div className={`board ${busy ? "thinking" : ""}`} aria-label="Connect Four board">
          <div className="drop-row">{Array.from({ length: COLS }, (_, c) => <button key={c} className="drop" disabled={busy || Boolean(pendingAiBoard) || finished || Boolean(board[0][c])} aria-label={`Drop piece in column ${c + 1}`} onClick={() => playColumn(c)}>↓</button>)}</div>
          <div className="grid">{board.flatMap((row, r) => row.map((cell, c) => {
            const isWinning = winningCells.has(`${r}-${c}`);
            const isLastAiMove = lastAiMove?.row === r && lastAiMove.column === c;
            return <button key={`${r}-${c}`} className={`cell ${cell === 1 ? "human" : cell === 2 ? "ai" : ""} ${isWinning ? "winning" : ""} ${isLastAiMove ? "last-ai" : ""}`} aria-label={`Row ${r + 1}, column ${c + 1}${cell ? cell === 1 ? ", red piece" : `, yellow piece${isLastAiMove ? ", AI's last move" : ""}` : ", empty"}${isWinning ? ", part of winning line" : ""}`} onClick={() => playColumn(c)} disabled={busy || Boolean(pendingAiBoard) || finished || Boolean(board[0][c])}><span /></button>;
          }))}</div>
        </div>
        <div className="legend"><span><i className="legend-disc red" />YOU</span><span><i className="legend-disc yellow" />ALPHA-BETA AI</span><span><i className="legend-disc yellow last-ai-key" />LAST AI MOVE</span><span className="legend-hint">Click a column to drop</span></div>
      </div>
      <aside className="side-column">
        {mode === "comparison" ? <>
          <div className="panel-title"><div><p className="eyebrow">SEARCH TELEMETRY</p><h2>Algorithm race</h2></div><span className="live-pill"><i /> LIVE</span></div>
          <div className="algo-cards"><article className="algo-card ab"><div className="algo-name"><span className="algo-mark">αβ</span><div><b>Alpha-beta</b><small>PRUNED SEARCH</small></div></div><strong>{totals.abMs.toFixed(2)}<small>ms total</small></strong><div className="algo-foot">{totals.abNodes.toLocaleString()} nodes explored</div></article><article className="algo-card mm"><div className="algo-name"><span className="algo-mark">MM</span><div><b>Minimax</b><small>FULL SEARCH</small></div></div><strong>{totals.mmMs.toFixed(2)}<small>ms total</small></strong><div className="algo-foot">{totals.mmNodes.toLocaleString()} nodes explored</div></article></div>
          <div className="wins-row"><div><span>TIME SAVED</span><b>{timeSaved.toFixed(1)}<small>%</small></b><div className="meter"><i style={{ width: `${Math.max(0, Math.min(timeSaved, 100))}%` }} /></div></div><div><span>NODES AVOIDED</span><b>{nodesAvoided.toFixed(1)}<small>%</small></b><div className="meter mint"><i style={{ width: `${Math.max(0, Math.min(nodesAvoided, 100))}%` }} /></div></div></div>
          <div className="latency-box"><div><span>REQUEST LATENCY</span><b>{latencies.length ? `${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)} ms` : "—"}</b></div><small>Frontend round trip · avg across {latencies.length} {latencies.length === 1 ? "turn" : "turns"}</small></div>
          <div className="turn-log"><div className="log-head"><b>TURN BY TURN</b><span>{turns.length} AI {turns.length === 1 ? "MOVE" : "MOVES"}</span></div>{turns.length ? <div className="log-list">{turns.map((m, i) => <div className="log-row" key={i}><b>0{i + 1}</b><span>αβ <strong>{m.alpha_beta.search_ms.toFixed(2)}ms</strong><small>· {m.alpha_beta.nodes.toLocaleString()} nodes</small></span><span>MM <strong>{m.minimax.search_ms.toFixed(2)}ms</strong><small>· {m.minimax.nodes.toLocaleString()} nodes</small></span></div>)}</div> : <p className="empty-log">Make a move to start the algorithm comparison.</p>}</div>
        </> : <>
          <div className="panel-title"><div><p className="eyebrow">YOUR OPPONENT</p><h2>Meet the AI</h2></div><span className="live-pill"><i /> READY</span></div>
          <div className="opponent-card"><div className="bot-avatar">αβ<span>✳</span></div><div><b>Alpha-beta</b><p>Searches ahead, prunes the paths that cannot improve its choice.</p></div></div>
          <div className="depth-card"><div><span>SEARCH DEPTH</span><b>{depth} <small>plies ahead</small></b></div><div className="depth-dots">{[1,2,3,4,5,6].map(n => <i key={n} className={n <= depth ? "filled" : ""} />)}</div><p>{depth === 2 ? "A quick, easygoing opponent." : depth === 4 ? "A balanced challenge." : "Thinks deeper before every move."}</p></div>
          <div className="how-card"><b>HOW TO PLAY</b><p>Connect four of your red pieces in a row — horizontally, vertically, or diagonally — before the AI connects its yellow pieces.</p><div><span>01</span> Pick a column to drop your piece</div><div><span>02</span> The AI responds with its best move</div><div><span>03</span> First to four in a row wins</div></div>
        </>}
      </aside>
    </section>
    <footer><span>FOURCAST <i>·</i> BUILT TO THINK AHEAD</span><span>MINIMAX vs ALPHA-BETA PRUNING</span></footer>
  </main>;
}
