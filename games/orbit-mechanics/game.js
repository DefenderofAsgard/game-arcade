const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;
const CX = W / 2;
const CY = H / 2;

// Real planets in solar-system order, each with its actual surface gravity
// relative to Earth's (1.0) — this scales the game's gravity constant per
// level so heavier/lighter planets genuinely fly differently.
const PLANETS = [
  { name: "Mercury", image: "images/mercury.jpg", gravity: 0.38 },
  { name: "Venus", image: "images/venus.jpg", gravity: 0.9 },
  { name: "Earth", image: "images/earth.jpg", gravity: 1.0 },
  { name: "Mars", image: "images/mars.jpg", gravity: 0.38 },
  { name: "Jupiter", image: "images/jupiter.jpg", gravity: 2.53 },
  { name: "Saturn", image: "images/saturn.jpg", gravity: 1.07 },
  { name: "Uranus", image: "images/uranus.jpg", gravity: 0.89 },
  { name: "Neptune", image: "images/neptune.jpg", gravity: 1.14 },
];

for (const planet of PLANETS) {
  const img = new Image();
  img.loaded = false;
  img.onload = () => {
    img.loaded = true;
  };
  img.src = planet.image;
  planet.img = img;
}

function planetForLevel(levelNum) {
  return PLANETS[(levelNum - 1) % PLANETS.length];
}

const levelEl = document.getElementById("level");
const planetNameEl = document.getElementById("planet-name");
const gravityValueEl = document.getElementById("gravity-value");
const EARTH_SURFACE_GRAVITY_MS2 = 9.8;
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const newBestEl = document.getElementById("new-best");
const statusEl = document.getElementById("status");
const angleInput = document.getElementById("angle");
const speedInput = document.getElementById("speed");
const angleValueEl = document.getElementById("angle-value");
const speedValueEl = document.getElementById("speed-value");
const launchBtn = document.getElementById("launch-btn");
const abortBtn = document.getElementById("abort-btn");
const endSessionBtn = document.getElementById("end-session-btn");
const sessionSummaryEl = document.getElementById("session-summary");
const finalScoreEl = document.getElementById("final-score");
const finalLevelsEl = document.getElementById("final-levels");
const newSessionBtn = document.getElementById("new-session-btn");
const attemptsLeftEl = document.getElementById("attempts-left");
const decisionTimerEl = document.getElementById("decision-timer");

const BEST_KEY = "orbitMechanicsBestScore";
let bestScore = Number(localStorage.getItem(BEST_KEY)) || 0;
let newBestThisSession = false;
bestScoreEl.textContent = bestScore;

// Physics constants (tuned for a 600x600 canvas, arbitrary px/s units).
// BASE_GM is Earth's value; each level's actual GM is BASE_GM * planet.gravity,
// so heavier planets (e.g. Jupiter) pull noticeably harder than lighter ones
// (e.g. Mercury/Mars), matching their real relative surface gravity.
const BASE_GM = 4000000;
const PLANET_R = 40; // Earth sprite radius (2x the original 20)
const CRASH_R = 46; // just outside the visible surface
// Launch pad sits right next to the (now bigger) planet's surface.
const LAUNCH_R = 56;
const LAUNCH_POINT = { x: CX, y: CY - LAUNCH_R };
const ESCAPE_R = 280;
// Target rings stay spread out at the same 3.5x-scaled distances as before —
// only the launch pad and planet moved, not the ring placement.
const ORBIT_SCALE = 3.5;
const SUBSTEPS = 6;
const FRAME_DT = 1 / 60;
const DT_SUB = FRAME_DT / SUBSTEPS;
const MAX_FLIGHT_TIME = 25; // seconds of simulated flight before giving up
const MAX_TRAIL = 500;
const MAX_ATTEMPTS = 3; // per level, before the session ends
const DECISION_SECONDS = 60; // time allowed to set angle/speed before an attempt is used up

