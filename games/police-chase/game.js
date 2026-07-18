const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const timeEl = document.getElementById("time");
const wantedFillEl = document.getElementById("wanted-fill");
const gameOverEl = document.getElementById("game-over");
const finalTimeEl = document.getElementById("final-time");
const restartBtn = document.getElementById("restart");

const GRID_MARGIN = 35;
const BUILDING_W = 85;
const BUILDING_H = 90;
const ROAD_WIDTH = 40;
const GRID_COLS = 6;
const GRID_ROWS = 3;
const ROOF_COLORS = ["#3a3a3a", "#44403a", "#3a4044", "#403a3a", "#3d3d3d"];

const BUILDINGS = [];
for (let row = 0; row < GRID_ROWS; row++) {
  for (let col = 0; col < GRID_COLS; col++) {
    const x = GRID_MARGIN + col * (BUILDING_W + ROAD_WIDTH);
    const y = GRID_MARGIN + row * (BUILDING_H + ROAD_WIDTH);
    const seed = row * GRID_COLS + col;
    BUILDINGS.push({
      x,
      y,
      w: BUILDING_W,
      h: BUILDING_H,
      color: ROOF_COLORS[seed % ROOF_COLORS.length],
      vents: [
        { x: 12 + (seed * 13) % (BUILDING_W - 30), y: 14 + (seed * 7) % (BUILDING_H - 40), w: 10, h: 8 },
        { x: 20 + (seed * 19) % (BUILDING_W - 34), y: BUILDING_H - 26 - (seed * 5) % 15, w: 8, h: 8 },
      ],
    });
  }
}

// Safe spawn point: the open margin road that rings the whole building grid.
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
const POLICE_SPEED = 3.2;
const POLICE_SPAWN_INTERVAL = 20;
const MAX_POLICE = 5;

const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

let player, police, wanted, elapsed, gameRunning, policeSpawnTimer;

function circleHitsBuilding(x, y, r) {
  for (const b of BUILDINGS) {
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
  gameOverEl.hidden = true;
  updateHud();
}

function updateHud() {
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60);
  timeEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
  wantedFillEl.style.width = `${wanted}%`;
  wantedFillEl.style.backgroundColor = wanted > 60 ? "#ff3b3b" : wanted > 25 ? "#ff9d3b" : "#ffcc00";
}

function moveCar(car, accelInput, brakeInput, turnInput) {
  if (accelInput) car.speed += ACCEL;
  if (brakeInput) car.speed -= BRAKE;
  car.speed *= FRICTION;
  car.speed = Math.max(MAX_REVERSE, Math.min(MAX_SPEED, car.speed));

  if (Math.abs(car.speed) > 0.05) {
    const dir = car.speed > 0 ? 1 : -1;
    car.angle += turnInput * TURN_RATE * dir;
  }

  const nx = car.x + Math.cos(car.angle) * car.speed;
  const ny = car.y + Math.sin(car.angle) * car.speed;

  if (!circleHitsBuilding(nx, ny, CAR_RADIUS) && nx > CAR_RADIUS && nx < W - CAR_RADIUS && ny > CAR_RADIUS && ny < H - CAR_RADIUS) {
    car.x = nx;
    car.y = ny;
  } else {
    car.speed = 0;
  }
}

function updatePlayer() {
  const accelInput = !!keys["ArrowUp"];
  const brakeInput = !!keys["ArrowDown"];
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

  if (!circleHitsBuilding(nx, ny, CAR_RADIUS) && nx > CAR_RADIUS && nx < W - CAR_RADIUS && ny > CAR_RADIUS && ny < H - CAR_RADIUS) {
    cop.x = nx;
    cop.y = ny;
  } else {
    cop.waypoint = pickWaypoint();
  }
}

function update() {
  if (!gameRunning) return;

  elapsed += 1 / 60;
  updatePlayer();

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
  gameOverEl.hidden = false;
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

function drawBuildings() {
  for (const b of BUILDINGS) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    for (const v of b.vents) {
      ctx.fillRect(b.x + v.x, b.y + v.y, v.w, v.h);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawBuildings();

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

restartBtn.addEventListener("click", initGame);

initGame();
loop();
