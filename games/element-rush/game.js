const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const feedbackEl = document.getElementById("feedback");
const gameOverEl = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");
const binButtons = document.querySelectorAll(".bin");
const bestScoreEl = document.getElementById("best-score");
const newBestEl = document.getElementById("new-best");

const BEST_KEY = "elementRushBestScore";
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
bestScoreEl.textContent = bestScore;

// Curated, verified element -> category dataset (metal / nonmetal / noble gas).
const ELEMENTS = [
  { symbol: "Fe", name: "Iron", category: "metal" },
  { symbol: "Au", name: "Gold", category: "metal" },
  { symbol: "Ag", name: "Silver", category: "metal" },
  { symbol: "Cu", name: "Copper", category: "metal" },
  { symbol: "Al", name: "Aluminum", category: "metal" },
  { symbol: "Na", name: "Sodium", category: "metal" },
  { symbol: "K", name: "Potassium", category: "metal" },
  { symbol: "Ca", name: "Calcium", category: "metal" },
  { symbol: "Zn", name: "Zinc", category: "metal" },
  { symbol: "Mg", name: "Magnesium", category: "metal" },
  { symbol: "Ni", name: "Nickel", category: "metal" },
  { symbol: "Pb", name: "Lead", category: "metal" },
  { symbol: "H", name: "Hydrogen", category: "nonmetal" },
  { symbol: "O", name: "Oxygen", category: "nonmetal" },
  { symbol: "C", name: "Carbon", category: "nonmetal" },
  { symbol: "N", name: "Nitrogen", category: "nonmetal" },
  { symbol: "S", name: "Sulfur", category: "nonmetal" },
  { symbol: "P", name: "Phosphorus", category: "nonmetal" },
  { symbol: "Cl", name: "Chlorine", category: "nonmetal" },
  { symbol: "F", name: "Fluorine", category: "nonmetal" },
  { symbol: "Br", name: "Bromine", category: "nonmetal" },
  { symbol: "I", name: "Iodine", category: "nonmetal" },
  { symbol: "He", name: "Helium", category: "noble-gas" },
  { symbol: "Ne", name: "Neon", category: "noble-gas" },
  { symbol: "Ar", name: "Argon", category: "noble-gas" },
  { symbol: "Kr", name: "Krypton", category: "noble-gas" },
  { symbol: "Xe", name: "Xenon", category: "noble-gas" },
];

const LANES = [
  { category: "metal", label: "Metal", x: W / 6 },
  { category: "nonmetal", label: "Nonmetal", x: W / 2 },
  { category: "noble-gas", label: "Noble Gas", x: (5 * W) / 6 },
];

const CATCH_LINE_Y = H - 110;
const BASE_FALL_SPEED = 70; // px/sec
const SPEED_STEP = 12;
const CATCHES_PER_LEVEL = 8;
const MAX_LEVEL_FOR_SPEED = 10;

let score, lives, level, catcherLane, tile, gameRunning, elapsed, feedbackTimer;

function randomElement() {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
}

function spawnTile() {
  const el = randomElement();
  return { symbol: el.symbol, name: el.name, category: el.category, x: W / 2, y: -30 };
}

function fallSpeed() {
  return BASE_FALL_SPEED + Math.min(level - 1, MAX_LEVEL_FOR_SPEED) * SPEED_STEP;
}

function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  catcherLane = 1;
  tile = spawnTile();
  gameRunning = true;
  elapsed = 0;
  feedbackTimer = 0;
  feedbackEl.textContent = "";
  gameOverEl.hidden = true;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  livesEl.textContent = "♥".repeat(Math.max(lives, 0)) + "♡".repeat(Math.max(3 - lives, 0));
  levelEl.textContent = level;
}

window.addEventListener("keydown", (e) => {
  if (!gameRunning) return;
  if (e.key === "ArrowLeft") {
    catcherLane = Math.max(0, catcherLane - 1);
    e.preventDefault();
  } else if (e.key === "ArrowRight") {
    catcherLane = Math.min(2, catcherLane + 1);
    e.preventDefault();
  } else if (e.key === "1") {
    catcherLane = 0;
  } else if (e.key === "2") {
    catcherLane = 1;
  } else if (e.key === "3") {
    catcherLane = 2;
  }
});

