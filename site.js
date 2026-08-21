const PLAYLIST_URI = "spotify:playlist:18vUeZ9BdtMRNV6gI8RnR6";
const experience = document.getElementById("experience");
const entryGate = document.getElementById("entry-gate");
const enterButton = document.getElementById("enter-button");
const spiralVideo = document.getElementById("spiral-video");
const spotifyShell = document.getElementById("spotify-shell");
const signal = document.getElementById("signal");
const signalText = document.getElementById("signal-text");

let spotifyController = null;
let requestedPlayback = false;
let fallbackActive = false;

function setSignal(text, playing = false) {
  signalText.textContent = text;
  signal.classList.toggle("is-playing", playing);
}

function makeGateReady() {
  enterButton.disabled = false;
  enterButton.setAttribute("aria-busy", "false");
  enterButton.classList.add("is-ready");
}

window.setTimeout(() => {
  enterButton.classList.add("is-ready");
}, 420);

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const mount = document.getElementById("spotify-embed");
  if (!mount || fallbackActive) return;

  IFrameAPI.createController(
    mount,
    { width: "100%", height: 352, uri: PLAYLIST_URI },
    (controller) => {
      spotifyController = controller;

      controller.addListener("ready", () => {
        setSignal("SYSTEM READY");
        makeGateReady();
        if (requestedPlayback) controller.play();
      });

      controller.addListener("playback_started", () => {
        setSignal("TRANSMITTING", true);
      });

      controller.addListener("playback_update", (event) => {
        if (typeof event.data?.isPaused === "boolean") {
          setSignal(event.data.isPaused ? "SYSTEM READY" : "TRANSMITTING", !event.data.isPaused);
        }
      });
    },
  );
};

window.setTimeout(() => {
  if (spotifyController) return;
  fallbackActive = true;
  spotifyShell.innerHTML = `
    <iframe
      class="spotify-fallback"
      title="Spotify playlist player"
      src="https://open.spotify.com/embed/playlist/18vUeZ9BdtMRNV6gI8RnR6?utm_source=generator&theme=0"
      width="100%"
      height="352"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="eager"
    ></iframe>`;
  setSignal("SYSTEM READY");
  makeGateReady();
}, 5000);

enterButton.addEventListener("click", () => {
  requestedPlayback = true;
  experience.classList.add("is-live");
  entryGate.classList.add("is-open");
  spiralVideo.play().catch(() => {});
  spotifyController?.play();
});

experience.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const x = event.clientX / window.innerWidth - 0.5;
  const y = event.clientY / window.innerHeight - 0.5;
  experience.style.setProperty("--tilt-x", `${y * -2.2}deg`);
  experience.style.setProperty("--tilt-y", `${x * 2.8}deg`);
  experience.style.setProperty("--shift-x", `${x * -18}px`);
  experience.style.setProperty("--shift-y", `${y * -14}px`);
  experience.style.setProperty("--pointer-x", `${event.clientX}px`);
  experience.style.setProperty("--pointer-y", `${event.clientY}px`);
});

experience.addEventListener("pointerleave", () => {
  experience.style.setProperty("--tilt-x", "0deg");
  experience.style.setProperty("--tilt-y", "0deg");
  experience.style.setProperty("--shift-x", "0px");
  experience.style.setProperty("--shift-y", "0px");
});