// First several levels are hand-tuned for a gentle difficulty ramp; beyond that, generated.
// Every band's maxR must be >= LAUNCH_R: a probe launched from r=LAUNCH_R
// necessarily passes back through that radius every revolution, so a band capped
// below it could never be satisfied for a full orbit. Values are the pre-scale
// (32-radius) design, scaled by ORBIT_SCALE so the straddle property is preserved.
const HAND_LEVELS = [
  { minR: 20, maxR: 60, points: 500 },
  { minR: 24, maxR: 50, points: 700 },
  { minR: 26, maxR: 42, points: 900 },
  { minR: 28, maxR: 38, points: 1200 },
  { minR: 29, maxR: 35, points: 1500 },
  { minR: 30, maxR: 33, points: 2000 },
].map((band) => ({ minR: band.minR * ORBIT_SCALE, maxR: band.maxR * ORBIT_SCALE, points: band.points }));

function generateLevel(levelNum) {
  if (levelNum <= HAND_LEVELS.length) return HAND_LEVELS[levelNum - 1];
  const extra = levelNum - HAND_LEVELS.length;
  const width = Math.max(2, 30 - extra * 3) * ORBIT_SCALE;
  const points = Math.min(3000, Math.round(6000 / width));
  return { minR: LAUNCH_R - width / 2, maxR: LAUNCH_R + width / 2, points };
}

const state = {
  level: 1,
  score: 0,
  levelsCompleted: 0,
  band: generateLevel(1),
  planet: planetForLevel(1),
  gm: BASE_GM * planetForLevel(1).gravity,
  flying: false,
  sessionEnded: false,
  probe: null,
  trail: [],
  minRSeen: 0,
  maxRSeen: 0,
  totalAngle: 0,
  lastAngleToPlanet: 0,
  flightTime: 0,
  attemptsLeft: MAX_ATTEMPTS,
  decisionTimeLeft: DECISION_SECONDS,
};

const sessionStart = Date.now();

function updateHud() {
  levelEl.textContent = state.level;
  scoreEl.textContent = state.score;
  planetNameEl.textContent = state.planet.name;
  const gravityMs2 = (state.planet.gravity * EARTH_SURFACE_GRAVITY_MS2).toFixed(1);
  gravityValueEl.textContent = `${state.planet.gravity.toFixed(2)}× Earth (${gravityMs2} m/s²)`;
  attemptsLeftEl.textContent = state.attemptsLeft;
  decisionTimerEl.textContent = `${Math.ceil(state.decisionTimeLeft)}s`;
}

function updateSliderLabels() {
  angleValueEl.textContent = `${angleInput.value}°`;
  speedValueEl.textContent = speedInput.value;
}

// Resets the launch controls and decision clock — called at the start of every
// fresh attempt, whether that's a new level or a retry after a failed one.
function resetForNewAttempt() {
  angleInput.value = 0;
  speedInput.value = 30;
  updateSliderLabels();
  state.decisionTimeLeft = DECISION_SECONDS;
  decisionTimerEl.textContent = `${DECISION_SECONDS}s`;
}

function finishSession(reason) {
  if (state.sessionEnded) return;
  state.sessionEnded = true;
  if (state.flying) abortFlight();
  const elapsed = (Date.now() - sessionStart) / 1000;
  savePlatformProgress("orbitMechanics", { score: state.score, levelsCompleted: state.levelsCompleted });
  addPlaytime(elapsed);

  finalScoreEl.textContent = state.score;
  finalLevelsEl.textContent = state.levelsCompleted;
  newBestEl.hidden = !newBestThisSession;
  sessionSummaryEl.hidden = false;
  launchBtn.disabled = true;
  abortBtn.hidden = true;
  endSessionBtn.disabled = true;
  angleInput.disabled = true;
  speedInput.disabled = true;
  statusEl.textContent = reason || "Session ended";
}

angleInput.addEventListener("input", updateSliderLabels);
speedInput.addEventListener("input", updateSliderLabels);
resetForNewAttempt();
updateHud();

function launch() {
  if (state.flying || state.sessionEnded) return;
  const angleRad = (parseFloat(angleInput.value) * Math.PI) / 180;
  const speed = parseFloat(speedInput.value);
  // Compass convention: 0deg = up, 90deg = right, 180deg = down, 270deg = left.
  state.probe = {
    pos: { x: LAUNCH_POINT.x, y: LAUNCH_POINT.y },
    vel: { x: speed * Math.sin(angleRad), y: -speed * Math.cos(angleRad) },
  };
  state.trail = [{ x: LAUNCH_POINT.x, y: LAUNCH_POINT.y }];
  state.minRSeen = LAUNCH_R;
  state.maxRSeen = LAUNCH_R;
  state.totalAngle = 0;
  state.lastAngleToPlanet = Math.atan2(LAUNCH_POINT.y - CY, LAUNCH_POINT.x - CX);
  state.flightTime = 0;
  state.flying = true;

  launchBtn.disabled = true;
  angleInput.disabled = true;
  speedInput.disabled = true;
  abortBtn.hidden = false;
  statusEl.textContent = "Flying...";
}

