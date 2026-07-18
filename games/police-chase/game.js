const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const timeEl = document.getElementById("time");
const coinsEl = document.getElementById("coins");
const scoreEl = document.getElementById("score");
const wantedFillEl = document.getElementById("wanted-fill");
const gameOverEl = document.getElementById("game-over");
const finalTimeEl = document.getElementById("final-time");
const finalCoinsEl = document.getElementById("final-coins");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");
const nameEntryEl = document.getElementById("name-entry");
const playerNameInput = document.getElementById("player-name");
const submitScoreBtn = document.getElementById("submit-score");

const GRID_MARGIN = 35;
const BLOCK_W = 85;
const BLOCK_H = 90;
const ROAD_WIDTH = 80;
const GRID_COLS = 4;
const GRID_ROWS = 2;

function blockLeft(col) { return GRID_MARGIN + col * (BLOCK_W + ROAD_WIDTH); }
function blockTop(row) { return GRID_MARGIN + row * (BLOCK_H + ROAD_WIDTH); }

const BLOCKS = [];
for (let row = 0; row < GRID_ROWS; row++) {
  for (let col = 0; col < GRID_COLS; col++) {
    BLOCKS.push({ x: blockLeft(col), y: blockTop(row), w: BLOCK_W, h: BLOCK_H });
  }
}

// Center-line x positions of every vertical street (margins + gaps between block columns).
const V_STREETS = [GRID_MARGIN / 2];
for (let col = 0; col < GRID_COLS - 1; col++) {
  V_STREETS.push((blockLeft(col) + BLOCK_W + blockLeft(col + 1)) / 2);
}
V_STREETS.push((blockLeft(GRID_COLS - 1) + BLOCK_W + W) / 2);

// Center-line y positions of every horizontal street (margins + gaps between block rows).
const H_STREETS = [GRID_MARGIN / 2];
for (let row = 0; row < GRID_ROWS - 1; row++) {
  H_STREETS.push((blockTop(row) + BLOCK_H + blockTop(row + 1)) / 2);
}
H_STREETS.push((blockTop(GRID_ROWS - 1) + BLOCK_H + H) / 2);

// Every street crossing gets a control device, alternating logically by grid position
// (checkerboard: lights on evens, stop signs on odds) rather than randomly.
const INTERSECTIONS = [];
for (let r = 0; r < H_STREETS.length; r++) {
  for (let c = 0; c < V_STREETS.length; c++) {
    INTERSECTIONS.push({
      x: V_STREETS[c],
      y: H_STREETS[r],
      type: (r + c) % 2 === 0 ? "light" : "stop",
    });
  }
}

// Safe spawn point: the open margin road that rings the whole block grid.
const SPAWN_X = GRID_MARGIN / 2;
const SPAWN_Y = H / 2;

const CAR_RADIUS = 10;
const ACCEL = 0.08;
const BRAKE = 0.25;
const FRICTION = 0.985;
const MAX_SPEED = 4.5;
const MAX_REVERSE = -2;
const TURN_RATE = 0.045;

const DETECTION_RANGE = 150;
const LOSE_RANGE = 240;
const POLICE_SPEED = 1.6;
const POLICE_SPAWN_INTERVAL = 20;
const MAX_POLICE = 5;

const COIN_RADIUS = 6;
const COIN_COUNT = 18;

function randomRoadPoint() {
  let x, y;
  do {
    x = 20 + Math.random() * (W - 40);
    y = 20 + Math.random() * (H - 40);
  } while (circleHitsBlock(x, y, COIN_RADIUS + 6));
  return { x, y };
}

function spawnCoin() {
  const p = randomRoadPoint();
  return { x: p.x, y: p.y };
}

const keys = {};
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys[e.key] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys[e.key] = false;
});

let player, police, wanted, elapsed, gameRunning, policeSpawnTimer, coins, coinsCollected;

function circleHitsBlock(x, y, r) {
  for (const b of BLOCKS) {
    const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
    if (Math.hypot(x - closestX, y - closestY) < r) return true;
  }
  return false;
}

function initGame() {
  player = { x: SPAWN_X, y: SPAWN_Y, angle: 0, speed: 0 };
  police = [
    { x: 30, y: 30, angle: 0, speed: 0, state: "patrol", waypoint: null },
    { x: 770, y: 470, angle: Math.PI, speed: 0, state: "patrol", waypoint: null },
  ];
  wanted = 0;
  elapsed = 0;
  gameRunning = true;
  policeSpawnTimer = POLICE_SPAWN_INTERVAL;
  coins = Array.from({ length: COIN_COUNT }, spawnCoin);
  coinsCollected = 0;
  gameOverEl.hidden = true;
  updateHud();
}

function updateHud() {
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  timeEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
  coinsEl.textContent = coinsCollected;
  scoreEl.textContent = coinsCollected;
  wantedFillEl.style.width = `${wanted}%`;
  wantedFillEl.style.backgroundColor = wanted > 60 ? "#ff3b3b" : wanted > 25 ? "#ff9d3b" : "#ffcc00";
}

