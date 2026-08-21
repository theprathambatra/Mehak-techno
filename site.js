import {
  beginSpotifyAuthorization,
  clearPendingRoom,
  clearSpotifySession,
  completeSpotifyAuthorization,
  fetchArtistCatalog,
  getSpotifyAccessToken,
  SPOTIFY_ARTISTS,
  spotifyApi,
  wasRoomPending,
} from "./spotify.js";

const PLAYBACK_BATCH_SIZE = 50;
const AUDIT_MODE_KEY = "mehak_spotify_preview_audit_v1";

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
const partyCountdown = document.getElementById("party-countdown");
const partyCountdownLabel = document.getElementById("party-countdown-label");
const partyCountdownNumber = document.getElementById("party-countdown-number");
const partyCountdownFill = document.getElementById("party-countdown-fill");
const artbatPartyProgress = document.getElementById("artbat-party-progress");
const deckPartyProgress = document.getElementById("deck-party-progress");
const solomunPartyProgress = document.getElementById("solomun-party-progress");
const availabilityAudit = document.getElementById("availability-audit");
const auditWait = document.getElementById("audit-wait");
const auditConnect = document.getElementById("audit-connect");
const auditScanning = document.getElementById("audit-scanning");
const auditResults = document.getElementById("audit-results");
const auditCloseButton = document.getElementById("audit-close-button");
const auditConnectButton = document.getElementById("audit-connect-button");
const auditDownloadButton = document.getElementById("audit-download-button");
const auditCopyButton = document.getElementById("audit-copy-button");
const auditProgressNumber = document.getElementById("audit-progress-number");
const auditProgressFill = document.getElementById("audit-progress-fill");
const auditArtbatProgress = document.getElementById("audit-artbat-progress");
const auditSolomunProgress = document.getElementById("audit-solomun-progress");
const auditStatus = document.getElementById("audit-status");
const auditEntryCount = document.getElementById("audit-entry-count");
const auditPreviewCount = document.getElementById("audit-preview-count");
const auditMissingCount = document.getElementById("audit-missing-count");
const auditUniqueCount = document.getElementById("audit-unique-count");
const auditCoverageNumber = document.getElementById("audit-coverage-number");
const auditCoverageFill = document.getElementById("audit-coverage-fill");
const auditArtbatResult = document.getElementById("audit-artbat-result");
const auditSolomunResult = document.getElementById("audit-solomun-result");
const auditDuplicateResult = document.getElementById("audit-duplicate-result");
const recordBay = document.getElementById("record-bay");
const record = document.getElementById("record");
const recordLabel = document.getElementById("record-label");
const tonearm = document.getElementById("tonearm");
const trackNumber = document.getElementById("track-number");
const trackTotal = document.getElementById("track-total");
const trackLink = document.getElementById("track-link");
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
const spotifyLink = document.getElementById("spotify-link");
const artistButtons = Array.from(
  document.querySelectorAll(".artist-switcher button[data-artist]"),
);

let authenticated = false;
let authChecking = true;
let spotifyPlayer = null;
let playerReady = false;
let spotifyPlaying = false;
let deviceId = "";
let selectedArtist =
  sessionStorage.getItem("mehak_spotify_selected_artist") === "solomun"
    ? "solomun"
    : "artbat";
let playingArtist = selectedArtist;
let catalogs = {};
let catalogProgress = {};
let artistProgress = { artbat: 0, solomun: 0 };
let loadingCatalogs = new Set();
let currentTrack = 0;
let progressMs = 0;
let durationMs = 0;
let progressAnchor = { at: 0, position: 0 };
let previousState = null;
let queueEnd = -1;
let autoAdvancing = false;
let weatherRequested = false;
let activeTimeZone;
let playerMessage = "CONNECTING TO SPOTIFY";
let spotifySdkPromise;
let partyProgress = 0;
let partyOverlayDismissed = false;
let autoLaunchAttempted = false;
let autoPartyLaunchStarted = false;
let partyDismissTimer;
let scratchAudio = null;
const auditRequested = new URLSearchParams(window.location.search).get("audit") === "1";
if (auditRequested) sessionStorage.setItem(AUDIT_MODE_KEY, "1");
let auditMode =
  auditRequested || sessionStorage.getItem(AUDIT_MODE_KEY) === "1";
let auditReport = null;
const scratchGesture = {
  active: false,
  centerX: 0,
  centerY: 0,
  lastAngle: 0,
  lastTime: 0,
  pointerId: -1,
  rotation: 0,
  wasPlaying: false,
};

const compactNumber = (value) =>
  String(value).padStart(value > 99 ? 3 : 2, "0");

