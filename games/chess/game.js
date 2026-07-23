"use strict";

/* ---------------------------------------------------------------------
 * Chess rules engine (pure functions, no DOM). Board is a flat array of
 * 64 cells, index = rank*8+file (file 0=a..7=h, rank 0=1..7=8), because
 * Firestore replaces arrays wholesale on write — a nested object board
 * would instead get deep-merged and could resurrect captured pieces.
 * ------------------------------------------------------------------- */

function sq(file, rank) {
  return rank * 8 + file;
}
function fileOf(s) {
  return s % 8;
}
function rankOf(s) {
  return Math.floor(s / 8);
}
function inBounds(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}
function color(p) {
  return p ? p[0] : null;
}
function ptype(p) {
  return p ? p[1] : null;
}
function opp(c) {
  return c === "w" ? "b" : "w";
}

function initialBoard() {
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board = new Array(64).fill(null);
  for (let f = 0; f < 8; f++) {
    board[sq(f, 0)] = "w" + back[f];
    board[sq(f, 1)] = "wP";
    board[sq(f, 6)] = "bP";
    board[sq(f, 7)] = "b" + back[f];
  }
  return board;
}

function initialState() {
  return {
    board: initialBoard(),
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    epTarget: null,
  };
}

function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: Object.assign({}, state.castling),
    epTarget: state.epTarget,
  };
}

const KNIGHT_OFFS = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_OFFS = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);

function squareAttacked(board, targetSq, bySide) {
  const tf = fileOf(targetSq), tr = rankOf(targetSq);

  const pawnRankDelta = bySide === "w" ? -1 : 1;
  for (const df of [-1, 1]) {
    const f = tf + df, r = tr + pawnRankDelta;
    if (inBounds(f, r) && board[sq(f, r)] === bySide + "P") return true;
  }

  for (const [df, dr] of KNIGHT_OFFS) {
    const f = tf + df, r = tr + dr;
    if (inBounds(f, r) && board[sq(f, r)] === bySide + "N") return true;
  }

  for (const [df, dr] of KING_OFFS) {
    const f = tf + df, r = tr + dr;
    if (inBounds(f, r) && board[sq(f, r)] === bySide + "K") return true;
  }

  for (const [df, dr] of BISHOP_DIRS) {
    let f = tf + df, r = tr + dr;
    while (inBounds(f, r)) {
      const p = board[sq(f, r)];
      if (p) {
        if (color(p) === bySide && (ptype(p) === "B" || ptype(p) === "Q")) return true;
        break;
      }
      f += df; r += dr;
    }
  }
  for (const [df, dr] of ROOK_DIRS) {
    let f = tf + df, r = tr + dr;
    while (inBounds(f, r)) {
      const p = board[sq(f, r)];
      if (p) {
        if (color(p) === bySide && (ptype(p) === "R" || ptype(p) === "Q")) return true;
        break;
      }
      f += df; r += dr;
    }
  }

  return false;
}

function findKing(board, side) {
  return board.indexOf(side + "K");
}

function isInCheck(state, side) {
  const kingSq = findKing(state.board, side);
  if (kingSq === -1) return false;
  return squareAttacked(state.board, kingSq, opp(side));
}

