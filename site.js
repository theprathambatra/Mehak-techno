const playlistTracks = [
  {
    title: "Vois sur ton chemin",
    mix: "TECHNO MIX",
    artist: "BENNETT",
    uri: "spotify:track:31nfdEooLEq7dn3UMcIeB5",
    duration: 178,
  },
  {
    title: "Bla Bla Bla",
    mix: "CLUB CUT",
    artist: "ILYAA",
    uri: "spotify:track:4d8rAz6gWPJ5Vq516k2kac",
    duration: 118,
  },
  {
    title: "Push Up",
    mix: "MAIN EDIT",
    artist: "CREEDS",
    uri: "spotify:track:3AjSfp5FDvwtMU9XBsbS8j",
    duration: 139,
  },
  {
    title: "Rockafeller Skank",
    mix: "RAVE EDIT",
    artist: "ILYAA",
    uri: "spotify:track:2CeMzUrbykkE7QWA3qlXvx",
    duration: 145,
  },
  {
    title: "Thank You (Not So Bad)",
    mix: "TECHNO CUT",
    artist: "DIMITRI VEGAS · TIËSTO · DIDO · W&W",
    uri: "spotify:track:09CnYHiZ5jGT1wr1TXJ9Zt",
    duration: 140,
  },
  {
    title: "Self Aware",
    mix: "2026 MIX",
    artist: "ILYAA · ROBBE · DIVERZION",
    uri: "spotify:track:1zgmIvxibz0QHVDq19zqSR",
    duration: 144,
  },
];

const weatherLabels = {
  0: "CLEAR SKY",
  1: "MOSTLY CLEAR",
  2: "PARTLY CLOUDY",
  3: "OVERCAST",
  45: "FOGGY",
  48: "ICY FOG",
  51: "LIGHT DRIZZLE",
  53: "DRIZZLE",
  55: "HEAVY DRIZZLE",
  61: "LIGHT RAIN",
  63: "RAIN",
  65: "HEAVY RAIN",
  71: "LIGHT SNOW",
  73: "SNOW",
  75: "HEAVY SNOW",
  80: "RAIN SHOWERS",
  81: "RAIN SHOWERS",
  82: "HEAVY SHOWERS",
  95: "THUNDERSTORM",
  96: "STORM + HAIL",
  99: "STORM + HAIL",
};

const laserBeams = [
  ["5%", "66deg", "0ms", "#ff2f9b", "64vh"],
  ["12%", "72deg", "80ms", "#23f6ff", "76vh"],
  ["20%", "58deg", "140ms", "#d8ff35", "68vh"],
  ["29%", "78deg", "35ms", "#7b5cff", "82vh"],
  ["38%", "62deg", "190ms", "#ff583d", "72vh"],
  ["47%", "70deg", "110ms", "#29ff87", "88vh"],
  ["56%", "-68deg", "20ms", "#ff2f9b", "82vh"],
  ["64%", "-76deg", "150ms", "#23f6ff", "70vh"],
  ["72%", "-59deg", "90ms", "#d8ff35", "86vh"],
  ["80%", "-72deg", "210ms", "#7b5cff", "76vh"],
  ["88%", "-64deg", "55ms", "#ff583d", "68vh"],
  ["96%", "-79deg", "170ms", "#29ff87", "84vh"],
];

const experience = document.getElementById("experience");
const spiralVideo = document.getElementById("spiral-video");
const entryGate = document.getElementById("entry-gate");
const enterButton = document.getElementById("enter-button");
const environmentStrip = document.getElementById("environment-strip");
const localDate = document.getElementById("local-date");
const localTime = document.getElementById("local-time");
const localWeather = document.getElementById("local-weather");
const signal = document.getElementById("signal");
const signalCopy = document.getElementById("signal-copy");
const laserButton = document.getElementById("laser-button");
const laserShow = document.getElementById("laser-show");
const record = document.getElementById("record");
const tonearm = document.getElementById("tonearm");
const trackNumber = document.getElementById("track-number");
const trackTitle = document.getElementById("track-title");
const trackMeta = document.getElementById("track-meta");
const nowPlayingLabel = document.getElementById("now-playing-label");
const progressFill = document.getElementById("progress-fill");
const elapsedTime = document.getElementById("elapsed-time");
const durationTime = document.getElementById("duration-time");
const equalizer = document.getElementById("equalizer");
const previousButton = document.getElementById("previous-button");
const playbackButton = document.getElementById("playback-button");
const playbackGlyph = document.getElementById("playback-glyph");
const nextButton = document.getElementById("next-button");
const onlineDot = document.getElementById("online-dot");
const jukeboxStatus = document.getElementById("jukebox-status");