const formatTime = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getArtist = (key = selectedArtist) =>
  SPOTIFY_ARTISTS.find((artist) => artist.key === key);

const getCatalog = (key = selectedArtist) => catalogs[key] ?? [];

const getTrack = () => getCatalog()[currentTrack];

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

const setStatus = (message) => {
  playerMessage = message;
  const shown = authenticated
    ? catalogProgress[selectedArtist] ?? playerMessage
    : playerMessage;
  jukeboxStatus.textContent = shown;
  jukeboxStatus.title = shown;
};

const buildAuditReport = () => {
  const artbatTracks = catalogs.artbat ?? [];
  const solomunTracks = catalogs.solomun ?? [];
  const entries = [...artbatTracks, ...solomunTracks];
  const uniqueTracks = new Map();

  entries.forEach((track) => {
    const existing = uniqueTracks.get(track.id);
    if (!existing || (!existing.previewUrl && track.previewUrl)) {
      uniqueTracks.set(track.id, track);
    }
  });

  const unique = Array.from(uniqueTracks.values());
  const previewTracks = unique.filter((track) => Boolean(track.previewUrl));

  return {
    auditVersion: 1,
    generatedAt: new Date().toISOString(),
    source: "Spotify Web API preview_url availability snapshot",
    artists: {
      artbat: {
        entries: artbatTracks.length,
        previews: artbatTracks.filter((track) => Boolean(track.previewUrl)).length,
      },
      solomun: {
        entries: solomunTracks.length,
        previews: solomunTracks.filter((track) => Boolean(track.previewUrl)).length,
      },
    },
    summary: {
      catalogEntries: entries.length,
      duplicateEntriesAcrossArtists: entries.length - unique.length,
      uniqueTracks: unique.length,
      uniqueTracksWithPreview: previewTracks.length,
      uniqueTracksWithoutPreview: unique.length - previewTracks.length,
      previewCoveragePercent: unique.length
        ? Math.round((previewTracks.length / unique.length) * 1000) / 10
        : 0,
    },
    tracks: unique.map((track) => ({
      album: track.album,
      artists: track.artists,
      id: track.id,
      previewUrl: track.previewUrl,
      releaseDate: track.releaseDate,
      spotifyUrl: track.spotifyUrl,
      title: track.title,
      uri: track.uri,
    })),
  };
};

const renderAudit = () => {
  availabilityAudit.hidden = !auditMode;
  experience.classList.toggle("is-auditing", auditMode);
  if (!auditMode) return;

  experience.classList.add("is-live");
  entryGate.classList.add("is-open");
  void spiralVideo.play().catch(() => {});

  const allCatalogsReady = SPOTIFY_ARTISTS.every(
    (artist) => catalogs[artist.key]?.length,
  );
  auditWait.hidden = !authChecking;
  auditConnect.hidden = authChecking || authenticated;
  auditScanning.hidden = authChecking || !authenticated || allCatalogsReady;
  auditResults.hidden = !authenticated || !allCatalogsReady;

  const progress = Math.round(
    ((artistProgress.artbat ?? 0) + (artistProgress.solomun ?? 0)) / 2,
  );
  auditProgressNumber.textContent = `${progress}%`;
  auditProgressFill.style.width = `${progress}%`;
  auditArtbatProgress.textContent = `ARTBAT ${Math.round(artistProgress.artbat ?? 0)}%`;
  auditSolomunProgress.textContent = `SOLOMUN ${Math.round(artistProgress.solomun ?? 0)}%`;
  auditStatus.textContent = playerMessage;

  if (!allCatalogsReady) return;
  if (!auditReport) auditReport = buildAuditReport();
  const { artists, summary } = auditReport;
  auditEntryCount.textContent = String(summary.catalogEntries);
  auditPreviewCount.textContent = String(summary.uniqueTracksWithPreview);
  auditMissingCount.textContent = String(summary.uniqueTracksWithoutPreview);
  auditUniqueCount.textContent = String(summary.uniqueTracks);
  auditCoverageNumber.textContent = `${summary.previewCoveragePercent}%`;
  auditCoverageFill.style.width = `${summary.previewCoveragePercent}%`;
  auditArtbatResult.textContent = `ARTBAT · ${artists.artbat.previews}/${artists.artbat.entries}`;
  auditSolomunResult.textContent = `SOLOMUN · ${artists.solomun.previews}/${artists.solomun.entries}`;
  auditDuplicateResult.textContent =
    `CROSS-ARTIST DUPLICATES · ${summary.duplicateEntriesAcrossArtists}`;
};