function pseudoMovesForSquare(state, from) {
  const { board } = state;
  const p = board[from];
  if (!p) return [];
  const side = color(p);
  const type = ptype(p);
  const ff = fileOf(from), fr = rankOf(from);
  const moves = [];

  function tryAdd(tf, tr) {
    if (!inBounds(tf, tr)) return;
    const to = sq(tf, tr);
    const target = board[to];
    if (target && color(target) === side) return;
    moves.push({ from, to, capture: !!target });
  }

  if (type === "P") {
    const dir = side === "w" ? 1 : -1;
    const startRank = side === "w" ? 1 : 6;
    const lastRank = side === "w" ? 7 : 0;
    const oneR = fr + dir;
    if (inBounds(ff, oneR) && !board[sq(ff, oneR)]) {
      if (oneR === lastRank) {
        moves.push({ from, to: sq(ff, oneR), capture: false, promotion: "Q" });
      } else {
        moves.push({ from, to: sq(ff, oneR), capture: false });
        const twoR = fr + 2 * dir;
        if (fr === startRank && !board[sq(ff, twoR)]) {
          moves.push({ from, to: sq(ff, twoR), capture: false, doubleStep: true });
        }
      }
    }
    for (const df of [-1, 1]) {
      const tf = ff + df, tr = fr + dir;
      if (!inBounds(tf, tr)) continue;
      const to = sq(tf, tr);
      const target = board[to];
      if (target && color(target) !== side) {
        if (tr === lastRank) moves.push({ from, to, capture: true, promotion: "Q" });
        else moves.push({ from, to, capture: true });
      } else if (!target && state.epTarget === to) {
        moves.push({ from, to, capture: true, isEnPassant: true });
      }
    }
  } else if (type === "N") {
    for (const [df, dr] of KNIGHT_OFFS) tryAdd(ff + df, fr + dr);
  } else if (type === "K") {
    for (const [df, dr] of KING_OFFS) tryAdd(ff + df, fr + dr);
    const homeRank = side === "w" ? 0 : 7;
    if (fr === homeRank && ff === 4 && !isInCheck(state, side)) {
      const rights = state.castling;
      if (rights[side + "K"]) {
        const f1 = sq(5, homeRank), g1 = sq(6, homeRank), h1 = sq(7, homeRank);
        if (!board[f1] && !board[g1] && board[h1] === side + "R") {
          if (!squareAttacked(board, f1, opp(side)) && !squareAttacked(board, g1, opp(side))) {
            moves.push({ from, to: g1, capture: false, isCastle: "K" });
          }
        }
      }
      if (rights[side + "Q"]) {
        const d1 = sq(3, homeRank), c1 = sq(2, homeRank), b1 = sq(1, homeRank), a1 = sq(0, homeRank);
        if (!board[d1] && !board[c1] && !board[b1] && board[a1] === side + "R") {
          if (!squareAttacked(board, d1, opp(side)) && !squareAttacked(board, c1, opp(side))) {
            moves.push({ from, to: c1, capture: false, isCastle: "Q" });
          }
        }
      }
    }
  } else {
    const dirs = type === "B" ? BISHOP_DIRS : type === "R" ? ROOK_DIRS : QUEEN_DIRS;
    for (const [df, dr] of dirs) {
      let f = ff + df, r = fr + dr;
      while (inBounds(f, r)) {
        const to = sq(f, r);
        const target = board[to];
        if (target) {
          if (color(target) !== side) moves.push({ from, to, capture: true });
          break;
        }
        moves.push({ from, to, capture: false });
        f += df; r += dr;
      }
    }
  }

  return moves;
}

function applyMove(state, move) {
  const next = cloneState(state);
  const board = next.board;
  const p = board[move.from];
  const side = color(p);
  const type = ptype(p);

  board[move.from] = null;

  if (move.isEnPassant) {
    const capturedSq = sq(fileOf(move.to), rankOf(move.from));
    board[capturedSq] = null;
  }

  board[move.to] = move.promotion ? side + move.promotion : p;

  if (move.isCastle) {
    const homeRank = rankOf(move.from);
    if (move.isCastle === "K") {
      board[sq(5, homeRank)] = side + "R";
      board[sq(7, homeRank)] = null;
    } else {
      board[sq(3, homeRank)] = side + "R";
      board[sq(0, homeRank)] = null;
    }
  }

  if (type === "K") {
    next.castling[side + "K"] = false;
    next.castling[side + "Q"] = false;
  }
  function clearRookRight(square, s) {
    const homeRank = s === "w" ? 0 : 7;
    if (square === sq(0, homeRank)) next.castling[s + "Q"] = false;
    if (square === sq(7, homeRank)) next.castling[s + "K"] = false;
  }
  if (type === "R") clearRookRight(move.from, side);
  if (move.capture) clearRookRight(move.to, opp(side));

  next.epTarget = move.doubleStep
    ? sq(fileOf(move.to), rankOf(move.from) + (rankOf(move.to) - rankOf(move.from)) / 2)
    : null;
  next.turn = opp(side);

  return next;
}

