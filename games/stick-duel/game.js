const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const healthEl = document.getElementById("health");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const gameOverEl = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart");
const nameEntryEl = document.getElementById("name-entry");
const playerNameInput = document.getElementById("player-name");
const submitScoreBtn = document.getElementById("submit-score");
const bestScoreEl = document.getElementById("best-score");
const newBestEl = document.getElementById("new-best");

const BEST_KEY = "stickDuelBestScore";
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
bestScoreEl.textContent = bestScore;

const W = canvas.width;
const H = canvas.height;

const keys = {};

let player, enemies, particles, knives, score, wave, gameRunning, disintegrateUsed, sessionStart;

function initGame() {
  player = {
    x: W / 2,
    y: H / 2,
    r: 14,
    speed: 3,
    health: 100,
    maxHealth: 100,
    facing: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hitThisSwing: new Set(),
    swingStartFacing: 0,
    spinning: false,
    spinAngle: 0,
    walkPhase: 0,
    isMoving: false,
    knifeCooldown: 0,
  };
  enemies = [];
  particles = makeParticlePool();
  knives = [];
  score = 0;
  wave = 1;
  gameRunning = true;
  disintegrateUsed = false;
  sessionStart = Date.now();
  gameOverEl.hidden = true;
  updateHud();
  spawnWave();
}

function spawnWave() {
  const count = 2 * Math.pow(2, wave - 1);
  for (let i = 0; i < count; i++) {
    enemies.push(spawnEnemy());
  }
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = -20; y = Math.random() * H; }
  else if (side === 1) { x = W + 20; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = -20; }
  else { x = Math.random() * W; y = H + 20; }
  return {
    x, y,
    r: 12,
    speed: (1 + Math.random() * 0.8 + wave * 0.1) * 0.8,
    health: 30,
    maxHealth: 30,
    facing: 0,
    attackTimer: 0,
    attackCooldown: 0,
    hasHitPlayer: false,
    swingStartFacing: 0,
    spinHitCooldown: 0,
    walkPhase: 0,
    isMoving: false,
  };
}

function updateHud() {
  healthEl.textContent = Math.max(0, Math.round(player.health));
  scoreEl.textContent = score;
  waveEl.textContent = wave;
}

const MAX_PARTICLES = 200;

function makeParticlePool() {
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 50, color: "#fff" });
  }
  return pool;
}

function spawnParticles(x, y, count, color) {
  let spawned = 0;
  for (let i = 0; i < particles.length && spawned < count; i++) {
    const p = particles[i];
    if (p.active) continue;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 30 + Math.random() * 20;
    p.maxLife = 50;
    p.color = color;
    spawned++;
  }
}

const ATTACK_DURATION = 14;
const ENEMY_ATTACK_RANGE = 45;
const SPIN_SPEED = 0.35;
const SPIN_HIT_INTERVAL = 12;
const KNIFE_SPEED = 8;
const KNIFE_COOLDOWN = 30;
const KNIFE_DAMAGE = 15;
const KNIFE_LENGTH = 16;

const SOUND_FILES = {
  death: "sounds/death.wav",
  waveClear: "sounds/wave_clear.wav",
  gameOver: "sounds/game_over.wav",
};

const SOUND_POOL_SIZE = 4;
const soundPools = {};
for (const [name, src] of Object.entries(SOUND_FILES)) {
  soundPools[name] = {
    clips: Array.from({ length: SOUND_POOL_SIZE }, () => {
      const audio = new Audio(src);
      audio.volume = 0.5;
      return audio;
    }),
    next: 0,
  };
}

function playSound(name) {
  const pool = soundPools[name];
  if (!pool) return;
  const audio = pool.clips[pool.next];
  pool.next = (pool.next + 1) % pool.clips.length;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function attack() {
  if (player.spinning) return;
  if (player.attackCooldown > 0) return;
  player.attackTimer = ATTACK_DURATION;
  player.attackCooldown = 22;
  player.hitThisSwing = new Set();
  player.swingStartFacing = player.facing;
}

function throwKnife() {
  if (!gameRunning) return;
  if (player.knifeCooldown > 0) return;
  if (enemies.length === 0) return;

  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  if (!nearest) return;

  const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
  knives.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * KNIFE_SPEED,
    vy: Math.sin(angle) * KNIFE_SPEED,
    angle,
    life: 90,
  });
  player.knifeCooldown = KNIFE_COOLDOWN;
}