const getPartyTarget = () => {
  if (!authenticated) return 0;
  const allCatalogsReady = SPOTIFY_ARTISTS.every(
    (artist) => catalogs[artist.key]?.length,
  );
  if (allCatalogsReady && playerReady) return 100;
  return Math.min(
    99,
    Math.max(
      2,
      Math.round(
        (artistProgress.artbat ?? 0) * 0.45 +
          (artistProgress.solomun ?? 0) * 0.45 +
          (playerReady ? 10 : 0),
      ),
    ),
  );
};

const renderPartyCountdown = () => {
  const visible =
    experience.classList.contains("is-live") &&
    authenticated &&
    !partyOverlayDismissed &&
    !auditMode;
  partyCountdown.hidden = !visible;
  if (!visible) return;

  const needsTap =
    autoLaunchAttempted &&
    /PRESS PLAY|ANOTHER TAP|AUTOPLAY/.test(playerMessage.toUpperCase());
  partyCountdownLabel.textContent =
    partyProgress < 100
      ? "COUNTDOWN TO THE PARTY"
      : spotifyPlaying
        ? "PARTY ONLINE"
        : needsTap
          ? "TAP JUKEBOX PLAY TO DROP THE NEEDLE"
          : "DROPPING THE NEEDLE";
  partyCountdownNumber.textContent = String(partyProgress);
  partyCountdownFill.style.width = `${partyProgress}%`;
  artbatPartyProgress.textContent = `ARTBAT ${Math.round(artistProgress.artbat ?? 0)}%`;
  solomunPartyProgress.textContent = `SOLOMUN ${Math.round(artistProgress.solomun ?? 0)}%`;
  deckPartyProgress.textContent = playerReady ? "DECK READY" : "DECK WARMING";
  deckPartyProgress.classList.toggle("is-ready", playerReady);
  partyCountdown.classList.toggle("is-ready", partyProgress >= 100);
};

const updatePartyCountdown = () => {
  const target = getPartyTarget();
  if (partyProgress < target) {
    partyProgress = Math.min(
      target,
      partyProgress + Math.max(1, Math.ceil((target - partyProgress) / 10)),
    );
  }
  renderPartyCountdown();
  renderAudit();

  const allCatalogsReady = SPOTIFY_ARTISTS.every(
    (artist) => catalogs[artist.key]?.length,
  );
  if (
    experience.classList.contains("is-live") &&
    !auditMode &&
    authenticated &&
    playerReady &&
    allCatalogsReady &&
    partyProgress >= 100 &&
    !autoPartyLaunchStarted
  ) {
    autoPartyLaunchStarted = true;
    autoLaunchAttempted = true;
    setStatus("100% · DROPPING THE NEEDLE");
    renderPartyCountdown();
    window.setTimeout(() => void playQueueAt(0, selectedArtist), 520);
  }
};

const setPlaying = (playing) => {
  spotifyPlaying = playing;
  experience.classList.toggle("is-playing", playing);
  signal.classList.toggle("is-playing", playing);
  record.classList.toggle("is-spinning", playing);
  tonearm.classList.toggle("is-playing", playing);
  equalizer.classList.toggle("is-moving", playing);
  playbackGlyph.className = playing ? "pause-glyph" : "play-glyph";
  playbackButton.setAttribute(
    "aria-label",
    !authenticated
      ? "Connect Spotify Premium"
      : playing
        ? "Pause jukebox"
        : "Play jukebox",
  );
  signalCopy.textContent = playing
    ? "JUKEBOX LIVE"
    : playerReady
      ? "ROOM READY"
      : authenticated
        ? "TUNING IN"
        : "SPOTIFY LOGIN";

  if (playing && partyProgress >= 100 && !partyOverlayDismissed) {
    window.clearTimeout(partyDismissTimer);
    partyDismissTimer = window.setTimeout(() => {
      partyOverlayDismissed = true;
      renderPartyCountdown();
    }, 1100);
  }
  renderPartyCountdown();
};

const renderArtistTabs = () => {
  artistButtons.forEach((button) => {
    const key = button.dataset.artist;
    const active = key === selectedArtist;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    const count = button.querySelector("small");
    if (!count) return;
    count.textContent = catalogs[key]?.length
      ? `${catalogs[key].length} TRACKS`
      : authenticated
        ? "LOADING"
        : "CONNECT";
  });
};