function generateLegalMoves(state, side) {
  const legal = [];
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p || color(p) !== side) continue;
    for (const move of pseudoMovesForSquare(state, s)) {
      const after = applyMove(state, move);
      if (!isInCheck(after, side)) legal.push(move);
    }
  }
  return legal;
}

// Only checkmate/stalemate are detected. Threefold repetition, the
// fifty-move rule, and insufficient-material draws are intentionally not
// implemented (known limitation, kept out of scope for this hobby build).
function getGameStatus(state) {
  const side = state.turn;
  const moves = generateLegalMoves(state, side);
  if (moves.length > 0) return { status: "ongoing", winner: null };
  if (isInCheck(state, side)) return { status: "checkmate", winner: opp(side) };
  return { status: "stalemate", winner: null };
}

const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

function evaluate(state) {
  let score = 0;
  for (let s = 0; s < 64; s++) {
    const p = state.board[s];
    if (!p) continue;
    const v = PIECE_VALUES[ptype(p)];
    score += color(p) === "w" ? v : -v;
  }
  const wMoves = generateLegalMoves(state, "w").length;
  const bMoves = generateLegalMoves(state, "b").length;
  score += 0.1 * (wMoves - bMoves);
  return score;
}

function orderMoves(moves) {
  return moves.slice().sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));
}

function minimax(state, depth, alpha, beta, side) {
  const status = getGameStatus(state);
  if (status.status !== "ongoing") {
    if (status.status === "checkmate") {
      return { score: status.winner === "w" ? 1000 - depth : -1000 + depth };
    }
    return { score: 0 };
  }
  if (depth === 0) return { score: evaluate(state) };

  const moves = orderMoves(generateLegalMoves(state, side));
  let best = null;
  if (side === "w") {
    let bestScore = -Infinity;
    for (const m of moves) {
      const after = applyMove(state, m);
      const { score } = minimax(after, depth - 1, alpha, beta, "b");
      if (score > bestScore) { bestScore = score; best = m; }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: best };
  }
  let bestScore = Infinity;
  for (const m of moves) {
    const after = applyMove(state, m);
    const { score } = minimax(after, depth - 1, alpha, beta, "w");
    if (score < bestScore) { bestScore = score; best = m; }
    beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: best };
}

// Search depth is a deliberately conservative default: this sandbox has no
// JS runtime to benchmark actual in-browser search speed, so depth 3 (the
// original target) was untestable here. Bump to 3 if it feels too easy/fast
// once you've tried it live in a real browser.
const MAX_CPU_DEPTH = 2;

function getCpuMove(state, side, depth) {
  return minimax(state, depth, -Infinity, Infinity, side).move;
}

/* ---------------------------------------------------------------------
 * UI
 * ------------------------------------------------------------------- */

const PIECE_UNICODE = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

const modeSelectEl = document.getElementById("mode-select");
const onlineSetupEl = document.getElementById("online-setup");
const onlineChoiceEl = document.getElementById("online-choice");
const roomInfoEl = document.getElementById("room-info");
const roomCodeDisplay = document.getElementById("room-code-display");
const copyInviteBtn = document.getElementById("copy-invite-btn");
const copyStatusEl = document.getElementById("copy-status");
const emailInviteLink = document.getElementById("email-invite-link");
const inviteLinkFallbackEl = document.getElementById("invite-link-fallback");
const waitingStatusEl = document.getElementById("waiting-status");
const onlineErrorEl = document.getElementById("online-error");
const joinCodeInput = document.getElementById("join-code-input");
const boardScreenEl = document.getElementById("board-screen");
const boardEl = document.getElementById("board");
const sideLabelEl = document.getElementById("side-label");
const turnIndicatorEl = document.getElementById("turn-indicator");
const cpuThinkingEl = document.getElementById("cpu-thinking");
const resultBannerEl = document.getElementById("result-banner");
const resultHeadingEl = document.getElementById("result-heading");

