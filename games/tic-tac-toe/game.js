const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function emptyBoard() {
  return Array(9).fill(null);
}

// Returns null (game continues), or { winner: "X"|"O"|"draw", line: [a,b,c]|null }.
function checkResult(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every((cell) => cell !== null)) return { winner: "draw", line: null };
  return null;
}

// Perfect-play minimax. CPU is always "O" (maximizing), human is always "X".
function minimaxScore(board, turn) {
  const result = checkResult(board);
  if (result) {
    if (result.winner === "draw") return 0;
    return result.winner === "O" ? 10 : -10;
  }
  const scores = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const next = board.slice();
    next[i] = turn;
    scores.push(minimaxScore(next, turn === "O" ? "X" : "O"));
  }
  return turn === "O" ? Math.max(...scores) : Math.min(...scores);
}

function bestCpuMove(board) {
  let best = null;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const next = board.slice();
    next[i] = "O";
    const score = minimaxScore(next, "X");
    if (best === null || score > best.score) best = { index: i, score };
  }
  return best.index;
}

// ---- UI wiring ----

const modeSelectEl = document.getElementById("mode-select");
const onlineSetupEl = document.getElementById("online-setup");
const gameScreenEl = document.getElementById("game-screen");
const boardEl = document.getElementById("board");
const statusLineEl = document.getElementById("status-line");
const resultBannerEl = document.getElementById("result-banner");
const resultTextEl = document.getElementById("result-text");

const modeCpuBtn = document.getElementById("mode-cpu-btn");
const modeOnlineBtn = document.getElementById("mode-online-btn");
const createRoomBtn = document.getElementById("create-room-btn");
const waitingRoomEl = document.getElementById("waiting-room");
const roomCodeDisplayEl = document.getElementById("room-code-display");
const joinCodeInput = document.getElementById("join-code-input");
const joinRoomBtn = document.getElementById("join-room-btn");
const onlineErrorEl = document.getElementById("online-error");
const onlineBackBtn = document.getElementById("online-back-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const menuBtn = document.getElementById("menu-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");
const emailInviteLink = document.getElementById("email-invite-link");
const copyConfirmEl = document.getElementById("copy-confirm");

let mode = null; // "cpu" | "online"
let board = emptyBoard();
let gameOver = false;
let lastCpuResult = null; // tracks last CPU-mode round's winner ("X"|"O"|"draw"|null)
let cpuThinking = false;

// Online-only state
let roomId = null;
let playerSlot = null; // "p1" | "p2"
let mySymbol = null;
let unsubscribe = null;

function showScreen(el) {
  modeSelectEl.hidden = el !== modeSelectEl;
  onlineSetupEl.hidden = el !== onlineSetupEl;
  gameScreenEl.hidden = el !== gameScreenEl;
}

function renderCell(el, value) {
  el.textContent = value || "";
  el.classList.toggle("mark-x", value === "X");
  el.classList.toggle("mark-o", value === "O");
}

function buildBoardDom() {
  boardEl.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const btn = document.createElement("button");
    btn.className = "cell";
    btn.dataset.index = String(i);
    btn.addEventListener("click", () => onCellClick(i));
    boardEl.appendChild(btn);
  }
}

function renderBoard(winLine) {
  const cells = boardEl.children;
  for (let i = 0; i < 9; i++) {
    renderCell(cells[i], board[i]);
    cells[i].classList.toggle("win-cell", !!winLine && winLine.includes(i));
    const clickable = mode === "cpu"
      ? !gameOver && !board[i] && !cpuThinking
      : !gameOver && !board[i] && isMyTurnOnline();
    cells[i].disabled = !clickable;
  }
}

// Online turn tracking (kept separate from board state, set by room snapshots).
let currentTurnSlot = "p1";

function isMyTurnOnline() {
  return playerSlot === currentTurnSlot;
}