let spotifyController = null;
let spotifyReady = false;
let spotifyPlaying = false;
let requestedPlayback = false;
let weatherRequested = false;
let currentTrack = 0;
let progressMs = 0;
let durationMs = playlistTracks[0].duration * 1000;
let activeTimeZone;

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const updateClock = () => {
  const now = new Date();
  const timeZoneOptions = activeTimeZone ? { timeZone: activeTimeZone } : {};
  localDate.textContent = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    weekday: "short",
    ...timeZoneOptions,
  })
    .format(now)
    .replaceAll(",", "")
    .toUpperCase();
  localTime.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    ...timeZoneOptions,
  }).format(now);
};

const setPlaying = (playing) => {
  spotifyPlaying = playing;
  experience.classList.toggle("is-playing", playing);
  signal.classList.toggle("is-playing", playing);
  record.classList.toggle("is-spinning", playing);
  tonearm.classList.toggle("is-playing", playing);
  equalizer.classList.toggle("is-moving", playing);
  nowPlayingLabel.textContent = playing ? "NOW SPINNING" : "READY TO SPIN";
  signalCopy.textContent = playing
    ? "JUKEBOX LIVE"
    : spotifyReady
      ? "ROOM READY"
      : "TUNING IN";
  playbackGlyph.className = playing ? "pause-glyph" : "play-glyph";
  playbackButton.setAttribute(
    "aria-label",
    playing ? "Pause jukebox" : "Play jukebox",
  );
};

const renderTrack = () => {
  const track = playlistTracks[currentTrack];
  trackNumber.textContent = String(currentTrack + 1).padStart(2, "0");
  trackTitle.textContent = track.title;
  trackMeta.replaceChildren(
    document.createTextNode(`${track.artist} `),
    Object.assign(document.createElement("span"), { textContent: "·" }),
    document.createTextNode(` ${track.mix}`),
  );
  durationTime.textContent = formatTime(durationMs);
  elapsedTime.textContent = formatTime(progressMs);
  progressFill.style.width = `${Math.min(
    100,
    (progressMs / Math.max(1, durationMs)) * 100,
  )}%`;
};

const setSpotifyReady = () => {
  spotifyReady = true;
  previousButton.disabled = false;
  playbackButton.disabled = false;
  nextButton.disabled = false;
  onlineDot.classList.remove("is-waiting");
  jukeboxStatus.textContent = "JUKEBOX ONLINE";
  signalCopy.textContent = spotifyPlaying ? "JUKEBOX LIVE" : "ROOM READY";
};

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  const mount = document.getElementById("spotify-embed");
  if (!mount) return;

  IFrameAPI.createController(
    mount,
    { width: "100%", height: 152, uri: playlistTracks[0].uri },
    (controller) => {
      spotifyController = controller;

      controller.addListener("ready", () => {
        setSpotifyReady();
        if (requestedPlayback) controller.play();
      });

      controller.addListener("playback_started", (event) => {
        setPlaying(true);
        const activeUri = event.data?.playingURI;
        const trackIndex = playlistTracks.findIndex(
          (track) => track.uri === activeUri,
        );
        if (trackIndex >= 0) {
          currentTrack = trackIndex;
          durationMs = playlistTracks[trackIndex].duration * 1000;
          renderTrack();
        }
      });

      controller.addListener("playback_update", (event) => {
        if (typeof event.data?.isPaused === "boolean") {
          setPlaying(!event.data.isPaused);
        }
        if (typeof event.data?.position === "number") {
          progressMs = event.data.position;
        }
        if (
          typeof event.data?.duration === "number" &&
          event.data.duration > 0
        ) {
          durationMs = event.data.duration;
        }
        renderTrack();
      });
    },
  );
};

const loadTrack = (index) => {
  currentTrack = (index + playlistTracks.length) % playlistTracks.length;
  const track = playlistTracks[currentTrack];
  progressMs = 0;
  durationMs = track.duration * 1000;
  requestedPlayback = true;
  renderTrack();

  if (!spotifyController) return;
  spotifyController.loadEntity(track.uri);
  window.setTimeout(() => spotifyController?.play(), 180);
};

