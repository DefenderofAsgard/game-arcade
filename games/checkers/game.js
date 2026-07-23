// ---------------------------------------------------------------------------
// Pure game logic (board is a flat 64-cell array; row-major, row 0 = red's
// back row). No DOM access above this line — keeps it testable under Node.
// ---------------------------------------------------------------------------
const SIZE = 8;

function idx(row, col) {
  return row * SIZE + col;
}
function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}
function createInitialBoard() {
  const board = new Array(SIZE * SIZE).fill(null);
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      if ((row + col) % 2 !== 1) continue;
      if (row <= 2) board[idx(row, col)] = "r";
      else if (row >= 5) board[idx(row, col)] = "b";
    }
  }
  return board;
}
function pieceColor(piece) {
  return piece ? piece.toLowerCase() : null;
}
function isKing(piece) {
  return piece === "R" || piece === "B";
}
function opponentOf(side) {
  return side === "r" ? "b" : "r";
}
function dirsFor(piece, side) {
  if (isKing(piece)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return side === "r" ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
}
function promotionRow(side) {
  return side === "r" ? SIZE - 1 : 0;
}
function maybePromote(piece, row) {
  if (piece === "r" && row === promotionRow("r")) return "R";
  if (piece === "b" && row === promotionRow("b")) return "B";
  return piece;
}

function singleJumpsFrom(board, row, col) {
  const piece = board[idx(row, col)];
  if (!piece) return [];
  const side = pieceColor(piece);
  const results = [];
  for (const [dr, dc] of dirsFor(piece, side)) {
    const midRow = row + dr,
      midCol = col + dc;
    const landRow = row + dr * 2,
      landCol = col + dc * 2;
    if (!inBounds(landRow, landCol)) continue;
    const midPiece = board[idx(midRow, midCol)];
    if (!midPiece || pieceColor(midPiece) === side) continue;
    if (board[idx(landRow, landCol)] !== null) continue;
    results.push({ midRow, midCol, landRow, landCol });
  }
  return results;
}

function simpleMovesFrom(board, row, col) {
  const piece = board[idx(row, col)];
  if (!piece) return [];
  const side = pieceColor(piece);
  const results = [];
  for (const [dr, dc] of dirsFor(piece, side)) {
    const r = row + dr,
      c = col + dc;
    if (inBounds(r, c) && board[idx(r, c)] === null) results.push({ row: r, col: c });
  }
  return results;
}

// Enumerates every maximal capture chain starting at (row,col). A chain stops
// as soon as the piece promotes (even if further jumps would exist) or when
// no further jump is available from the landing square. No "must capture the
// most pieces" rule — any legal chain, of any length, is a valid choice.
function captureChainsFrom(board, row, col) {
  const chains = [];

  function dfs(curRow, curCol, curBoard, path, captures) {
    const jumps = singleJumpsFrom(curBoard, curRow, curCol);
    if (jumps.length === 0) {
      if (path.length > 0) chains.push({ from: { row, col }, path: path.slice(), captures: captures.slice() });
      return;
    }
    for (const j of jumps) {
      const nextBoard = curBoard.slice();
      const movingPiece = curBoard[idx(curRow, curCol)];
      nextBoard[idx(curRow, curCol)] = null;
      nextBoard[idx(j.midRow, j.midCol)] = null;
      const promotedPiece = maybePromote(movingPiece, j.landRow);
      const promoted = promotedPiece !== movingPiece;
      nextBoard[idx(j.landRow, j.landCol)] = promotedPiece;

      const newPath = path.concat([{ row: j.landRow, col: j.landCol }]);
      const newCaptures = captures.concat([{ row: j.midRow, col: j.midCol }]);

      if (promoted) {
        chains.push({ from: { row, col }, path: newPath, captures: newCaptures });
      } else {
        dfs(j.landRow, j.landCol, nextBoard, newPath, newCaptures);
      }
    }
  }

  dfs(row, col, board, [], []);
  return chains;
}

// Returns all legal moves for `side`. If any capture chain exists anywhere on
// the board for that side, ONLY capture moves are legal (mandatory capture).
function getLegalMoves(board, side) {
  let allChains = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const piece = board[idx(row, col)];
      if (piece && pieceColor(piece) === side) {
        allChains = allChains.concat(captureChainsFrom(board, row, col));
      }
    }
  }
  if (allChains.length > 0) {
    return allChains.map((c) => ({ type: "capture", from: c.from, path: c.path, captures: c.captures }));
  }
  const simples = [];
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const piece = board[idx(row, col)];
      if (piece && pieceColor(piece) === side) {
        for (const to of simpleMovesFrom(board, row, col)) {
          simples.push({ type: "simple", from: { row, col }, to });
        }
      }
    }
  }
  return simples;
}