function moveCar(car, accelInput, brakeInput, turnInput) {
  if (accelInput && brakeInput) {
    car.speed = MAX_SPEED * 0.25;
  } else {
    if (accelInput) car.speed += ACCEL;
    if (brakeInput) car.speed -= BRAKE;
    car.speed *= FRICTION;
    car.speed = Math.max(MAX_REVERSE, Math.min(MAX_SPEED, car.speed));
  }

  if (Math.abs(car.speed) > 0.05) {
    const dir = car.speed > 0 ? 1 : -1;
    car.angle += turnInput * TURN_RATE * dir;
  }

  const nx = car.x + Math.cos(car.angle) * car.speed;
  const ny = car.y + Math.sin(car.angle) * car.speed;

  if (!circleHitsBlock(nx, car.y, CAR_RADIUS) && nx > CAR_RADIUS && nx < W - CAR_RADIUS) {
    car.x = nx;
  }
  if (!circleHitsBlock(car.x, ny, CAR_RADIUS) && ny > CAR_RADIUS && ny < H - CAR_RADIUS) {
    car.y = ny;
  }
}

function updatePlayer() {
  const accelInput = !!keys["ArrowUp"];
  const brakeInput = !!keys[" "];
  let turnInput = 0;
  if (keys["ArrowLeft"]) turnInput -= 1;
  if (keys["ArrowRight"]) turnInput += 1;
  moveCar(player, accelInput, brakeInput, turnInput);
}

function pickWaypoint() {
  return { x: 40 + Math.random() * (W - 80), y: 40 + Math.random() * (H - 80) };
}

function updatePolice(cop) {
  const dist = Math.hypot(player.x - cop.x, player.y - cop.y);

  if (cop.state === "patrol" && dist < DETECTION_RANGE) {
    cop.state = "chasing";
  } else if (cop.state === "chasing" && dist > LOSE_RANGE) {
    cop.state = "patrol";
    cop.waypoint = null;
  }

  let targetX, targetY;
  if (cop.state === "chasing") {
    targetX = player.x;
    targetY = player.y;
  } else {
    if (!cop.waypoint || Math.hypot(cop.waypoint.x - cop.x, cop.waypoint.y - cop.y) < 20) {
      cop.waypoint = pickWaypoint();
    }
    targetX = cop.waypoint.x;
    targetY = cop.waypoint.y;
  }

  const targetAngle = Math.atan2(targetY - cop.y, targetX - cop.x);
  let angleDiff = targetAngle - cop.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  cop.angle += Math.max(-0.06, Math.min(0.06, angleDiff));

  const speed = cop.state === "chasing" ? POLICE_SPEED : POLICE_SPEED * 0.55;
  const nx = cop.x + Math.cos(cop.angle) * speed;
  const ny = cop.y + Math.sin(cop.angle) * speed;

  let moved = false;
  if (!circleHitsBlock(nx, cop.y, CAR_RADIUS) && nx > CAR_RADIUS && nx < W - CAR_RADIUS) {
    cop.x = nx;
    moved = true;
  }
  if (!circleHitsBlock(cop.x, ny, CAR_RADIUS) && ny > CAR_RADIUS && ny < H - CAR_RADIUS) {
    cop.y = ny;
    moved = true;
  }
  if (!moved) {
    cop.waypoint = pickWaypoint();
  }
}

function update() {
  if (!gameRunning) return;

  elapsed += 1 / 60;
  updatePlayer();

  for (let i = 0; i < coins.length; i++) {
    if (Math.hypot(coins[i].x - player.x, coins[i].y - player.y) < CAR_RADIUS + COIN_RADIUS) {
      coinsCollected++;
      coins[i] = spawnCoin();
    }
  }

  let anyChasing = false;
  for (const cop of police) {
    updatePolice(cop);
    if (cop.state === "chasing") anyChasing = true;
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < CAR_RADIUS * 1.8) {
      busted();
      return;
    }
  }

  wanted += anyChasing ? 0.4 : -0.3;
  wanted = Math.max(0, Math.min(100, wanted));

  policeSpawnTimer -= 1 / 60;
  if (policeSpawnTimer <= 0 && police.length < MAX_POLICE) {
    police.push({
      x: Math.random() < 0.5 ? 30 : W - 30,
      y: Math.random() < 0.5 ? 30 : H - 30,
      angle: Math.random() * Math.PI * 2,
      speed: 0,
      state: "patrol",
      waypoint: null,
    });
    policeSpawnTimer = POLICE_SPAWN_INTERVAL;
  }

  updateHud();
}

