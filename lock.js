(function () {
  var isLocal = location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (isLocal) return;

  var style = document.createElement("style");
  style.textContent =
    "body { visibility: hidden; }" +
    ".game-lock { visibility: visible; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: Arial, sans-serif; background-color: #000; color: #f0f0f0; padding: 40px 20px; box-sizing: border-box; }" +
    ".game-lock h1 { color: #8ecbff; }" +
    ".game-lock a { color: #8ecbff; margin-top: 20px; display: inline-block; }";
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", function () {
    document.body.innerHTML =
      '<div class="game-lock">' +
      "<h1>Coming Soon</h1>" +
      "<p>This game is still being built and isn’t playable online yet. Check back soon!</p>" +
      '<a href="../../index.html">← Back to Arcade</a>' +
      "</div>";
  });
})();