// Board theme / piece style, set on games/chess/customize.html and read here.
// "classic" (the default look) needs no extra class — see the theme-*/pieces-*
// rules in style.css.
const BOARD_THEME_KEY = "chessBoardTheme";
const PIECE_STYLE_KEY = "chessPieceStyle";

function applyChessAppearance() {
  const theme = localStorage.getItem(BOARD_THEME_KEY) || "classic";
  const pieceStyle = localStorage.getItem(PIECE_STYLE_KEY) || "classic";
  const classes = ["board"];
  if (theme !== "classic") classes.push("theme-" + theme);
  if (pieceStyle !== "classic") classes.push("pieces-" + pieceStyle);
  boardEl.className = classes.join(" ");
}
applyChessAppearance();

let state = null;
let mode = null; // "cpu" | "online"
let mySide = "w"; // side the human plays; p1 is always White
let roomId = null;
let unsubscribeRoom = null;
let selectedSquare = null;
let legalMovesForSelected = [];
let isGameOver = false;
let resultShown = false;
let cpuThinking = false;
let lastCpuResult = null; // tracks last CPU-mode round: "draw" | "decisive" | null
let lastMove = null; // { from, to } squareIndex of the most recent move, for highlighting

function showScreen(name) {
  modeSelectEl.hidden = name !== "menu";
  onlineSetupEl.hidden = name !== "online";
  boardScreenEl.hidden = name !== "board";
}

function canInteract() {
  if (cpuThinking || isGameOver) return false;
  return state.turn === mySide;
}

function render() {
  boardEl.innerHTML = "";
  for (let displayRank = 7; displayRank >= 0; displayRank--) {
    for (let file = 0; file < 8; file++) {
      const squareIndex = sq(file, displayRank);
      const btn = document.createElement("button");
      btn.className = "square " + (((file + displayRank) % 2 === 0) ? "dark" : "light");
      const piece = state.board[squareIndex];
      if (piece) {
        const span = document.createElement("span");
        span.className = color(piece) === "w" ? "piece-white" : "piece-black";
        span.textContent = PIECE_UNICODE[piece];
        btn.appendChild(span);
      }
      if (selectedSquare === squareIndex) btn.classList.add("selected");
      if (legalMovesForSelected.some((m) => m.to === squareIndex)) btn.classList.add("legal-move");
      if (lastMove && (squareIndex === lastMove.from || squareIndex === lastMove.to)) {
        btn.classList.add("last-move");
      }
      btn.disabled = !canInteract();
      btn.addEventListener("click", () => onSquareClick(squareIndex));
      boardEl.appendChild(btn);
    }
  }
  const check = isInCheck(state, state.turn) ? " — check!" : "";
  turnIndicatorEl.textContent = (state.turn === "w" ? "White" : "Black") + " to move" + check;
  sideLabelEl.textContent = mode === "online" ? "You are " + (mySide === "w" ? "White" : "Black") : "";
  cpuThinkingEl.hidden = !cpuThinking;
}

function onSquareClick(squareIndex) {
  if (!canInteract()) return;
  const piece = state.board[squareIndex];

  if (selectedSquare === null) {
    if (piece && color(piece) === state.turn) {
      selectedSquare = squareIndex;
      legalMovesForSelected = generateLegalMoves(state, state.turn).filter((m) => m.from === squareIndex);
      render();
    }
    return;
  }

  if (squareIndex === selectedSquare) {
    selectedSquare = null;
    legalMovesForSelected = [];
    render();
    return;
  }

  const move = legalMovesForSelected.find((m) => m.to === squareIndex);
  if (move) {
    makeMove(move);
    return;
  }

  if (piece && color(piece) === state.turn) {
    selectedSquare = squareIndex;
    legalMovesForSelected = generateLegalMoves(state, state.turn).filter((m) => m.from === squareIndex);
    render();
    return;
  }

  selectedSquare = null;
  legalMovesForSelected = [];
  render();
}