const renderTrack = () => {
  const artist = getArtist();
  const catalog = getCatalog();
  const track = catalog[currentTrack];
  const displayTitle = track?.title ?? `${artist.name} FULL ARCHIVE`;
  const displayArtist = track?.artists ?? "ALL UNIQUE CREDITED TRACKS";
  const displayAlbum = track
    ? `${track.album} · ${track.releaseDate.slice(0, 4)}`
    : "OLDEST TO NEWEST · FULL-LENGTH PLAYBACK";

  recordLabel.textContent = artist.name.slice(0, 1);
  trackNumber.textContent = catalog.length ? compactNumber(currentTrack + 1) : "--";
  trackTotal.textContent = catalog.length ? compactNumber(catalog.length) : "--";
  trackLink.textContent = displayTitle;
  trackLink.href = track?.spotifyUrl ?? artist.url;
  spotifyLink.href = track?.spotifyUrl ?? artist.url;
  trackMeta.title = `${displayArtist} · ${displayAlbum}`;
  trackMeta.replaceChildren(
    document.createTextNode(`${displayArtist} `),
    Object.assign(document.createElement("span"), { textContent: "·" }),
    document.createTextNode(` ${displayAlbum}`),
  );
  nowPlayingLabel.textContent = spotifyPlaying
    ? "NOW SPINNING · FULL TRACK"
    : !authenticated
      ? "PREMIUM PLAYER · LOGIN ONCE"
      : catalog.length
        ? "READY · COMPLETE CATALOG"
        : "BUILDING THE ARCHIVE";
  elapsedTime.textContent = formatTime(progressMs);
  durationTime.textContent = formatTime(durationMs || track?.durationMs || 0);
  progressFill.style.width = `${Math.min(
    100,
    (progressMs / Math.max(1, durationMs)) * 100,
  )}%`;
  previousButton.disabled = !playerReady || !catalog.length;
  nextButton.disabled = !playerReady || !catalog.length;
  playbackButton.disabled = authChecking || (authenticated && !playerReady);
  playbackButton.classList.toggle("needs-login", !authenticated);
  onlineDot.classList.toggle("is-waiting", !playerReady || !catalog.length);
  renderArtistTabs();
  setStatus(playerMessage);
};

const loadSpotifySdk = () => {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (spotifySdkPromise) return spotifySdkPromise;

  spotifySdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Spotify player took too long to load")),
      12000,
    );
    const previousReady = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      window.clearTimeout(timeout);
      if (window.Spotify) resolve(window.Spotify);
      else reject(new Error("Spotify player did not initialize"));
    };

    if (!document.querySelector("script[data-spotify-player]")) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.dataset.spotifyPlayer = "true";
      script.onerror = () => {
        window.clearTimeout(timeout);
        spotifySdkPromise = null;
        reject(new Error("Spotify player is offline"));
      };
      document.body.appendChild(script);
    }
  });

  return spotifySdkPromise;
};

const ensureCatalog = async (key) => {
  if (catalogs[key]?.length) return catalogs[key];
  if (loadingCatalogs.has(key)) return null;

  const artist = getArtist(key);
  loadingCatalogs.add(key);
  catalogProgress[key] = `SCANNING ${artist.name} RELEASES`;
  artistProgress[key] = Math.max(artistProgress[key] ?? 0, 1);
  renderTrack();
  renderPartyCountdown();

  try {
    const tracks = await fetchArtistCatalog(artist, (scan) => {
      artistProgress[key] = Math.max(artistProgress[key] ?? 0, scan.percent);
      catalogProgress[key] =
        scan.phase === "cache"
          ? "ARCHIVE RESTORED"
          : scan.phase === "releases"
            ? `FINDING RELEASES ${compactNumber(scan.completed)}/${compactNumber(scan.total)}`
            : `CUTTING VINYL ${compactNumber(scan.completed)}/${compactNumber(scan.total)}`;
      if (selectedArtist === key) renderTrack();
      renderPartyCountdown();
    });
    catalogs = { ...catalogs, [key]: tracks };
    auditReport = null;
    artistProgress[key] = 100;
    catalogProgress[key] = `${tracks.length} TRACKS READY`;
    if (selectedArtist === key) {
      durationMs = tracks[0]?.durationMs ?? 0;
      setStatus(
        spotifyPlayer
          ? `${tracks.length} TRACKS · PRESS PLAY`
          : `${tracks.length} TRACKS · STARTING PLAYER`,
      );
    }
    renderTrack();
    renderPartyCountdown();
    return tracks;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toUpperCase() : "CATALOG OFFLINE";
    catalogProgress[key] = message;
    setStatus(message);
    if (/SESSION|CONNECT/.test(message)) {
      authenticated = false;
      playerReady = false;
    }
    renderTrack();
    return null;
  } finally {
    loadingCatalogs.delete(key);
  }
};