function endFlight(outcome) {
  state.flying = false;
  state.trail = [];
  launchBtn.disabled = false;
  angleInput.disabled = false;
  speedInput.disabled = false;
  abortBtn.hidden = true;

  if (outcome === "success") {
    state.score += state.band.points;
    scoreEl.textContent = state.score;
    if (state.score > bestScore) {
      bestScore = state.score;
      localStorage.setItem(BEST_KEY, String(bestScore));
      bestScoreEl.textContent = bestScore;
      newBestThisSession = true;
    }
    state.levelsCompleted += 1;
    const completedPlanet = state.planet.name;
    state.level += 1;
    state.band = generateLevel(state.level);
    state.planet = planetForLevel(state.level);
    state.gm = BASE_GM * state.planet.gravity;
    state.attemptsLeft = MAX_ATTEMPTS;
    resetForNewAttempt();
    statusEl.textContent = `Orbit locked around ${completedPlanet}! Press Launch to try ${state.planet.name} (level ${state.level})`;
    updateHud();
    return;
  }

  const failMessages = {
    crash: "Crashed into the planet",
    escape: "Escaped into space",
    "out-of-band": "Orbit drifted outside the target ring",
    timeout: "Orbit never settled",
    "time-up": "Ran out of time to decide",
    aborted: "Flight aborted",
  };
  state.attemptsLeft -= 1;
  if (state.attemptsLeft <= 0) {
    updateHud();
    finishSession(`${failMessages[outcome]} — out of attempts, session ended`);
    return;
  }
  resetForNewAttempt();
  statusEl.textContent = `${failMessages[outcome]} — ${state.attemptsLeft} attempt${state.attemptsLeft === 1 ? "" : "s"} left on ${state.planet.name}`;
  updateHud();
}

function abortFlight() {
  if (!state.flying) return;
  endFlight("aborted");
}

function updateDecisionTimer(dt) {
  if (state.flying || state.sessionEnded) return;
  state.decisionTimeLeft -= dt;
  decisionTimerEl.textContent = `${Math.max(0, Math.ceil(state.decisionTimeLeft))}s`;
  if (state.decisionTimeLeft <= 0) {
    endFlight("time-up");
  }
}

function simulateFrame() {
  if (!state.flying) return;
  const p = state.probe;
  for (let i = 0; i < SUBSTEPS; i++) {
    const rx = p.pos.x - CX;
    const ry = p.pos.y - CY;
    const r = Math.max(Math.hypot(rx, ry), 1e-6);
    const a = -state.gm / (r * r * r);
    p.vel.x += a * rx * DT_SUB;
    p.vel.y += a * ry * DT_SUB;
    p.pos.x += p.vel.x * DT_SUB;
    p.pos.y += p.vel.y * DT_SUB;

    const rx2 = p.pos.x - CX;
    const ry2 = p.pos.y - CY;
    const r2 = Math.hypot(rx2, ry2);
    state.minRSeen = Math.min(state.minRSeen, r2);
    state.maxRSeen = Math.max(state.maxRSeen, r2);

    const angleNow = Math.atan2(ry2, rx2);
    let dAngle = angleNow - state.lastAngleToPlanet;
    if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
    if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
    state.totalAngle += dAngle;
    state.lastAngleToPlanet = angleNow;
    state.flightTime += DT_SUB;

    if (r2 < CRASH_R) return endFlight("crash");
    if (r2 > ESCAPE_R) return endFlight("escape");
    if (Math.abs(state.totalAngle) >= 2 * Math.PI) {
      const inBand = state.maxRSeen <= state.band.maxR;
      return endFlight(inBand ? "success" : "out-of-band");
    }
    if (state.flightTime > MAX_FLIGHT_TIME) return endFlight("timeout");
  }
  state.trail.push({ x: p.pos.x, y: p.pos.y });
  if (state.trail.length > MAX_TRAIL) state.trail.shift();
}