async function makeMove(move) {
  state = applyMove(state, move);
  lastMove = { from: move.from, to: move.to };
  selectedSquare = null;
  legalMovesForSelected = [];

  if (mode === "online") {
    render();
    const status = getGameStatus(state);
    const updates = { state, lastMove, turn: state.turn === "w" ? "p1" : "p2" };
    if (status.status !== "ongoing") {
      updates.status = "finished";
      updates.winner = status.winner;
    }
    try {
      await BoardGameMultiplayer.updateRoomState(roomId, updates);
    } catch (err) {
      console.error("[chess] failed to sync move", err);
    }
    // The result banner (for both players) is driven by the room snapshot
    // listener below, not shown directly here, so it only fires once.
    return;
  }

  const status = getGameStatus(state);
  render();
  if (status.status !== "ongoing") {
    isGameOver = true;
    showResult(status.winner);
    return;
  }

  triggerCpuMoveIfNeeded();
}

// Kicks off the CPU's move whenever it's the CPU's turn in CPU mode — called
// both after a human move and right after starting a round where the CPU
// opens (see mode-cpu handler below).
function triggerCpuMoveIfNeeded() {
  if (mode !== "cpu" || isGameOver || state.turn === mySide) return;
  cpuThinking = true;
  render();
  setTimeout(() => {
    const cpuMove = getCpuMove(state, state.turn, MAX_CPU_DEPTH);
    state = applyMove(state, cpuMove);
    lastMove = { from: cpuMove.from, to: cpuMove.to };
    cpuThinking = false;
    const cpuStatus = getGameStatus(state);
    render();
    if (cpuStatus.status !== "ongoing") {
      isGameOver = true;
      showResult(cpuStatus.winner);
    }
  }, 3000);
}

function showResult(winner) {
  let text, result;
  if (winner === null) {
    text = "Draw — Stalemate";
    result = "draw";
  } else {
    text = "Checkmate — " + (winner === "w" ? "White" : "Black") + " wins!";
    result = winner === mySide ? "win" : "loss";
  }
  resultHeadingEl.textContent = text;
  resultBannerEl.hidden = false;
  if (typeof savePlatformProgress === "function") {
    try {
      savePlatformProgress("chess", { result });
    } catch (err) {
      // non-fatal — progress tracking should never break the game
    }
  }
  if (mode === "cpu") lastCpuResult = winner === null ? "draw" : "decisive";
}

/* ---- CPU mode ---- */

document.getElementById("mode-cpu").addEventListener("click", () => {
  mode = "cpu";
  // If the previous round vs CPU ended in a draw, the CPU opens this round
  // (plays White) instead of the human — chess has no "Black moves first",
  // so swapping sides is how the CPU gets the first move.
  mySide = lastCpuResult === "draw" ? "b" : "w";
  state = initialState();
  selectedSquare = null;
  legalMovesForSelected = [];
  lastMove = null;
  isGameOver = false;
  resultShown = false;
  showScreen("board");
  render();
  triggerCpuMoveIfNeeded();
});

/* ---- Online mode ---- */

function showOnlineError(message) {
  onlineErrorEl.textContent = message;
  onlineErrorEl.hidden = false;
}