const playQueueAt = async (requestedIndex, requestedArtist = selectedArtist) => {
  let catalog = getCatalog(requestedArtist);

  if (!authenticated) {
    await beginSpotifyAuthorization(requestedArtist);
    return;
  }
  if (!catalog.length) catalog = (await ensureCatalog(requestedArtist)) ?? [];
  if (!catalog.length) return;
  if (!spotifyPlayer || !deviceId) {
    setStatus("PLAYER IS STILL WARMING UP");
    return;
  }

  const index = (requestedIndex + catalog.length) % catalog.length;
  const batch = catalog.slice(index, index + PLAYBACK_BATCH_SIZE);

  try {
    await spotifyPlayer.activateElement();
    setStatus("DROPPING THE NEEDLE");
    playingArtist = requestedArtist;
    queueEnd = index + batch.length - 1;
    currentTrack = index;
    progressMs = 0;
    durationMs = catalog[index].durationMs;
    renderTrack();

    await spotifyApi(
      `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          position_ms: 0,
          uris: batch.map((track) => track.uri),
        }),
      },
    );

    void Promise.allSettled([
      spotifyApi(
        `https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT" },
      ),
      spotifyApi(
        `https://api.spotify.com/v1/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`,
        { method: "PUT" },
      ),
    ]);
  } catch (error) {
    setPlaying(false);
    setStatus(
      error instanceof Error
        ? error.message.toUpperCase()
        : "PLAYBACK NEEDS ANOTHER TAP",
    );
  }
};

const initializePlayer = async () => {
  try {
    const Spotify = await loadSpotifySdk();
    spotifyPlayer = new Spotify.Player({
      name: "MAC's Private Listening Room",
      enableMediaSession: true,
      volume: 0.82,
      getOAuthToken: (callback) => {
        void getSpotifyAccessToken()
          .then(callback)
          .catch(() => {
            clearSpotifySession();
            authenticated = false;
            playerReady = false;
            setStatus("SESSION EXPIRED · CONNECT AGAIN");
            renderTrack();
          });
      },
    });

    spotifyPlayer.addListener("ready", ({ device_id: readyDeviceId }) => {
      deviceId = readyDeviceId;
      playerReady = true;
      const count = getCatalog().length;
      setStatus(count ? `${count} TRACKS · PRESS PLAY` : "PLAYER READY · BUILDING ARCHIVE");
      renderTrack();
    });

    spotifyPlayer.addListener("not_ready", () => {
      playerReady = false;
      setPlaying(false);
      setStatus("PLAYER RECONNECTING");
      renderTrack();
    });

    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;
      const catalog = getCatalog(playingArtist);
      const index = catalog.findIndex(
        (track) => track.uri === state.track_window.current_track.uri,
      );

      if (index >= 0 && selectedArtist === playingArtist) {
        currentTrack = index;
        progressMs = state.position;
        durationMs = state.duration;
        progressAnchor = { at: performance.now(), position: state.position };
        setPlaying(!state.paused);
        setStatus(
          state.paused
            ? `${catalog.length} TRACKS · PAUSED`
            : `${catalog.length} TRACKS · PLAYING IN ORDER`,
        );

        const endedBatch =
          state.paused &&
          index === queueEnd &&
          index < catalog.length - 1 &&
          previousState?.track_window.current_track.uri ===
            state.track_window.current_track.uri &&
          previousState.position > Math.max(0, previousState.duration - 1800);

        if (endedBatch && !autoAdvancing) {
          autoAdvancing = true;
          window.setTimeout(() => {
            void playQueueAt(index + 1, playingArtist).finally(() => {
              autoAdvancing = false;
            });
          }, 120);
        }
        renderTrack();
      }

      previousState = state;
    });

    spotifyPlayer.addListener("autoplay_failed", () => {
      setPlaying(false);
      setStatus("PRESS PLAY TO START THE ROOM");
      renderTrack();
    });

    spotifyPlayer.addListener("account_error", () => {
      playerReady = false;
      setPlaying(false);
      setStatus("SPOTIFY PREMIUM IS REQUIRED");
      renderTrack();
    });

    spotifyPlayer.addListener("authentication_error", () => {
      clearSpotifySession();
      authenticated = false;
      playerReady = false;
      setPlaying(false);
      setStatus("SESSION EXPIRED · CONNECT AGAIN");
      renderTrack();
    });

    spotifyPlayer.addListener("initialization_error", () => {
      playerReady = false;
      setStatus("THIS BROWSER CANNOT START SPOTIFY");
      renderTrack();
    });

    spotifyPlayer.addListener("playback_error", ({ message }) => {
      setPlaying(false);
      setStatus((message ?? "PLAYBACK NEEDS ANOTHER TAP").toUpperCase());
      renderTrack();
    });

    await spotifyPlayer.connect();
  } catch (error) {
    playerReady = false;
    setStatus(
      error instanceof Error ? error.message.toUpperCase() : "PLAYER OFFLINE",
    );
    renderTrack();
  }
};