function applyMove(board, move) {
  const next = board.slice();
  if (move.type === "simple") {
    const piece = next[idx(move.from.row, move.from.col)];
    next[idx(move.from.row, move.from.col)] = null;
    next[idx(move.to.row, move.to.col)] = maybePromote(piece, move.to.row);
  } else {
    const piece = board[idx(move.from.row, move.from.col)];
    next[idx(move.from.row, move.from.col)] = null;
    for (const cap of move.captures) next[idx(cap.row, cap.col)] = null;
    const last = move.path[move.path.length - 1];
    next[idx(last.row, last.col)] = maybePromote(piece, last.row);
  }
  return next;
}

function checkGameOver(board, sideToMove) {
  const moves = getLegalMoves(board, sideToMove);
  if (moves.length === 0) return { winner: opponentOf(sideToMove) };
  return null;
}

function evaluate(board, side) {
  let score = 0;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const piece = board[idx(row, col)];
      if (!piece) continue;
      const color = pieceColor(piece);
      const king = isKing(piece);
      let val = king ? 1.75 : 1;
      if (!king) {
        const progress = color === "r" ? row / (SIZE - 1) : (SIZE - 1 - row) / (SIZE - 1);
        val += progress * 0.25;
      }
      const centerDist = Math.abs(col - 3.5);
      val += (3.5 - centerDist) * 0.02;
      score += color === side ? val : -val;
    }
  }
  return score;
}

function minimax(board, side, sideToMove, depth, alpha, beta) {
  const moves = getLegalMoves(board, sideToMove);
  if (moves.length === 0) {
    // sideToMove has no moves available and loses immediately.
    return sideToMove === side ? -1000 - depth : 1000 + depth;
  }
  if (depth === 0) return evaluate(board, side);

  const maximizing = sideToMove === side;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const val = minimax(nextBoard, side, opponentOf(sideToMove), depth - 1, alpha, beta);
    if (maximizing) {
      if (val > best) best = val;
      alpha = Math.max(alpha, val);
    } else {
      if (val < best) best = val;
      beta = Math.min(beta, val);
    }
    if (beta <= alpha) break;
  }
  return best;
}

function getCpuMove(board, side, depth) {
  const moves = getLegalMoves(board, side);
  if (moves.length === 0) return null;
  let bestMove = moves[0];
  let bestVal = -Infinity;
  for (const move of moves) {
    const nextBoard = applyMove(board, move);
    const val = minimax(nextBoard, side, opponentOf(side), depth - 1, -Infinity, Infinity);
    if (val > bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }
  return bestMove;
}

const CPU_SEARCH_DEPTH = 6;

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    createInitialBoard,
    getLegalMoves,
    applyMove,
    checkGameOver,
    singleJumpsFrom,
    captureChainsFrom,
    getCpuMove,
  };
}

// ---------------------------------------------------------------------------
// Browser UI + multiplayer wiring (only runs when a DOM is present).
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