function drawRing(minR, maxR, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.arc(CX, CY, maxR, 0, Math.PI * 2);
  ctx.arc(CX, CY, minR, 0, Math.PI * 2, true);
  ctx.fillStyle = fillStyle;
  ctx.fill("evenodd");
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(CX, CY, minR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CX, CY, maxR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

const ROCKET_LEN = 18;
const ROCKET_W = 8;

function drawRocket(x, y, dirX, dirY, flying) {
  const angle = Math.atan2(dirY, dirX);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (flying) {
    ctx.beginPath();
    ctx.moveTo(-ROCKET_LEN / 2, -3);
    ctx.lineTo(-ROCKET_LEN / 2 - 9, 0);
    ctx.lineTo(-ROCKET_LEN / 2, 3);
    ctx.closePath();
    ctx.fillStyle = "#ff9d3b";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(-ROCKET_LEN / 2 + 4, -3);
  ctx.lineTo(-ROCKET_LEN / 2 - 2, -9);
  ctx.lineTo(-ROCKET_LEN / 2 + 7, -3);
  ctx.closePath();
  ctx.fillStyle = "#c0392b";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-ROCKET_LEN / 2 + 4, 3);
  ctx.lineTo(-ROCKET_LEN / 2 - 2, 9);
  ctx.lineTo(-ROCKET_LEN / 2 + 7, 3);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(ROCKET_LEN / 2, 0);
  ctx.lineTo(-ROCKET_LEN / 2 + 4, -ROCKET_W / 2);
  ctx.lineTo(-ROCKET_LEN / 2, 0);
  ctx.lineTo(-ROCKET_LEN / 2 + 4, ROCKET_W / 2);
  ctx.closePath();
  ctx.fillStyle = "#eeeeee";
  ctx.fill();
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(ROCKET_LEN / 6, 0, 1.6, 0, Math.PI * 2);
  ctx.fillStyle = "#39ff14";
  ctx.fill();

  ctx.restore();
}

let lastFrameTs = performance.now();

function render() {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTs) / 1000, 0.25);
  lastFrameTs = now;
  updateDecisionTimer(dt);

  ctx.clearRect(0, 0, W, H);

  if (state.band) {
    drawRing(state.band.minR, state.band.maxR, "rgba(142, 203, 255, 0.15)", "rgba(142, 203, 255, 0.6)");
  }

  // Planet (real NASA imagery for the current level's planet, clipped to a circle)
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, PLANET_R, 0, Math.PI * 2);
  ctx.closePath();
  if (state.planet.img.loaded) {
    ctx.clip();
    ctx.drawImage(state.planet.img, CX - PLANET_R, CY - PLANET_R, PLANET_R * 2, PLANET_R * 2);
  } else {
    ctx.fillStyle = "#7fd18a";
    ctx.fill();
  }
  ctx.restore();

  // Trail
  if (state.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(state.trail[0].x, state.trail[0].y);
    for (let i = 1; i < state.trail.length; i++) ctx.lineTo(state.trail[i].x, state.trail[i].y);
    ctx.strokeStyle = "rgba(255, 226, 138, 0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (state.flying && state.probe) {
    drawRocket(state.probe.pos.x, state.probe.pos.y, state.probe.vel.x, state.probe.vel.y, true);
  } else if (!state.sessionEnded) {
    // Idle: rocket sits on the pad next to the planet, aimed per the current sliders.
    const angleRad = (parseFloat(angleInput.value) * Math.PI) / 180;
    const dirX = Math.sin(angleRad);
    const dirY = -Math.cos(angleRad);
    drawRocket(LAUNCH_POINT.x, LAUNCH_POINT.y, dirX, dirY, false);
  }

  requestAnimationFrame(() => {
    simulateFrame();
    render();
  });
}

launchBtn.addEventListener("click", launch);
abortBtn.addEventListener("click", abortFlight);

endSessionBtn.addEventListener("click", () => finishSession("Session ended"));

newSessionBtn.addEventListener("click", () => {
  window.location.reload();
});

render();