function resultForBanner(result) {
  if (result.winner === "draw") return { text: "It's a draw!", pgResult: "draw" };
  if (mode === "cpu") {
    return result.winner === "X"
      ? { text: "You win! 🎉", pgResult: "win" }
      : { text: "Computer wins.", pgResult: "loss" };
  }
  return result.winner === mySymbol
    ? { text: "You win! 🎉", pgResult: "win" }
    : { text: "Opponent wins.", pgResult: "loss" };
}

function finishGame(result) {
  gameOver = true;
  renderBoard(result.line);
  const { text, pgResult } = resultForBanner(result);
  resultTextEl.textContent = text;
  resultBannerEl.hidden = false;
  statusLineEl.textContent = "";
  try {
    if (typeof savePlatformProgress === "function") {
      savePlatformProgress("ticTacToe", { result: pgResult });
    }
  } catch (err) {
    console.error("[tic-tac-toe] savePlatformProgress failed", err);
  }
  if (mode === "cpu") lastCpuResult = result.winner;
}

function updateStatusLine() {
  if (gameOver) return;
  if (mode === "cpu") {
    statusLineEl.textContent = cpuThinking ? "Computer is thinking…" : "Your turn (X)";
  } else {
    statusLineEl.textContent = isMyTurnOnline()
      ? `Your turn (${mySymbol})`
      : `Waiting for opponent (${mySymbol === "X" ? "O" : "X"})…`;
  }
}

// ---- CPU mode ----

function startCpuMode() {
  mode = "cpu";
  board = emptyBoard();
  gameOver = false;
  cpuThinking = false;
  resultBannerEl.hidden = true;
  buildBoardDom();
  showScreen(gameScreenEl);

  // If the previous round vs CPU ended in a draw, let the CPU open this
  // round (same 3s delay as any other CPU decision).
  if (lastCpuResult === "draw") {
    cpuThinking = true;
    renderBoard(null);
    updateStatusLine();
    setTimeout(() => {
      const cpuIndex = bestCpuMove(board);
      board[cpuIndex] = "O";
      cpuThinking = false;
      renderBoard(null);
      updateStatusLine();
    }, 3000);
    return;
  }

  renderBoard(null);
  updateStatusLine();
}

function onCellClick(i) {
  if (gameOver || board[i]) return;
  if (mode === "cpu") {
    board[i] = "X";
    const result = checkResult(board);
    renderBoard(result && result.line);
    if (result) {
      finishGame(result);
      return;
    }
    cpuThinking = true;
    renderBoard(null);
    updateStatusLine();
    setTimeout(() => {
      const cpuIndex = bestCpuMove(board);
      board[cpuIndex] = "O";
      cpuThinking = false;
      const cpuResult = checkResult(board);
      renderBoard(cpuResult && cpuResult.line);
      if (cpuResult) {
        finishGame(cpuResult);
      } else {
        updateStatusLine();
      }
    }, 3000);
  } else if (mode === "online") {
    onOnlineCellClick(i);
  }
}

// ---- Online mode ----

function resetOnlineLocalState() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  roomId = null;
  playerSlot = null;
  mySymbol = null;
  currentTurnSlot = "p1";
}

function showOnlineError(message) {
  onlineErrorEl.textContent = message;
  onlineErrorEl.hidden = false;
}

function buildJoinUrl(id) {
  return `${location.origin}${location.pathname}?join=${id}`;
}

function setupInviteLinks(id) {
  const joinUrl = buildJoinUrl(id);
  const subject = encodeURIComponent("Play Tic-Tac-Toe with me");
  const body = encodeURIComponent(`Join my game: ${joinUrl}`);
  emailInviteLink.href = `mailto:?subject=${subject}&body=${body}`;
  copyConfirmEl.hidden = true;
  copyLinkBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      copyConfirmEl.hidden = false;
      setTimeout(() => (copyConfirmEl.hidden = true), 2000);
    } catch (err) {
      showOnlineError("Couldn't copy automatically — copy the code above instead.");
    }
  };
}