binButtons.forEach((btn, i) => {
  btn.addEventListener("click", () => {
    if (gameRunning) catcherLane = i;
  });
});

function showFeedback(msg, correct) {
  feedbackEl.textContent = msg;
  feedbackEl.style.color = correct ? "#7cff9e" : "#ff8080";
  feedbackTimer = 1.4;
}

function resolveCatch() {
  const lane = LANES[catcherLane];
  const correct = lane.category === tile.category;
  if (correct) {
    score++;
    showFeedback(`${tile.name} (${tile.symbol}) is a ${lane.label} — correct!`, true);
    if (score % CATCHES_PER_LEVEL === 0) level++;
  } else {
    lives--;
    const trueLabel = LANES.find((l) => l.category === tile.category).label;
    showFeedback(`${tile.name} (${tile.symbol}) is actually ${trueLabel}, not ${lane.label}.`, false);
  }
  updateHud();
  if (lives <= 0) {
    endGame();
  } else {
    tile = spawnTile();
  }
}

function endGame() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(BEST_KEY, String(bestScore));
    bestScoreEl.textContent = bestScore;
    newBestEl.hidden = false;
  } else {
    newBestEl.hidden = true;
  }
  gameOverEl.hidden = false;
  savePlatformProgress("elementRush", { score });
  addPlaytime(elapsed);
}

function update(dt) {
  if (!gameRunning) return;
  elapsed += dt;
  tile.y += fallSpeed() * dt;
  const targetX = LANES[catcherLane].x;
  tile.x += (targetX - tile.x) * Math.min(1, dt * 6);
  if (tile.y >= CATCH_LINE_Y) {
    resolveCatch();
  }
  if (feedbackTimer > 0) {
    feedbackTimer -= dt;
    if (feedbackTimer <= 0) feedbackEl.textContent = "";
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, CATCH_LINE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  LANES.forEach((lane, i) => {
    const binW = W / 3 - 16;
    const bx = lane.x - binW / 2;
    ctx.fillStyle = i === catcherLane ? "rgba(142, 203, 255, 0.18)" : "rgba(255, 255, 255, 0.05)";
    ctx.strokeStyle = i === catcherLane ? "#8ecbff" : "#333";
    ctx.lineWidth = 2;
    ctx.fillRect(bx, CATCH_LINE_Y, binW, H - CATCH_LINE_Y - 10);
    ctx.strokeRect(bx, CATCH_LINE_Y, binW, H - CATCH_LINE_Y - 10);
    ctx.fillStyle = "#ccc";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.fillText(lane.label, lane.x, CATCH_LINE_Y + 24);
  });

  const activeLane = LANES[catcherLane];
  ctx.fillStyle = "#8ecbff";
  ctx.beginPath();
  ctx.moveTo(activeLane.x - 22, CATCH_LINE_Y - 6);
  ctx.lineTo(activeLane.x + 22, CATCH_LINE_Y - 6);
  ctx.lineTo(activeLane.x, CATCH_LINE_Y - 22);
  ctx.closePath();
  ctx.fill();

  const tileSize = 46;
  ctx.fillStyle = "#3a4a63";
  ctx.strokeStyle = "#8ecbff";
  ctx.lineWidth = 2;
  ctx.fillRect(tile.x - tileSize / 2, tile.y - tileSize / 2, tileSize, tileSize);
  ctx.strokeRect(tile.x - tileSize / 2, tile.y - tileSize / 2, tileSize, tileSize);
  ctx.fillStyle = "#f0f0f0";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tile.symbol, tile.x, tile.y + 1);
  ctx.textBaseline = "alphabetic";
}

let lastTime = null;
function loop(t) {
  if (lastTime === null) lastTime = t;
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

restartBtn.addEventListener("click", initGame);

initGame();
requestAnimationFrame(loop);
