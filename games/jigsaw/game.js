const BOARD_SIZE = 480;

const IMAGES = {
  "eagle-nebula": "images/eagle-nebula.jpg",
  "saturn-rings": "images/saturn-rings.jpg",
  earthrise: "images/earthrise.jpg",
  "saturn-2025": "images/saturn-2025.jpg",
  "active-spiral": "images/active-spiral.jpg",
  "messier-58": "images/messier-58.jpg",
  "orion-stars": "images/orion-stars.jpg",
  "massive-stars": "images/massive-stars.jpg",
};

const boardEl = document.getElementById("board");
const movesEl = document.getElementById("moves");
const timeEl = document.getElementById("time");
const winMessageEl = document.getElementById("win-message");
const finalMovesEl = document.getElementById("final-moves");
const finalTimeEl = document.getElementById("final-time");
const playAgainBtn = document.getElementById("play-again");
const bestTimeEl = document.getElementById("best-time");
const newBestEl = document.getElementById("new-best");

function bestTimeKey(size) {
  return `jigsawBestTime_${size}`;
}

function updateBestTimeDisplay() {
  const stored = Number(localStorage.getItem(bestTimeKey(gridSize)));
  bestTimeEl.textContent = stored ? formatTime(stored) : "—";
}

let currentImage = "eagle-nebula";
let gridSize = 3;
let pieces = [];
let moves = 0;
let seconds = 0;
let timerInterval = null;
let solved = false;
let blackSlots = new Set();
let lastFlushedSeconds = 0;

// Precomputed offline (Pillow) per image/difficulty: tile indices that are
// solid black, so they're visually interchangeable for win-checking.
const BLACK_SLOTS_DATA = {
  "eagle-nebula": { 3: [], 4: [], 5: [] },
  "saturn-rings": { 3: [0], 4: [0, 1, 4, 15], 5: [0, 1, 2, 5, 6, 10, 24] },
  earthrise: { 3: [0, 1, 2], 4: [0, 1, 2, 3], 5: [0, 1, 2, 3, 4, 5, 6, 8, 9] },
  "saturn-2025": {
    3: [0, 2, 6, 7, 8],
    4: [0, 1, 2, 3, 11, 12, 13, 14, 15],
    5: [0, 1, 2, 3, 4, 5, 15, 19, 20, 21, 22, 23, 24],
  },
  "active-spiral": { 3: [], 4: [], 5: [] },
  "messier-58": { 3: [], 4: [], 5: [] },
  "orion-stars": { 3: [], 4: [], 5: [] },
  "massive-stars": { 3: [], 4: [], 5: [] },
};

function detectBlackSlots() {
  const indices = BLACK_SLOTS_DATA[currentImage]?.[gridSize] || [];
  blackSlots = new Set(indices);
}