const SCROLL_KEYS = ["arrowup", "arrowdown", "arrowleft", "arrowright", " "];

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys[e.key.toLowerCase()] = true;
  if (SCROLL_KEYS.includes(e.key.toLowerCase())) {
    e.preventDefault();
  }
  if (e.key === " ") {
    player.spinning = true;
  }
  if (e.key.toLowerCase() === "c") {
    throwKnife();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.target.tagName === "INPUT") return;
  keys[e.key.toLowerCase()] = false;
  if (e.key === " ") {
    player.spinning = false;
  }
});
canvas.addEventListener("mousedown", () => attack());
restartBtn.addEventListener("click", async () => {
  if (!nameEntryEl.hidden) {
    nameEntryEl.hidden = true;
    await window.Leaderboard.submitScore("Unknown", score);
  }
  initGame();
});
submitScoreBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim() || "Unknown";
  submitScoreBtn.disabled = true;
  await window.Leaderboard.submitScore(name, score);
  nameEntryEl.hidden = true;
});

function update() {
  if (!gameRunning) return;

  if (!disintegrateUsed && keys["v"] && keys["b"] && keys["n"]) {
    disintegrateUsed = true;
    for (const enemy of enemies) {
      spawnParticles(enemy.x, enemy.y, 16, "#c00000");
      score += 10;
    }
    enemies = [];
    playSound("death");
  }

  let dx = 0, dy = 0;
  if (keys["w"] || keys["arrowup"]) dy -= 1;
  if (keys["s"] || keys["arrowdown"]) dy += 1;
  if (keys["a"] || keys["arrowleft"]) dx -= 1;
  if (keys["d"] || keys["arrowright"]) dx += 1;
  player.isMoving = dx !== 0 || dy !== 0;
  if (player.isMoving) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
    player.facing = Math.atan2(dy, dx);
    player.walkPhase += 0.25;
  }
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.knifeCooldown > 0) player.knifeCooldown--;

  for (let i = knives.length - 1; i >= 0; i--) {
    const knife = knives[i];
    knife.x += knife.vx;
    knife.y += knife.vy;
    knife.life--;

    let hit = false;
    for (const enemy of enemies) {
      if (Math.hypot(enemy.x - knife.x, enemy.y - knife.y) < enemy.r + 8) {
        enemy.health -= KNIFE_DAMAGE;
        spawnParticles(knife.x, knife.y, 6, "#4fd6ff");
        hit = true;
        break;
      }
    }

    if (hit || knife.life <= 0 || knife.x < -20 || knife.x > W + 20 || knife.y < -20 || knife.y > H + 20) {
      knives.splice(i, 1);
    }
  }

  if (player.spinning) {
    player.spinAngle += SPIN_SPEED;
    const reach = 50;
    const tipX = player.x + Math.cos(player.spinAngle) * reach;
    const tipY = player.y + Math.sin(player.spinAngle) * reach;
    for (const enemy of enemies) {
      if (enemy.spinHitCooldown > 0) continue;
      if (Math.hypot(enemy.x - tipX, enemy.y - tipY) < enemy.r + 24) {
        enemy.health -= 12;
        enemy.spinHitCooldown = SPIN_HIT_INTERVAL;
      }
    }
  } else if (player.attackTimer > 0) {
    player.attackTimer--;
    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    const swingOffset = (-0.9 + 1.8 * progress);
    const swingAngle = player.swingStartFacing + swingOffset;
    const reach = 50;
    const swingX = player.x + Math.cos(swingAngle) * reach;
    const swingY = player.y + Math.sin(swingAngle) * reach;
    for (const enemy of enemies) {
      if (player.hitThisSwing.has(enemy)) continue;
      if (Math.hypot(enemy.x - swingX, enemy.y - swingY) < enemy.r + 24) {
        enemy.health -= 20;
        player.hitThisSwing.add(enemy);
      }
    }
  }

  const speedMultiplier = enemies.length > 10 ? 0.5 : 1;
  const maxAttackers = wave >= 5 ? Math.max(1, Math.floor(enemies.length * 0.4)) : Infinity;
  let attackingCount = enemies.filter((e) => e.attackTimer > 0).length;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.health <= 0) {
      spawnParticles(enemy.x, enemy.y, 16, "#c00000");
      playSound("death");
      enemies.splice(i, 1);
      score += 10;
      continue;
    }
    const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);

    if (enemy.attackCooldown > 0) enemy.attackCooldown--;
    if (enemy.spinHitCooldown > 0) enemy.spinHitCooldown--;

    if (enemy.attackTimer > 0) {
      enemy.attackTimer--;
      const progress = 1 - enemy.attackTimer / ATTACK_DURATION;
      const swingAngle = enemy.swingStartFacing + (-0.9 + 1.8 * progress);
      if (!enemy.hasHitPlayer) {
        const reach = 50;
        const tipX = enemy.x + Math.cos(swingAngle) * reach;
        const tipY = enemy.y + Math.sin(swingAngle) * reach;
        if (Math.hypot(tipX - player.x, tipY - player.y) < player.r + 24) {
          player.health -= 8;
          enemy.hasHitPlayer = true;
        }
      }
    } else if (dist < ENEMY_ATTACK_RANGE) {
      enemy.facing = ang;
      enemy.isMoving = false;
      if (enemy.attackCooldown <= 0 && attackingCount < maxAttackers) {
        enemy.attackTimer = ATTACK_DURATION;
        enemy.swingStartFacing = ang;
        enemy.attackCooldown = 50;
        enemy.hasHitPlayer = false;
        attackingCount++;
      }
    } else {
      enemy.x += Math.cos(ang) * enemy.speed * speedMultiplier;
      enemy.y += Math.sin(ang) * enemy.speed * speedMultiplier;
      enemy.facing = ang;
      enemy.isMoving = true;
      enemy.walkPhase += 0.2;
    }
  }

  if (enemies.length === 0) {
    wave++;
    player.health = player.maxHealth;
    spawnWave();
    playSound("waveClear");
  }

  for (const p of particles) {
    if (!p.active) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    if (p.life <= 0) p.active = false;
  }

  if (player.health <= 0) {
    player.health = 0;
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
    playSound("gameOver");
    savePlatformProgress("stickDuel", { score, wave });
    addPlaytime((Date.now() - sessionStart) / 1000);
    if (window.Leaderboard && window.Leaderboard.qualifiesForTopThree(score)) {
      nameEntryEl.hidden = false;
      playerNameInput.value = "";
      submitScoreBtn.disabled = false;
    } else {
      nameEntryEl.hidden = true;
    }
  }

  updateHud();
}