const requestWeather = () => {
  if (!navigator.geolocation) {
    localWeather.textContent = "WEATHER UNAVAILABLE";
    return;
  }

  localWeather.textContent = "READING LOCAL SKY";
  weatherRequested = true;

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const query = new URLSearchParams({
          latitude: coords.latitude.toFixed(4),
          longitude: coords.longitude.toFixed(4),
          current: "temperature_2m,weather_code",
          timezone: "auto",
        });
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${query.toString()}`,
        );
        if (!response.ok) throw new Error("Weather request failed");
        const data = await response.json();
        const code = data.current?.weather_code;
        const temperature = data.current?.temperature_2m;
        const unit = data.current_units?.temperature_2m ?? "°C";
        const label = weatherLabels[code] ?? "LOCAL CONDITIONS";
        localWeather.textContent =
          typeof temperature === "number"
            ? `${Math.round(temperature)}${unit} ${label}`
            : label;
        if (data.timezone) {
          activeTimeZone = data.timezone;
          updateClock();
        }
      } catch {
        localWeather.textContent = "WEATHER OFFLINE";
      }
    },
    () => {
      localWeather.textContent = "TAP TO ENABLE WEATHER";
    },
    { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 },
  );
};

const playLaserSound = () => {
  if (!("AudioContext" in window)) return;
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(980, now);
  oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.34);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.11, now + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.4);
  window.setTimeout(() => void audioContext.close(), 500);
};

const shootLasers = () => {
  laserShow.replaceChildren();
  const flash = document.createElement("div");
  flash.className = "laser-flash";
  laserShow.appendChild(flash);

  laserBeams.forEach(([left, angle, delay, color, length]) => {
    const beam = document.createElement("span");
    beam.className = "laser-shot";
    beam.style.setProperty("--laser-left", left);
    beam.style.setProperty("--laser-angle", angle);
    beam.style.setProperty("--laser-delay", delay);
    beam.style.setProperty("--laser-color", color);
    beam.style.setProperty("--laser-length", length);
    laserShow.appendChild(beam);
  });

  playLaserSound();
};

window.setTimeout(() => {
  enterButton.classList.add("is-ready");
  enterButton.disabled = false;
  enterButton.setAttribute("aria-busy", "false");
}, 520);

window.setTimeout(() => {
  if (!spotifyReady) {
    jukeboxStatus.textContent = "OPEN SPOTIFY TO LISTEN";
  }
}, 6500);

window.setInterval(updateClock, 1000);
updateClock();
renderTrack();

enterButton.addEventListener("click", () => {
  requestedPlayback = true;
  experience.classList.add("is-live");
  entryGate.classList.add("is-open");
  spiralVideo.play().catch(() => {});
  spotifyController?.play();
  if (!weatherRequested) requestWeather();
});

playbackButton.addEventListener("click", () => {
  if (!spotifyController) return;
  requestedPlayback = true;
  if (spotifyPlaying) {
    spotifyController.pause();
    setPlaying(false);
  } else {
    spotifyController.resume();
    setPlaying(true);
  }
});

previousButton.addEventListener("click", () => loadTrack(currentTrack - 1));
nextButton.addEventListener("click", () => loadTrack(currentTrack + 1));
environmentStrip.addEventListener("click", requestWeather);
laserButton.addEventListener("click", shootLasers);

experience.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const x = event.clientX / window.innerWidth - 0.5;
  const y = event.clientY / window.innerHeight - 0.5;
  experience.style.setProperty("--tilt-x", `${y * -2.2}deg`);
  experience.style.setProperty("--tilt-y", `${x * 2.8}deg`);
  experience.style.setProperty("--shift-x", `${x * -18}px`);
  experience.style.setProperty("--shift-y", `${y * -14}px`);
  experience.style.setProperty("--hero-x", `${x * 9}px`);
  experience.style.setProperty("--hero-y", `${y * 7}px`);
  experience.style.setProperty("--hero-x-reverse", `${x * -5}px`);
  experience.style.setProperty("--hero-y-reverse", `${y * -4}px`);
  experience.style.setProperty("--hero-x-soft", `${x * 3}px`);
  experience.style.setProperty("--hero-y-soft", `${y * 2}px`);
  experience.style.setProperty("--pointer-x", `${event.clientX}px`);
  experience.style.setProperty("--pointer-y", `${event.clientY}px`);
});

experience.addEventListener("pointerleave", () => {
  [
    "--tilt-x",
    "--tilt-y",
    "--shift-x",
    "--shift-y",
    "--hero-x",
    "--hero-y",
    "--hero-x-reverse",
    "--hero-y-reverse",
    "--hero-x-soft",
    "--hero-y-soft",
  ].forEach((property) => experience.style.setProperty(property, "0px"));
  experience.style.setProperty("--tilt-x", "0deg");
  experience.style.setProperty("--tilt-y", "0deg");
});