let dragState = null;

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function startTimer(startSeconds) {
  clearInterval(timerInterval);
  seconds = startSeconds || 0;
  timeEl.textContent = formatTime(seconds);
  timerInterval = setInterval(() => {
    seconds++;
    timeEl.textContent = formatTime(seconds);
  }, 1000);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function layoutPiece(piece) {
  const tileSize = BOARD_SIZE / gridSize;
  const row = Math.floor(piece.slotIndex / gridSize);
  const col = piece.slotIndex % gridSize;
  piece.el.style.left = `${col * tileSize}px`;
  piece.el.style.top = `${row * tileSize}px`;
}

function buildBoard(savedState) {
  boardEl.innerHTML = "";
  boardEl.classList.remove("solved");
  pieces = [];
  solved = false;
  winMessageEl.hidden = true;

  const tileSize = BOARD_SIZE / gridSize;
  const total = gridSize * gridSize;
  let slotOrder;
  if (savedState && savedState.slots && savedState.slots.length === total) {
    slotOrder = savedState.slots;
    moves = savedState.moves || 0;
  } else {
    slotOrder = shuffle([...Array(total).keys()]);
    moves = 0;
  }
  movesEl.textContent = moves;
  detectBlackSlots();

  for (let correctIndex = 0; correctIndex < total; correctIndex++) {
    const row = Math.floor(correctIndex / gridSize);
    const col = correctIndex % gridSize;

    const el = document.createElement("div");
    el.className = "piece";
    el.style.width = `${tileSize}px`;
    el.style.height = `${tileSize}px`;
    el.style.backgroundImage = `url('${IMAGES[currentImage]}')`;
    el.style.backgroundSize = `${BOARD_SIZE}px ${BOARD_SIZE}px`;
    el.style.backgroundPosition = `-${col * tileSize}px -${row * tileSize}px`;

    const piece = { correctIndex, slotIndex: slotOrder[correctIndex], el };
    el.addEventListener("mousedown", (e) => startDrag(e, piece));
    boardEl.appendChild(el);
    pieces.push(piece);
    layoutPiece(piece);
  }

  startTimer(savedState ? savedState.seconds : 0);
  lastFlushedSeconds = seconds;
}

function flushPlaytime() {
  const delta = seconds - lastFlushedSeconds;
  if (delta > 0) addPlaytime(delta);
  lastFlushedSeconds = seconds;
}

function currentSlots() {
  const slots = new Array(pieces.length);
  for (const p of pieces) slots[p.correctIndex] = p.slotIndex;
  return slots;
}

function startDrag(e, piece) {
  if (solved) return;
  e.preventDefault();
  const boardRect = boardEl.getBoundingClientRect();
  dragState = {
    piece,
    offsetX: e.clientX - boardRect.left - parseFloat(piece.el.style.left),
    offsetY: e.clientY - boardRect.top - parseFloat(piece.el.style.top),
  };
  piece.el.classList.add("dragging");
}

window.addEventListener("mousemove", (e) => {
  if (!dragState) return;
  const boardRect = boardEl.getBoundingClientRect();
  const x = e.clientX - boardRect.left - dragState.offsetX;
  const y = e.clientY - boardRect.top - dragState.offsetY;
  dragState.piece.el.style.left = `${x}px`;
  dragState.piece.el.style.top = `${y}px`;
});

window.addEventListener("mouseup", (e) => {
  if (!dragState) return;
  const piece = dragState.piece;
  piece.el.classList.remove("dragging");

  const tileSize = BOARD_SIZE / gridSize;
  const boardRect = boardEl.getBoundingClientRect();
  const centerX = e.clientX - boardRect.left;
  const centerY = e.clientY - boardRect.top;
  let col = Math.floor(centerX / tileSize);
  let row = Math.floor(centerY / tileSize);
  col = Math.max(0, Math.min(gridSize - 1, col));
  row = Math.max(0, Math.min(gridSize - 1, row));
  const targetSlot = row * gridSize + col;

  if (targetSlot !== piece.slotIndex) {
    const occupant = pieces.find((p) => p.slotIndex === targetSlot);
    if (occupant) {
      occupant.slotIndex = piece.slotIndex;
      layoutPiece(occupant);
    }
    piece.slotIndex = targetSlot;
    moves++;
    movesEl.textContent = moves;
  }
  layoutPiece(piece);
  dragState = null;

  checkWin();
  if (!solved) {
    flushPlaytime();
    saveJigsawState({
      image: currentImage,
      gridSize,
      moves,
      seconds,
      slots: currentSlots(),
    });
  }
});

function isPieceCorrect(p) {
  if (blackSlots.has(p.correctIndex)) {
    return blackSlots.has(p.slotIndex);
  }
  return p.slotIndex === p.correctIndex;
}

function checkWin() {
  if (pieces.every(isPieceCorrect)) {
    solved = true;
    clearInterval(timerInterval);
    finalMovesEl.textContent = moves;
    finalTimeEl.textContent = formatTime(seconds);
    const key = bestTimeKey(gridSize);
    const prevBest = Number(localStorage.getItem(key));
    if (!prevBest || seconds < prevBest) {
      localStorage.setItem(key, String(seconds));
      newBestEl.hidden = false;
    } else {
      newBestEl.hidden = true;
    }
    updateBestTimeDisplay();
    winMessageEl.hidden = false;
    boardEl.classList.add("solved");
    new Audio("sounds/solved.wav").play().catch(() => {});
    flushPlaytime();
    clearJigsawState({ seconds });
  }
}

document.getElementById("image-picker").addEventListener("click", (e) => {
  const btn = e.target.closest(".thumb-btn");
  if (!btn) return;
  currentImage = btn.dataset.image;
  updateSelectedButtons();
  buildBoard();
});

document.getElementById("difficulty-picker").addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  gridSize = parseInt(btn.dataset.size, 10);
  updateSelectedButtons();
  buildBoard();
});

playAgainBtn.addEventListener("click", () => buildBoard());

function updateSelectedButtons() {
  document.querySelectorAll(".thumb-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.image === currentImage);
  });
  document.querySelectorAll(".diff-btn").forEach((b) => {
    b.classList.toggle("selected", parseInt(b.dataset.size, 10) === gridSize);
  });
}

updateSelectedButtons();

const unsubscribeAuth = platformAuth.onAuthStateChanged(async (user) => {
  unsubscribeAuth();
  if (!user) {
    buildBoard();
    return;
  }
  const saved = await loadJigsawState();
  if (saved && saved.slots) {
    currentImage = saved.image;
    gridSize = saved.gridSize;
    updateSelectedButtons();
    buildBoard(saved);
  } else {
    buildBoard();
  }
});