async function onCreateRoom() {
  onlineErrorEl.hidden = true;
  createRoomBtn.disabled = true;
  try {
    const { roomId: id, playerSlot: slot } = await BoardGameMultiplayer.createRoom(
      "tictactoe",
      { board: emptyBoard() }
    );
    roomId = id;
    playerSlot = slot;
    mySymbol = "X";
    roomCodeDisplayEl.textContent = roomId;
    waitingRoomEl.hidden = false;
    setupInviteLinks(roomId);
    unsubscribe = BoardGameMultiplayer.subscribeRoom(roomId, onRoomUpdate);
  } catch (err) {
    showOnlineError(err.message || "Could not create a room.");
  } finally {
    createRoomBtn.disabled = false;
  }
}

async function onJoinRoom(codeOverride) {
  const code = (codeOverride || joinCodeInput.value).trim();
  if (!code) return;
  onlineErrorEl.hidden = true;
  joinRoomBtn.disabled = true;
  try {
    const { roomId: id, playerSlot: slot, data } = await BoardGameMultiplayer.joinRoom(
      "tictactoe",
      code
    );
    roomId = id;
    playerSlot = slot;
    mySymbol = slot === "p1" ? "X" : "O";
    unsubscribe = BoardGameMultiplayer.subscribeRoom(roomId, onRoomUpdate);
    onRoomUpdate(data);
  } catch (err) {
    showOnlineError(err.message || "Could not join that room.");
  } finally {
    joinRoomBtn.disabled = false;
  }
}

function onRoomUpdate(data) {
  currentTurnSlot = data.turn;
  board = (data.state && data.state.board) || emptyBoard();

  if (data.status === "waiting") {
    showScreen(onlineSetupEl);
    return;
  }

  if (onlineSetupEl.hidden === false || boardEl.children.length !== 9) {
    buildBoardDom();
  }
  showScreen(gameScreenEl);

  const result = checkResult(board);
  if (data.status === "finished" && result) {
    if (!gameOver) {
      finishGame(result);
    } else {
      renderBoard(result.line);
    }
  } else {
    gameOver = false;
    resultBannerEl.hidden = true;
    renderBoard(null);
    updateStatusLine();
  }
}

function onOnlineCellClick(i) {
  if (gameOver || board[i] || !isMyTurnOnline()) return;
  const next = board.slice();
  next[i] = mySymbol;
  const result = checkResult(next);
  const updates = {
    state: { board: next },
    turn: playerSlot === "p1" ? "p2" : "p1",
  };
  if (result) {
    updates.status = "finished";
    updates.winner = result.winner;
  }
  BoardGameMultiplayer.updateRoomState(roomId, updates);
}

function startOnlineSetup() {
  mode = "online";
  resetOnlineLocalState();
  waitingRoomEl.hidden = true;
  joinCodeInput.value = "";
  onlineErrorEl.hidden = true;
  showScreen(onlineSetupEl);
}

function backToMenu() {
  resetOnlineLocalState();
  mode = null;
  gameOver = false;
  resultBannerEl.hidden = true;
  showScreen(modeSelectEl);
}

// ---- Event bindings ----

modeCpuBtn.addEventListener("click", startCpuMode);
modeOnlineBtn.addEventListener("click", startOnlineSetup);
createRoomBtn.addEventListener("click", onCreateRoom);
joinRoomBtn.addEventListener("click", () => onJoinRoom());
onlineBackBtn.addEventListener("click", backToMenu);
menuBtn.addEventListener("click", backToMenu);

playAgainBtn.addEventListener("click", () => {
  if (mode === "cpu") {
    startCpuMode();
  } else if (mode === "online") {
    BoardGameMultiplayer.updateRoomState(roomId, {
      state: { board: emptyBoard() },
      turn: "p1",
      status: "active",
      winner: null,
    });
  }
});

// If arriving from an emailed invite link (?join=CODE), skip straight to the
// join flow with the code pre-filled and attempt it immediately.
(function autoJoinFromLink() {
  const code = new URLSearchParams(location.search).get("join");
  if (!code) return;
  startOnlineSetup();
  joinCodeInput.value = code.toUpperCase();
  onJoinRoom(code);
})();