function busted() {
  gameRunning = false;
  finalTimeEl.textContent = timeEl.textContent;
  finalCoinsEl.textContent = coinsCollected;
  finalScoreEl.textContent = coinsCollected;
  gameOverEl.hidden = false;
  if (window.Leaderboard && window.Leaderboard.qualifiesForTopThree(coinsCollected)) {
    nameEntryEl.hidden = false;
    playerNameInput.value = "";
    submitScoreBtn.disabled = false;
  } else {
    nameEntryEl.hidden = true;
  }
}

function drawPlayerCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = "#8ecbff";
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(9, -6);
  ctx.lineTo(-10, -7);
  ctx.lineTo(-15, -4);
  ctx.lineTo(-15, 4);
  ctx.lineTo(-10, 7);
  ctx.lineTo(9, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#eafcff";
  ctx.fillRect(-12, -2, 26, 4);

  ctx.fillStyle = "#0d1a24";
  ctx.beginPath();
  ctx.moveTo(6, -4);
  ctx.lineTo(1, -4.5);
  ctx.lineTo(1, 4.5);
  ctx.lineTo(6, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#333";
  ctx.fillRect(-17, -6, 3, 12);

  ctx.fillStyle = "#fff7c2";
  ctx.fillRect(13, -5, 3, 2.5);
  ctx.fillRect(13, 2.5, 3, 2.5);

  ctx.restore();
}

function drawPoliceCar(car, chasing) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  ctx.fillStyle = chasing ? "#e0e0e0" : "#555";
  ctx.fillRect(-13, -7, 26, 14);

  ctx.fillStyle = "#111";
  ctx.fillRect(3, -7, 7, 14);

  if (chasing) {
    const flash = Math.floor(elapsed * 6) % 2 === 0;
    ctx.fillStyle = flash ? "#ff3b3b" : "#7a1f1f";
    ctx.fillRect(-4, -7, 8, 7);
    ctx.fillStyle = flash ? "#1f3f7a" : "#3b6bff";
    ctx.fillRect(-4, 0, 8, 7);
  } else {
    ctx.fillStyle = "#ff3b3b";
    ctx.fillRect(-4, -7, 8, 3.5);
    ctx.fillStyle = "#3b6bff";
    ctx.fillRect(-4, 3.5, 8, 3.5);
  }

  ctx.fillStyle = "#fff7c2";
  ctx.fillRect(11, -5, 3, 2.5);
  ctx.fillRect(11, 2.5, 3, 2.5);

  ctx.restore();
}

function drawBlocks() {
  for (const b of BLOCKS) {
    ctx.fillStyle = "#2d4a2d";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
}

function drawStreetMarkings() {
  const edgeInset = ROAD_WIDTH / 2 - 6;
  const dash = [14, 12];

  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 2;
  for (const x of V_STREETS) {
    ctx.beginPath();
    ctx.moveTo(x - edgeInset, 0);
    ctx.lineTo(x - edgeInset, H);
    ctx.moveTo(x + edgeInset, 0);
    ctx.lineTo(x + edgeInset, H);
    ctx.stroke();
  }
  for (const y of H_STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, y - edgeInset);
    ctx.lineTo(W, y - edgeInset);
    ctx.moveTo(0, y + edgeInset);
    ctx.lineTo(W, y + edgeInset);
    ctx.stroke();
  }

  ctx.strokeStyle = "#ffcc00";
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  for (const x of V_STREETS) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (const y of H_STREETS) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawTrafficLight(x, y) {
  ctx.fillStyle = "#222";
  ctx.fillRect(x - 3, y - 11, 6, 22);
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath();
  ctx.arc(x, y - 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3bff5a";
  ctx.beginPath();
  ctx.arc(x, y + 6, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStopSign(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#c0392b";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const px = Math.cos(a) * 7;
    const py = Math.sin(a) * 7;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-4, -1, 8, 2);
  ctx.restore();
}

function drawIntersections() {
  for (const i of INTERSECTIONS) {
    const offsetX = i.x < W / 2 ? 12 : -12;
    const offsetY = i.y < H / 2 ? 12 : -12;
    if (i.type === "light") {
      drawTrafficLight(i.x + offsetX, i.y + offsetY);
    } else {
      drawStopSign(i.x + offsetX, i.y + offsetY);
    }
  }
}

function drawCoins() {
  for (const c of coins) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, COIN_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe28a";
    ctx.fill();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x - 2, c.y - 2, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff7d6";
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawStreetMarkings();
  drawBlocks();
  drawIntersections();
  drawCoins();

  for (const cop of police) {
    drawPoliceCar(cop, cop.state === "chasing");
  }

  drawPlayerCar(player);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

restartBtn.addEventListener("click", async () => {
  if (!nameEntryEl.hidden) {
    nameEntryEl.hidden = true;
    await window.Leaderboard.submitScore("Unknown", coinsCollected);
  }
  initGame();
});
submitScoreBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim() || "Unknown";
  submitScoreBtn.disabled = true;
  await window.Leaderboard.submitScore(name, coinsCollected);
  nameEntryEl.hidden = true;
});

initGame();
loop();