function init() {
  const modeSelect = document.getElementById("mode-select");
  const onlineChoices = document.getElementById("online-choices");
  const gameScreen = document.getElementById("game-screen");
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const roomInfoEl = document.getElementById("room-info");
  const roomCodeTextEl = document.getElementById("room-code-text");
  const inviteActionsEl = document.getElementById("invite-actions");
  const btnCopyInvite = document.getElementById("btn-copy-invite");
  const emailInviteLink = document.getElementById("email-invite-link");
  const copyFeedbackEl = document.getElementById("copy-feedback");
  const resultBanner = document.getElementById("result-banner");
  const resultText = document.getElementById("result-text");
  const btnVsCpu = document.getElementById("btn-vs-cpu");
  const btnOnline = document.getElementById("btn-online");
  const btnCreateRed = document.getElementById("btn-create-red");
  const btnCreateBlack = document.getElementById("btn-create-black");
  const btnJoinRoom = document.getElementById("btn-join-room");
  const joinCodeInput = document.getElementById("join-code");
  const onlineError = document.getElementById("online-error");
  const btnPlayAgain = document.getElementById("btn-play-again");
  const btnBackToMenu = document.getElementById("btn-back-to-menu");

  let board = null;
  let mode = null; // "cpu" | "online"
  let mySide = "b"; // color this browser plays (vs-cpu: always Black, CPU is Red)
  let hostColor = "r"; // online only: color the room creator (p1) chose; p2 gets the other
  let currentTurn = "r"; // color to move, local truth in cpu mode
  let selected = null; // { row, col } of the piece mid-selection/mid-jump
  let workingBoard = null; // board snapshot used while stepping a multi-jump
  let chainCaptures = null;
  let gameOver = false;
  let roomId = null;
  let mySlot = null; // "p1" | "p2" (online only)
  let unsubscribe = null;

  function colorForSlot(slot) {
    return slot === "p1" ? hostColor : opponentOf(hostColor);
  }
  function slotForColor(color) {
    return color === hostColor ? "p1" : "p2";
  }

  function inviteUrlFor(id) {
    return location.origin + location.pathname + "?join=" + id;
  }

  function showInvite(id) {
    const url = inviteUrlFor(id);
    inviteActionsEl.hidden = false;
    emailInviteLink.href =
      "mailto:?subject=" +
      encodeURIComponent("Play Checkers with me") +
      "&body=" +
      encodeURIComponent("Join my checkers game: " + url);
    btnCopyInvite.onclick = () => copyInviteLink(url);
  }

  function hideInvite() {
    inviteActionsEl.hidden = true;
    copyFeedbackEl.hidden = true;
  }

  async function copyInviteLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      copyFeedbackEl.textContent = "Copied!";
    } catch (err) {
      copyFeedbackEl.textContent = url;
    }
    copyFeedbackEl.hidden = false;
    setTimeout(() => {
      copyFeedbackEl.hidden = true;
    }, 2500);
  }

  function recordResult(result) {
    try {
      if (typeof savePlatformProgress === "function") {
        savePlatformProgress("checkers", { result });
      }
    } catch (err) {
      console.error("[checkers] savePlatformProgress failed", err);
    }
  }

  function showScreen(name) {
    modeSelect.hidden = name !== "menu";
    gameScreen.hidden = name !== "game";
  }

  function startVsCpu() {
    mode = "cpu";
    mySide = "b"; // player is Black; CPU plays Red and moves first
    board = createInitialBoard();
    currentTurn = "r";
    gameOver = false;
    selected = null;
    roomInfoEl.hidden = true;
    resultBanner.hidden = true;
    showScreen("game");
    render();
    maybeTriggerCpuTurn();
  }

  // Kicks off the CPU's opening move in vs-CPU mode, since Red (the CPU) now
  // moves first. Also safe to call anywhere else it might be needed — it's a
  // no-op unless it's actually the CPU's turn.
  function maybeTriggerCpuTurn() {
    if (mode !== "cpu" || gameOver || currentTurn === mySide) return;
    statusEl.textContent = "CPU is thinking...";
    setTimeout(cpuTurn, 3000);
  }

  async function startCreateRoom(color) {
    onlineError.textContent = "";
    hostColor = color;
    board = createInitialBoard();
    try {
      const { roomId: id, playerSlot } = await BoardGameMultiplayer.createRoom("checkers", {
        board,
        hostColor: color,
      });
      roomId = id;
      mySlot = playerSlot;
      mySide = colorForSlot(playerSlot);
      mode = "online";
      gameOver = false;
      selected = null;
      resultBanner.hidden = true;
      roomInfoEl.hidden = false;
      roomCodeTextEl.textContent = "Room code: " + roomId + " — share it with your friend. Waiting for them to join...";
      showInvite(roomId);
      showScreen("game");
      subscribeToRoom();
      // The shared room helper always starts a fresh room's turn at "p1" —
      // correct it so Red opens, regardless of which slot picked Red.
      if (hostColor === "b") {
        BoardGameMultiplayer.updateRoomState(roomId, { turn: "p2" });
      }
    } catch (err) {
      onlineError.textContent = err.message || "Could not create room.";
    }
  }

  async function startJoinRoom() {
    onlineError.textContent = "";
    const code = joinCodeInput.value.trim();
    if (!code) {
      onlineError.textContent = "Enter a room code.";
      return;
    }
    try {
      const { roomId: id, playerSlot, data } = await BoardGameMultiplayer.joinRoom("checkers", code);
      roomId = id;
      mySlot = playerSlot;
      hostColor = (data && data.state && data.state.hostColor) || "r";
      mySide = colorForSlot(playerSlot);
      mode = "online";
      gameOver = false;
      selected = null;
      resultBanner.hidden = true;
      roomInfoEl.hidden = false;
      hideInvite();
      showScreen("game");
      subscribeToRoom();
    } catch (err) {
      onlineError.textContent = err.message || "Could not join room.";
    }
  }

  function subscribeToRoom() {
    if (unsubscribe) unsubscribe();
    unsubscribe = BoardGameMultiplayer.subscribeRoom(roomId, (data) => {
      hostColor = (data.state && data.state.hostColor) || hostColor;
      mySide = colorForSlot(mySlot);
      board = data.state.board;
      currentTurn = colorForSlot(data.turn);
      gameOver = data.status === "finished";
      selected = null;
      if (data.status === "waiting") {
        roomCodeTextEl.textContent = "Room code: " + roomId + " — share it with your friend. Waiting for them to join...";
        if (mySlot === "p1") showInvite(roomId);
        else hideInvite();
      } else {
        hideInvite();
        if (!gameOver) roomCodeTextEl.textContent = "Room code: " + roomId;
      }
      if (gameOver && data.winner) {
        const iWon = data.winner === mySlot;
        showResult(iWon ? "You win!" : "You lose.");
        recordResult(iWon ? "win" : "loss");
      }
      render();
    });
  }

  function showResult(text) {
    resultBanner.hidden = false;
    resultText.textContent = text;
  }

  function isMyTurn() {
    if (gameOver) return false;
    if (mode === "cpu") return currentTurn === mySide;
    return currentTurn === mySide && mySlot === slotForColor(currentTurn);
  }

  function render() {
    boardEl.innerHTML = "";
    const displayBoard = workingBoard || board;

    // Figure out which squares the selected piece can legally move to, so we
    // can highlight them — without this, selecting a piece gives no visible
    // clue about where a click will actually land.
    let legalTargets = [];
    if (selected) {
      const legalMoves = getLegalMoves(displayBoard, currentTurn);
      const mandatoryCapture = legalMoves.length > 0 && legalMoves[0].type === "capture";
      if (mandatoryCapture || (chainCaptures && chainCaptures.length > 0)) {
        legalTargets = singleJumpsFrom(displayBoard, selected.row, selected.col).map((j) => ({
          row: j.landRow,
          col: j.landCol,
        }));
      } else {
        legalTargets = simpleMovesFrom(displayBoard, selected.row, selected.col);
      }
    }

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const cell = document.createElement("div");
        const dark = (row + col) % 2 === 1;
        cell.className = "cell " + (dark ? "dark" : "light");
        if (selected && selected.row === row && selected.col === col) cell.classList.add("selected");
        if (legalTargets.some((t) => t.row === row && t.col === col)) cell.classList.add("legal-target");
        if (dark) {
          const piece = displayBoard[idx(row, col)];
          if (piece) {
            const p = document.createElement("div");
            p.className = "piece " + (pieceColor(piece) === "r" ? "red" : "black") + (isKing(piece) ? " king" : "");
            cell.appendChild(p);
          }
          cell.addEventListener("click", () => onCellClick(row, col));
        }
        boardEl.appendChild(cell);
      }
    }

    if (gameOver) {
      statusEl.textContent = "Game over.";
    } else if (mode === "online" && !unsubscribe) {
      statusEl.textContent = "";
    } else if (mode === "online" && currentTurn && !isMyTurn() && !selected) {
      statusEl.textContent = "Waiting for opponent...";
    } else if (isMyTurn() || (mode === "cpu" && currentTurn === mySide)) {
      statusEl.textContent = "Your move.";
    } else if (mode === "cpu") {
      statusEl.textContent = "CPU is thinking...";
    }
  }

  function onCellClick(row, col) {
    if (gameOver) return;
    if (mode === "cpu" && currentTurn !== mySide) return;
    if (mode === "online" && !isMyTurn() && !selected) return;

    const activeBoard = workingBoard || board;
    const legalMoves = getLegalMoves(activeBoard, currentTurn);
    const mandatoryCapture = legalMoves.length > 0 && legalMoves[0].type === "capture";

    if (!selected) {
      const piece = activeBoard[idx(row, col)];
      if (!piece || pieceColor(piece) !== currentTurn) return;
      if (mandatoryCapture && captureChainsFrom(activeBoard, row, col).length === 0) return;
      selected = { row, col };
      workingBoard = null;
      chainCaptures = [];
      render();
      return;
    }

    // Mid-selection: is (row,col) a legal next step for the selected piece?
    const fromRow = selected.row,
      fromCol = selected.col;
    const base = workingBoard || board;

    if (mandatoryCapture || chainCaptures.length > 0) {
      const jumps = singleJumpsFrom(base, fromRow, fromCol);
      const match = jumps.find((j) => j.landRow === row && j.landCol === col);
      if (!match) {
        // allow reselecting a different piece only if no chain is in progress
        if (chainCaptures.length === 0) {
          const piece = activeBoard[idx(row, col)];
          if (piece && pieceColor(piece) === currentTurn && captureChainsFrom(activeBoard, row, col).length > 0) {
            selected = { row, col };
            render();
          }
        }
        return;
      }
      const nextBoard = base.slice();
      const movingPiece = base[idx(fromRow, fromCol)];
      nextBoard[idx(fromRow, fromCol)] = null;
      nextBoard[idx(match.midRow, match.midCol)] = null;
      const promoted = maybePromote(movingPiece, match.landRow);
      nextBoard[idx(match.landRow, match.landCol)] = promoted;
      chainCaptures.push({ row: match.midRow, col: match.midCol });
      const didPromote = promoted !== movingPiece;

      const moreJumps = didPromote ? [] : singleJumpsFrom(nextBoard, match.landRow, match.landCol);
      if (moreJumps.length > 0) {
        workingBoard = nextBoard;
        selected = { row: match.landRow, col: match.landCol };
        render();
      } else {
        finalizeMove({
          type: "capture",
          from: { row: fromRow, col: fromCol },
          path: [], // not needed; captures + final board suffice below
          captures: chainCaptures,
          _finalRow: match.landRow,
          _finalCol: match.landCol,
        });
      }
      return;
    }

    const simples = simpleMovesFrom(activeBoard, fromRow, fromCol);
    const match = simples.find((m) => m.row === row && m.col === col);
    if (!match) {
      const piece = activeBoard[idx(row, col)];
      if (piece && pieceColor(piece) === currentTurn) {
        selected = { row, col };
        render();
      }
      return;
    }
    finalizeMove({ type: "simple", from: { row: fromRow, col: fromCol }, to: { row, col } });
  }

  function finalizeMove(move) {
    let nextBoard;
    if (move.type === "capture") {
      // Reconstruct a canonical move object applyMove understands.
      const canonical = {
        type: "capture",
        from: move.from,
        path: [{ row: move._finalRow, col: move._finalCol }],
        captures: move.captures,
      };
      nextBoard = applyMove(board, canonical);
    } else {
      nextBoard = applyMove(board, move);
    }

    selected = null;
    workingBoard = null;
    chainCaptures = null;
    const nextTurn = opponentOf(currentTurn);
    const over = checkGameOver(nextBoard, nextTurn);

    if (mode === "cpu") {
      board = nextBoard;
      currentTurn = nextTurn;
      render();
      if (over) {
        gameOver = true;
        const iWon = over.winner === mySide;
        showResult(iWon ? "You win!" : "CPU wins.");
        recordResult(iWon ? "win" : "loss");
        return;
      }
      statusEl.textContent = "CPU is thinking...";
      setTimeout(cpuTurn, 3000);
    } else {
      const nextSlot = slotForColor(nextTurn);
      BoardGameMultiplayer.updateRoomState(roomId, {
        state: { board: nextBoard },
        turn: nextSlot,
        status: over ? "finished" : "active",
        winner: over ? mySlot : null,
      });
    }
  }

  function cpuTurn() {
    const move = getCpuMove(board, opponentOf(mySide), CPU_SEARCH_DEPTH);
    if (!move) {
      gameOver = true;
      showResult("You win!");
      recordResult("win");
      return;
    }
    board = applyMove(board, move);
    currentTurn = mySide;
    const over = checkGameOver(board, currentTurn);
    render();
    if (over) {
      gameOver = true;
      const iWon = over.winner === mySide;
      showResult(iWon ? "You win!" : "CPU wins.");
      recordResult(iWon ? "win" : "loss");
    }
  }

  function backToMenu() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    mode = null;
    roomId = null;
    mySlot = null;
    showScreen("menu");
    onlineChoices.hidden = true;
  }

  btnVsCpu.addEventListener("click", startVsCpu);
  btnOnline.addEventListener("click", () => {
    onlineChoices.hidden = false;
  });
  btnCreateRed.addEventListener("click", () => startCreateRoom("r"));
  btnCreateBlack.addEventListener("click", () => startCreateRoom("b"));
  btnJoinRoom.addEventListener("click", startJoinRoom);
  btnPlayAgain.addEventListener("click", () => {
    if (mode === "cpu") {
      startVsCpu();
    } else if (mode === "online") {
      const fresh = createInitialBoard();
      BoardGameMultiplayer.updateRoomState(roomId, {
        state: { board: fresh, hostColor },
        turn: slotForColor("r"),
        status: "active",
        winner: null,
      });
    }
  });
  btnBackToMenu.addEventListener("click", backToMenu);

  showScreen("menu");

  const joinParam = new URLSearchParams(location.search).get("join");
  if (joinParam) {
    onlineChoices.hidden = false;
    joinCodeInput.value = joinParam;
    startJoinRoom();
  }
}