const selectArtist = (key) => {
  if (key === selectedArtist) return;
  void spotifyPlayer?.pause();
  setPlaying(false);
  selectedArtist = key;
  sessionStorage.setItem("mehak_spotify_selected_artist", key);
  currentTrack = 0;
  progressMs = 0;
  durationMs = getCatalog(key)[0]?.durationMs ?? 0;
  previousState = null;
  const count = getCatalog(key).length;
  setStatus(
    count ? `${count} TRACKS · PRESS PLAY` : `BUILDING ${key.toUpperCase()} ARCHIVE`,
  );
  renderTrack();
  if (authenticated) void ensureCatalog(key);
};

const togglePlayback = async () => {
  if (!authenticated) {
    await beginSpotifyAuthorization(selectedArtist);
    return;
  }
  if (!playerReady || !spotifyPlayer) {
    setStatus("PLAYER IS STILL WARMING UP");
    return;
  }

  await spotifyPlayer.activateElement();
  if (spotifyPlaying) {
    await spotifyPlayer.pause();
    setPlaying(false);
    renderTrack();
    return;
  }

  if (
    playingArtist === selectedArtist &&
    previousState?.track_window.current_track.uri === getTrack()?.uri
  ) {
    await spotifyPlayer.resume();
  } else {
    await playQueueAt(currentTrack, selectedArtist);
  }
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

const startScratchAudio = () => {
  if (!("AudioContext" in window)) return null;

  const context = new AudioContext();
  const source = context.createBufferSource();
  const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const channel = noise.getChannelData(0);
  let previous = 0;

  for (let index = 0; index < channel.length; index += 1) {
    const raw = Math.random() * 2 - 1;
    previous = previous * 0.42 + raw * 0.58;
    channel[index] = raw - previous * 0.72;
  }

  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  const oscillatorGain = context.createGain();

  source.buffer = noise;
  source.loop = true;
  source.playbackRate.value = 0.8;
  filter.type = "bandpass";
  filter.frequency.value = 1250;
  filter.Q.value = 1.35;
  gain.gain.value = 0.0001;
  oscillator.type = "triangle";
  oscillator.frequency.value = 180;
  oscillatorGain.gain.value = 0.0001;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.connect(oscillatorGain);
  oscillatorGain.connect(context.destination);
  source.start();
  oscillator.start();
  void context.resume();

  scratchAudio = {
    context,
    filter,
    gain,
    oscillator,
    oscillatorGain,
    source,
  };
  return scratchAudio;
};

const driveScratchSound = (angleDelta, elapsed) => {
  if (!scratchAudio) return;

  const velocity = Math.abs(angleDelta) / Math.max(8, elapsed);
  const intensity = Math.min(1, velocity * 2.7);
  const directionTone = angleDelta < 0 ? 0.78 : 1.16;
  const now = scratchAudio.context.currentTime;
  const peak = 0.018 + intensity * 0.15;

  scratchAudio.gain.gain.cancelScheduledValues(now);
  scratchAudio.gain.gain.setValueAtTime(
    Math.max(0.0001, scratchAudio.gain.gain.value),
    now,
  );
  scratchAudio.gain.gain.linearRampToValueAtTime(peak, now + 0.012);
  scratchAudio.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  scratchAudio.oscillatorGain.gain.cancelScheduledValues(now);
  scratchAudio.oscillatorGain.gain.setValueAtTime(
    Math.max(0.0001, scratchAudio.oscillatorGain.gain.value),
    now,
  );
  scratchAudio.oscillatorGain.gain.linearRampToValueAtTime(
    0.004 + intensity * 0.028,
    now + 0.01,
  );
  scratchAudio.oscillatorGain.gain.exponentialRampToValueAtTime(
    0.0001,
    now + 0.095,
  );
  scratchAudio.filter.frequency.setTargetAtTime(
    620 + intensity * 4200,
    now,
    0.012,
  );
  scratchAudio.source.playbackRate.setTargetAtTime(
    (0.42 + intensity * 2.35) * directionTone,
    now,
    0.01,
  );
  scratchAudio.oscillator.frequency.setTargetAtTime(
    (120 + intensity * 760) * directionTone,
    now,
    0.012,
  );
};

const stopScratchAudio = () => {
  const audio = scratchAudio;
  scratchAudio = null;
  if (!audio) return;

  const now = audio.context.currentTime;
  audio.gain.gain.cancelScheduledValues(now);
  audio.gain.gain.setTargetAtTime(0.0001, now, 0.022);
  audio.oscillatorGain.gain.cancelScheduledValues(now);
  audio.oscillatorGain.gain.setTargetAtTime(0.0001, now, 0.018);
  window.setTimeout(() => {
    try {
      audio.source.stop();
      audio.oscillator.stop();
    } catch {
      // A rapid second gesture may already have stopped these nodes.
    }
    void audio.context.close();
  }, 90);
};

const startVinylScratch = (event) => {
  if (!("AudioContext" in window) || scratchGesture.active) return;
  event.preventDefault();
  event.stopPropagation();

  const bounds = recordBay.getBoundingClientRect();
  scratchGesture.centerX = bounds.left + bounds.width / 2;
  scratchGesture.centerY = bounds.top + bounds.height / 2;
  scratchGesture.lastAngle = Math.atan2(
    event.clientY - scratchGesture.centerY,
    event.clientX - scratchGesture.centerX,
  );
  scratchGesture.lastTime = performance.now();
  scratchGesture.pointerId = event.pointerId;
  scratchGesture.wasPlaying = spotifyPlaying;
  scratchGesture.active = true;
  recordBay.setPointerCapture(event.pointerId);
  recordBay.classList.add("is-scratching");
  record.classList.add("is-scratching");
  tonearm.classList.add("is-scratching");
  startScratchAudio();

  if (spotifyPlaying) {
    void spotifyPlayer?.pause();
    setPlaying(false);
  }
};

const moveVinylScratch = (event) => {
  if (!scratchGesture.active || scratchGesture.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  const angle = Math.atan2(
    event.clientY - scratchGesture.centerY,
    event.clientX - scratchGesture.centerX,
  );
  let delta = ((angle - scratchGesture.lastAngle) * 180) / Math.PI;
  delta = ((delta + 540) % 360) - 180;
  const now = performance.now();

  scratchGesture.rotation += delta;
  scratchGesture.lastAngle = angle;
  driveScratchSound(delta, now - scratchGesture.lastTime);
  scratchGesture.lastTime = now;
  record.style.setProperty("--scratch-angle", `${scratchGesture.rotation}deg`);
};

const finishVinylScratch = (event) => {
  if (!scratchGesture.active || scratchGesture.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();

  if (recordBay.hasPointerCapture(event.pointerId)) {
    recordBay.releasePointerCapture(event.pointerId);
  }
  scratchGesture.active = false;
  recordBay.classList.remove("is-scratching");
  record.classList.remove("is-scratching");
  tonearm.classList.remove("is-scratching");
  stopScratchAudio();

  if (scratchGesture.wasPlaying) {
    void spotifyPlayer?.resume().catch(() => {
      setStatus("PRESS PLAY TO RESUME THE ROOM");
      renderTrack();
    });
  }
};

const nudgeVinyl = (direction) => {
  if (!("AudioContext" in window) || scratchGesture.active) return;
  scratchGesture.active = true;
  scratchGesture.wasPlaying = spotifyPlaying;
  scratchGesture.rotation += direction * 42;
  record.style.setProperty("--scratch-angle", `${scratchGesture.rotation}deg`);
  recordBay.classList.add("is-scratching");
  record.classList.add("is-scratching");
  tonearm.classList.add("is-scratching");
  startScratchAudio();
  driveScratchSound(direction * 42, 45);
  if (spotifyPlaying) {
    void spotifyPlayer?.pause();
    setPlaying(false);
  }
  window.setTimeout(() => {
    scratchGesture.active = false;
    recordBay.classList.remove("is-scratching");
    record.classList.remove("is-scratching");
    tonearm.classList.remove("is-scratching");
    stopScratchAudio();
    if (scratchGesture.wasPlaying) void spotifyPlayer?.resume();
  }, 150);
};

const connectAudit = async () => {
  sessionStorage.setItem(AUDIT_MODE_KEY, "1");
  auditMode = true;
  renderAudit();
  if (!authenticated && !authChecking) {
    await beginSpotifyAuthorization(selectedArtist);
  }
};

const downloadAudit = () => {
  auditReport ??= buildAuditReport();
  const blob = new Blob([JSON.stringify(auditReport, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mehak-spotify-preview-audit-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const copyAuditSummary = async () => {
  auditReport ??= buildAuditReport();
  const summary = auditReport.summary;
  const message = [
    "MEHAK SPOTIFY PREVIEW AUDIT",
    `${summary.catalogEntries} catalog entries`,
    `${summary.uniqueTracks} unique tracks`,
    `${summary.uniqueTracksWithPreview} Spotify preview files available`,
    `${summary.uniqueTracksWithoutPreview} without preview files`,
    `${summary.previewCoveragePercent}% preview coverage`,
  ].join(" · ");
  try {
    await navigator.clipboard.writeText(message);
    auditCopyButton.textContent = "RESULT COPIED";
    window.setTimeout(() => {
      auditCopyButton.textContent = "COPY RESULT FOR CHATGPT";
    }, 1800);
  } catch {
    auditCopyButton.textContent = "COPY FAILED · DOWNLOAD JSON";
  }
};

const closeAudit = () => {
  sessionStorage.removeItem(AUDIT_MODE_KEY);
  const url = new URL(window.location.href);
  url.searchParams.delete("audit");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  auditMode = false;
  renderAudit();
  renderPartyCountdown();
  if (authenticated && !spotifyPlayer) void initializePlayer();
};

window.setTimeout(() => {
  enterButton.classList.add("is-ready");
  enterButton.disabled = authChecking;
  enterButton.setAttribute("aria-busy", String(authChecking));
}, 520);

window.setInterval(updateClock, 1000);
window.setInterval(updatePartyCountdown, 54);
window.setInterval(() => {
  if (!spotifyPlaying) return;
  progressMs = Math.min(
    durationMs,
    progressAnchor.position + performance.now() - progressAnchor.at,
  );
  elapsedTime.textContent = formatTime(progressMs);
  progressFill.style.width = `${Math.min(
    100,
    (progressMs / Math.max(1, durationMs)) * 100,
  )}%`;
}, 250);

enterButton.addEventListener("click", async () => {
  experience.classList.add("is-live");
  entryGate.classList.add("is-open");
  renderPartyCountdown();
  await spiralVideo.play().catch(() => {});
  if (!weatherRequested) requestWeather();

  if (!authenticated && !authChecking) {
    await beginSpotifyAuthorization(selectedArtist);
    return;
  }
  if (authenticated && playerReady && getCatalog().length) {
    await playQueueAt(currentTrack, selectedArtist);
  }
});

playbackButton.addEventListener("click", () => void togglePlayback());
previousButton.addEventListener("click", () =>
  void playQueueAt(currentTrack - 1, selectedArtist),
);
nextButton.addEventListener("click", () =>
  void playQueueAt(currentTrack + 1, selectedArtist),
);
artistButtons.forEach((button) =>
  button.addEventListener("click", () => selectArtist(button.dataset.artist)),
);
environmentStrip.addEventListener("click", requestWeather);
laserButton.addEventListener("click", shootLasers);
auditConnectButton.addEventListener("click", () => void connectAudit());
auditDownloadButton.addEventListener("click", downloadAudit);
auditCopyButton.addEventListener("click", () => void copyAuditSummary());
auditCloseButton.addEventListener("click", closeAudit);
recordBay.addEventListener("pointerdown", startVinylScratch);
recordBay.addEventListener("pointermove", moveVinylScratch);
recordBay.addEventListener("pointerup", finishVinylScratch);
recordBay.addEventListener("pointercancel", finishVinylScratch);
recordBay.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  nudgeVinyl(event.key === "ArrowLeft" ? -1 : 1);
});

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

const initialize = async () => {
  updateClock();
  renderTrack();
  renderAudit();

  if (wasRoomPending()) {
    experience.classList.add("is-live");
    entryGate.classList.add("is-open");
    clearPendingRoom();
    void spiralVideo.play().catch(() => {});
    if (!weatherRequested) requestWeather();
  }

  try {
    authenticated = await completeSpotifyAuthorization();
    setStatus(
      authenticated ? "LOADING FULL ARTIST ARCHIVES" : "CONNECT PREMIUM SPOTIFY",
    );
  } catch (error) {
    authenticated = false;
    setStatus(
      error instanceof Error ? error.message.toUpperCase() : "SPOTIFY LOGIN FAILED",
    );
  } finally {
    authChecking = false;
    enterButton.disabled = false;
    enterButton.setAttribute("aria-busy", "false");
    renderTrack();
    renderAudit();
  }

  if (!authenticated) return;

  if (!auditMode) void initializePlayer();
  await Promise.all(
    SPOTIFY_ARTISTS.map((artist) => ensureCatalog(artist.key)),
  );
  renderAudit();
};

void initialize();
