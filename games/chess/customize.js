// Standalone settings page for games/chess — picks a board theme + piece
// style, persisted to localStorage under the same keys game.js reads
// (BOARD_THEME_KEY/PIECE_STYLE_KEY there). No chess engine needed here; the
// live preview is just a fixed starting position rendered with the same
// .board/.square/.piece-white/.piece-black classes the real game uses, so
// the theme-*/pieces-* CSS rules apply identically.
const PIECE_UNICODE = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const START_ROW_8 = ["r", "n", "b", "q", "k", "b", "n", "r"];
const START_ROW_1 = ["R", "N", "B", "Q", "K", "B", "N", "R"];

const BOARD_THEME_KEY = "chessBoardTheme";
const PIECE_STYLE_KEY = "chessPieceStyle";

const previewBoardEl = document.getElementById("preview-board");

function buildPreviewBoard() {
  previewBoardEl.innerHTML = "";
  for (let displayRank = 7; displayRank >= 0; displayRank--) {
    for (let file = 0; file < 8; file++) {
      const square = document.createElement("div");
      square.className = "square " + ((file + displayRank) % 2 === 0 ? "dark" : "light");
      let piece = null;
      if (displayRank === 7) piece = START_ROW_8[file];
      else if (displayRank === 6) piece = "p";
      else if (displayRank === 1) piece = "P";
      else if (displayRank === 0) piece = START_ROW_1[file];
      if (piece) {
        const span = document.createElement("span");
        span.className = piece === piece.toUpperCase() ? "piece-white" : "piece-black";
        span.textContent = PIECE_UNICODE[piece];
        square.appendChild(span);
      }
      previewBoardEl.appendChild(square);
    }
  }
}

function currentTheme() {
  return localStorage.getItem(BOARD_THEME_KEY) || "classic";
}
function currentPieceStyle() {
  return localStorage.getItem(PIECE_STYLE_KEY) || "classic";
}

function applyPreviewClasses() {
  const classes = ["board", "preview-board-el"];
  if (currentTheme() !== "classic") classes.push("theme-" + currentTheme());
  if (currentPieceStyle() !== "classic") classes.push("pieces-" + currentPieceStyle());
  previewBoardEl.className = classes.join(" ");
}

function refreshSelectedOutlines() {
  document.querySelectorAll('.swatch-btn[data-kind="theme"]').forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === currentTheme());
  });
  document.querySelectorAll('.swatch-btn[data-kind="pieces"]').forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === currentPieceStyle());
  });
}

document.querySelectorAll(".swatch-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.kind === "theme" ? BOARD_THEME_KEY : PIECE_STYLE_KEY;
    localStorage.setItem(key, btn.dataset.value);
    applyPreviewClasses();
    refreshSelectedOutlines();
  });
});

buildPreviewBoard();
applyPreviewClasses();
refreshSelectedOutlines();