function setupInviteLinks(rid) {
  const joinUrl = location.origin + location.pathname + "?join=" + encodeURIComponent(rid);
  copyInviteBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      copyStatusEl.textContent = "Copied!";
      inviteLinkFallbackEl.hidden = true;
    } catch (err) {
      copyStatusEl.textContent = "";
      inviteLinkFallbackEl.hidden = false;
      inviteLinkFallbackEl.textContent = joinUrl;
    }
  };
  const subject = encodeURIComponent("Play Chess with me");
  const body = encodeURIComponent("Join my game: " + joinUrl);
  emailInviteLink.href = "mailto:?subject=" + subject + "&body=" + body;
}

function cleanupRoom() {
  if (unsubscribeRoom) {
    unsubscribeRoom();
    unsubscribeRoom = null;
  }
  roomId = null;
}

function onRoomSnapshot(data) {
  state = data.state;
  lastMove = data.lastMove || null;
  if (data.status === "waiting") {
    showScreen("online");
    return;
  }
  showScreen("board");
  selectedSquare = null;
  legalMovesForSelected = [];
  render();
  if (data.status === "finished") {
    isGameOver = true;
    if (!resultShown) {
      resultShown = true;
      showResult(data.winner);
    }
  }
}

async function enterRoom(rid, slot) {
  mode = "online";
  roomId = rid;
  mySide = slot === "p1" ? "w" : "b";
  isGameOver = false;
  resultShown = false;
  unsubscribeRoom = BoardGameMultiplayer.subscribeRoom(rid, onRoomSnapshot);
}

document.getElementById("mode-online").addEventListener("click", () => {
  onlineErrorEl.hidden = true;
  onlineChoiceEl.hidden = false;
  roomInfoEl.hidden = true;
  joinCodeInput.value = "";
  showScreen("online");
});

document.getElementById("online-back-btn").addEventListener("click", () => {
  showScreen("menu");
});

document.getElementById("create-room-btn").addEventListener("click", async () => {
  onlineErrorEl.hidden = true;
  try {
    const initial = initialState();
    const { roomId: rid, playerSlot: slot } = await BoardGameMultiplayer.createRoom("chess", initial);
    onlineChoiceEl.hidden = true;
    roomInfoEl.hidden = false;
    roomCodeDisplay.textContent = rid;
    waitingStatusEl.hidden = false;
    copyStatusEl.textContent = "";
    setupInviteLinks(rid);
    await enterRoom(rid, slot);
  } catch (err) {
    showOnlineError(err.message || "Couldn't create a room. Try again.");
  }
});

async function attemptJoin(code) {
  if (!code) return;
  onlineErrorEl.hidden = true;
  try {
    const { roomId: rid, playerSlot: slot } = await BoardGameMultiplayer.joinRoom("chess", code);
    await enterRoom(rid, slot);
  } catch (err) {
    showOnlineError(err.message || "Couldn't join that room.");
  }
}

document.getElementById("join-room-btn").addEventListener("click", () => {
  attemptJoin(joinCodeInput.value);
});

/* ---- Result banner actions ---- */

document.getElementById("play-again-btn").addEventListener("click", () => {
  resultBannerEl.hidden = true;
  isGameOver = false;
  resultShown = false;
  if (mode === "cpu") {
    mySide = lastCpuResult === "draw" ? "b" : "w";
    state = initialState();
    selectedSquare = null;
    legalMovesForSelected = [];
    lastMove = null;
    render();
    triggerCpuMoveIfNeeded();
  } else {
    cleanupRoom();
    showScreen("menu");
  }
});

document.getElementById("menu-btn").addEventListener("click", () => {
  resultBannerEl.hidden = true;
  cleanupRoom();
  showScreen("menu");
});

/* ---- Invite-link auto-join ---- */

(function autoJoinFromUrl() {
  const params = new URLSearchParams(location.search);
  const joinParam = params.get("join");
  if (!joinParam) return;
  onlineErrorEl.hidden = true;
  onlineChoiceEl.hidden = false;
  roomInfoEl.hidden = true;
  joinCodeInput.value = joinParam.toUpperCase();
  showScreen("online");
  attemptJoin(joinParam);
})();
