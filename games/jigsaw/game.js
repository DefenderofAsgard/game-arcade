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

let currentImage = "eagle-nebula";
let gridSize = 3;
let pieces = [];
let moves = 0;
let seconds = 0;
let timerInterval = null;
let solved = false;
let blackSlots = new Set();

const BLACK_THRESHOLD = 12;

async function detectBlackSlots(tileSize) {
  blackSlots = new Set();
  try {
    const img = new Image();
    img.src = IMAGES[currentImage];
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    const sampleCtx = canvas.getContext("2d");
    sampleCtx.drawImage(img, 0, 0, BOARD_SIZE, BOARD_SIZE);

    const total = gridSize * gridSize;
    for (let correctIndex = 0; correctIndex < total; correctIndex++) {
      const row = Math.floor(correctIndex / gridSize);
      const col = correctIndex % gridSize;
      const data = sampleCtx.getImageData(col * tileSize, row * tileSize, tileSize, tileSize).data;
      let isBlack = true;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > BLACK_THRESHOLD || data[i + 1] > BLACK_THRESHOLD || data[i + 2] > BLACK_THRESHOLD) {
          isBlack = false;
          break;
        }
      }
      if (isBlack) blackSlots.add(correctIndex);
    }
  } catch (err) {
    console.error("Black-slot detection failed:", err);
  }
  checkWin();
}

let dragState = null;

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function startTimer() {
  clearInterval(timerInterval);
  seconds = 0;
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

function buildBoard() {
  boardEl.innerHTML = "";
  boardEl.classList.remove("solved");
  pieces = [];
  moves = 0;
  solved = false;
  movesEl.textContent = moves;
  winMessageEl.hidden = true;

  const tileSize = BOARD_SIZE / gridSize;
  const total = gridSize * gridSize;
  const slotOrder = shuffle([...Array(total).keys()]);
  detectBlackSlots(tileSize);

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

  startTimer();
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
    winMessageEl.hidden = false;
    boardEl.classList.add("solved");
    new Audio("sounds/solved.wav").play().catch(() => {});
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

playAgainBtn.addEventListener("click", buildBoard);

function updateSelectedButtons() {
  document.querySelectorAll(".thumb-btn").forEach((b) => {
    b.classList.toggle("selected", b.dataset.image === currentImage);
  });
  document.querySelectorAll(".diff-btn").forEach((b) => {
    b.classList.toggle("selected", parseInt(b.dataset.size, 10) === gridSize);
  });
}

updateSelectedButtons();
buildBoard();
