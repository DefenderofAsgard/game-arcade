const provider = new firebase.auth.GoogleAuthProvider();

const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const userInfo = document.getElementById("user-info");
const userName = document.getElementById("user-name");
const userPhoto = document.getElementById("user-photo");

function setAvatar(imgEl, user) {
  if (user.photoURL) {
    imgEl.src = user.photoURL;
    imgEl.hidden = false;
    imgEl.onerror = () => {
      imgEl.hidden = true;
    };
  } else {
    imgEl.hidden = true;
  }
}

signInBtn.addEventListener("click", () => {
  platformAuth.signInWithPopup(provider).catch((err) => {
    console.error("Sign-in failed:", err);
  });
});

signOutBtn.addEventListener("click", () => {
  platformAuth.signOut();
});

platformAuth.onAuthStateChanged((user) => {
  if (user) {
    signInBtn.hidden = true;
    userInfo.hidden = false;
    userName.textContent = user.displayName;
    setAvatar(userPhoto, user);

    platformDb.collection("users").doc(user.uid).set(
      {
        name: user.displayName,
        email: user.email,
        lastSignIn: new Date(),
      },
      { merge: true }
    );
  } else {
    signInBtn.hidden = false;
    userInfo.hidden = true;
  }
});