function drawStickFigure(x, y, facing, color, r, swingAngle, saberColor, walkPhase, isMoving, glow) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const hipY = y + r;
  const legSwing = isMoving ? Math.sin(walkPhase) * 10 : 0;
  const shoulderY = y - r + 4;
  const shoulderX = x;
  let handX, handY;

  ctx.beginPath();
  ctx.arc(x, y - r - 6, 6, 0, Math.PI * 2);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.moveTo(x, hipY);
  ctx.lineTo(x - 8 + legSwing, hipY + 14);
  ctx.moveTo(x, hipY);
  ctx.lineTo(x + 8 - legSwing, hipY + 14);

  if (swingAngle !== null) {
    const armLength = 16;
    handX = shoulderX + Math.cos(swingAngle) * armLength;
    handY = shoulderY + Math.sin(swingAngle) * armLength;
    const offArmAngle = swingAngle + Math.PI * 0.7;
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(shoulderX + Math.cos(offArmAngle) * 10, shoulderY + Math.sin(offArmAngle) * 10);
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
  } else {
    ctx.moveTo(x - 10, shoulderY);
    ctx.lineTo(x + 10, shoulderY);
  }
  ctx.stroke();

  if (swingAngle !== null) {
    const reach = 50;
    const tipX = x + Math.cos(swingAngle) * reach;
    const tipY = y + Math.sin(swingAngle) * reach;

    ctx.save();
    if (glow) {
      ctx.shadowColor = saberColor;
      ctx.shadowBlur = 18;
    }
    ctx.strokeStyle = saberColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#eafcff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#444";
    ctx.fillRect(handX - 3, handY - 3, 6, 6);
  }
}

function drawKnives() {
  for (const knife of knives) {
    const half = KNIFE_LENGTH / 2;
    const tipX = knife.x + Math.cos(knife.angle) * half;
    const tipY = knife.y + Math.sin(knife.angle) * half;
    const tailX = knife.x - Math.cos(knife.angle) * half;
    const tailY = knife.y - Math.sin(knife.angle) * half;

    ctx.save();
    ctx.shadowColor = "#4fd6ff";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#4fd6ff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#eafcff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  for (const p of particles) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  drawKnives();

  for (const enemy of enemies) {
    let enemySwingAngle = enemy.facing;
    if (enemy.attackTimer > 0) {
      const progress = 1 - enemy.attackTimer / ATTACK_DURATION;
      enemySwingAngle = enemy.swingStartFacing + (-0.9 + 1.8 * progress);
    }
    drawStickFigure(enemy.x, enemy.y, enemy.facing, "#ff5c5c", enemy.r, enemySwingAngle, "#ff3b3b", enemy.walkPhase, enemy.isMoving, false);
  }

  let swingAngle = null;
  if (player.spinning) {
    swingAngle = player.spinAngle;
  } else if (player.attackTimer > 0) {
    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    swingAngle = player.swingStartFacing + (-0.9 + 1.8 * progress);
  }
  drawStickFigure(player.x, player.y, player.facing, "#8ecbff", player.r, swingAngle, "#4fd6ff", player.walkPhase, player.isMoving, true);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initGame();
loop();
