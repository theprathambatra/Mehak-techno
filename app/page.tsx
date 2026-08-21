"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import {
  beginSpotifyAuthorization,
  CatalogTrack,
  clearPendingRoom,
  clearSpotifySession,
  completeSpotifyAuthorization,
  fetchArtistCatalog,
  getSpotifyAccessToken,
  SPOTIFY_ARTISTS,
  spotifyApi,
  wasRoomPending,
} from "./spotify";
import type { ArtistKey } from "./spotify";

const PLAYBACK_BATCH_SIZE = 50;
const SPOTIFY_MARK =
  "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png";

const LASER_BEAMS = [
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
] as const;

const WEATHER_LABELS: Record<number, string> = {
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

type SpotifyWebPlaybackTrack = {
  album: { name: string };
  artists: Array<{ name: string; uri: string }>;
  name: string;
  uri: string;
};

type SpotifyWebPlaybackState = {
  duration: number;
  paused: boolean;
  position: number;
  track_window: {
    current_track: SpotifyWebPlaybackTrack;
    next_tracks: SpotifyWebPlaybackTrack[];
    previous_tracks: SpotifyWebPlaybackTrack[];
  };
};

type SpotifyPlayer = {
  activateElement: () => Promise<void>;
  addListener: (event: string, callback: (payload: unknown) => void) => boolean;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
};

type SpotifySdk = {
  Player: new (options: {
    enableMediaSession: boolean;
    getOAuthToken: (callback: (token: string) => void) => void;
    name: string;
    volume: number;
  }) => SpotifyPlayer;
};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: SpotifySdk;
  }
}

type WeatherState = {
  label: string;
  temperature?: number;
  unit?: string;
};

type ScratchAudio = {
  context: AudioContext;
  filter: BiquadFilterNode;
  gain: GainNode;
  oscillator: OscillatorNode;
  oscillatorGain: GainNode;
  source: AudioBufferSourceNode;
};

type ScratchGesture = {
  active: boolean;
  centerX: number;
  centerY: number;
  lastAngle: number;
  lastTime: number;
  pointerId: number;
  rotation: number;
  wasPlaying: boolean;
};

let spotifySdkPromise: Promise<SpotifySdk> | null = null;

function loadSpotifySdk() {
  if (window.Spotify) return Promise.resolve(window.Spotify);
  if (spotifySdkPromise) return spotifySdkPromise;

  spotifySdkPromise = new Promise<SpotifySdk>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Spotify player took too long to load")),
      12_000,
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
}

function formatClock(timeZone?: string) {
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    weekday: "short",
    ...(timeZone ? { timeZone } : {}),
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  };

  return {
    date: new Intl.DateTimeFormat(undefined, dateOptions)
      .format(now)
      .replaceAll(",", "")
      .toUpperCase(),
    time: new Intl.DateTimeFormat(undefined, timeOptions).format(now),
  };
}

function formatTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function compactNumber(value: number) {
  return String(value).padStart(value > 99 ? 3 : 2, "0");
}

export default function Home() {
  const [entered, setEntered] = useState(
    () => typeof window !== "undefined" && wasRoomPending(),
  );
  const [gateReady, setGateReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("CONNECTING TO SPOTIFY");
  const [selectedArtist, setSelectedArtist] = useState<ArtistKey>(() => {
    if (typeof window === "undefined") return "artbat";
    const saved = sessionStorage.getItem("mehak_spotify_selected_artist");
    return saved === "solomun" ? "solomun" : "artbat";
  });
  const [catalogs, setCatalogs] = useState<
    Partial<Record<ArtistKey, CatalogTrack[]>>
  >({});
  const [catalogProgress, setCatalogProgress] = useState<
    Partial<Record<ArtistKey, string>>
  >({});
  const [artistProgress, setArtistProgress] = useState<
    Partial<Record<ArtistKey, number>>
  >({});
  const [partyProgress, setPartyProgress] = useState(0);
  const [partyOverlayDismissed, setPartyOverlayDismissed] = useState(false);
  const [autoLaunchAttempted, setAutoLaunchAttempted] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [laserBurst, setLaserBurst] = useState(0);
  const [timeZone, setTimeZone] = useState<string>();
  const [clock, setClock] = useState({ date: "SYNCING DATE", time: "--:--:--" });
  const [weather, setWeather] = useState<WeatherState>({
    label: "LOCAL WEATHER",
  });

  const experienceRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef("");
  const catalogsRef = useRef(catalogs);
  const activeArtistRef = useRef<ArtistKey>(selectedArtist);
  const playingArtistRef = useRef<ArtistKey>(selectedArtist);
  const queueEndRef = useRef(-1);
  const loadingCatalogsRef = useRef(new Set<ArtistKey>());
  const weatherRequestedRef = useRef(false);
  const progressAnchorRef = useRef({ at: 0, position: 0 });
  const durationRef = useRef(0);
  const previousStateRef = useRef<SpotifyWebPlaybackState | null>(null);
  const autoAdvanceRef = useRef(false);
  const autoPartyLaunchRef = useRef(false);
  const scratchAudioRef = useRef<ScratchAudio | null>(null);
  const scratchGestureRef = useRef<ScratchGesture>({
    active: false,
    centerX: 0,
    centerY: 0,
    lastAngle: 0,
    lastTime: 0,
    pointerId: -1,
    rotation: 0,
    wasPlaying: false,
  });
  const playAtRef = useRef<
    ((index: number, artist?: ArtistKey) => Promise<void>) | null
  >(null);

  const artist = useMemo(
    () => SPOTIFY_ARTISTS.find((item) => item.key === selectedArtist)!,
    [selectedArtist],
  );
  const activeCatalog = catalogs[selectedArtist] ?? [];
  const track = activeCatalog[currentTrack];
  const artbatPartyProgress = artistProgress.artbat ?? 0;
  const solomunPartyProgress = artistProgress.solomun ?? 0;
  const allCatalogsReady = SPOTIFY_ARTISTS.every(
    (item) => Boolean(catalogs[item.key]?.length),
  );
  const partyTarget = authenticated
    ? allCatalogsReady && playerReady
      ? 100
      : Math.min(
          99,
          Math.max(
            2,
            Math.round(
              artbatPartyProgress * 0.45 +
                solomunPartyProgress * 0.45 +
                (playerReady ? 10 : 0),
            ),
          ),
        )
    : 0;

  useEffect(() => {
    const gateTimer = window.setTimeout(() => setGateReady(true), 520);
    if (wasRoomPending()) {
      clearPendingRoom();
    }

    void completeSpotifyAuthorization()
      .then((connected) => {
        setAuthenticated(connected);
        setPlayerMessage(
          connected ? "LOADING FULL ARTIST ARCHIVES" : "CONNECT PREMIUM SPOTIFY",
        );
      })
      .catch((error: unknown) => {
        setAuthenticated(false);
        setPlayerMessage(
          error instanceof Error ? error.message.toUpperCase() : "SPOTIFY LOGIN FAILED",
        );
      })
      .finally(() => setAuthChecking(false));

    return () => window.clearTimeout(gateTimer);
  }, []);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(timeZone));
    updateClock();
    const clockTimer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(clockTimer);
  }, [timeZone]);

  const requestWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setWeather({ label: "WEATHER UNAVAILABLE" });
      return;
    }

    setWeather({ label: "READING LOCAL SKY" });
    weatherRequestedRef.current = true;

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

          const data = (await response.json()) as {
            current?: { temperature_2m?: number; weather_code?: number };
            current_units?: { temperature_2m?: string };
            timezone?: string;
          };
          const code = data.current?.weather_code;
          setWeather({
            label:
              typeof code === "number"
                ? (WEATHER_LABELS[code] ?? "LOCAL CONDITIONS")
                : "LOCAL CONDITIONS",
            temperature: data.current?.temperature_2m,
            unit: data.current_units?.temperature_2m ?? "°C",
          });
          if (data.timezone) setTimeZone(data.timezone);
        } catch {
          setWeather({ label: "WEATHER OFFLINE" });
        }
      },
      () => setWeather({ label: "TAP TO ENABLE WEATHER" }),
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (!entered) return;
    void videoRef.current?.play();
    if (!weatherRequestedRef.current) requestWeather();
  }, [entered, requestWeather]);

  useEffect(() => {
    if (!entered || !authenticated || partyOverlayDismissed) return;

    const progressTimer = window.setInterval(() => {
      setPartyProgress((current) => {
        if (current >= partyTarget) return current;
        return Math.min(
          partyTarget,
          current + Math.max(1, Math.ceil((partyTarget - current) / 10)),
        );
      });
    }, 54);

    return () => window.clearInterval(progressTimer);
  }, [authenticated, entered, partyOverlayDismissed, partyTarget]);

  useEffect(
    () => () => {
      const audio = scratchAudioRef.current;
      scratchAudioRef.current = null;
      if (!audio) return;
      try {
        audio.source.stop();
        audio.oscillator.stop();
      } catch {
        // Nodes may already be stopped by the gesture release handler.
      }
      void audio.context.close();
    },
    [],
  );

  const ensureCatalog = useCallback(async (key: ArtistKey) => {
    const existing = catalogsRef.current[key];
    if (existing?.length) return existing;
    if (loadingCatalogsRef.current.has(key)) return null;

    const selected = SPOTIFY_ARTISTS.find((item) => item.key === key)!;
    loadingCatalogsRef.current.add(key);
    setCatalogProgress((progress) => ({
      ...progress,
      [key]: `SCANNING ${selected.name} RELEASES`,
    }));
    setArtistProgress((progress) => ({ ...progress, [key]: 1 }));

    try {
      const loaded = await fetchArtistCatalog(selected, (scan) => {
        setArtistProgress((progress) => ({
          ...progress,
          [key]: Math.max(progress[key] ?? 0, scan.percent),
        }));
        setCatalogProgress((progress) => ({
          ...progress,
          [key]:
            scan.phase === "cache"
              ? "ARCHIVE RESTORED"
              : scan.phase === "releases"
                ? `FINDING RELEASES ${compactNumber(scan.completed)}/${compactNumber(scan.total)}`
                : `CUTTING VINYL ${compactNumber(scan.completed)}/${compactNumber(scan.total)}`,
        }));
      });
      const nextCatalogs = { ...catalogsRef.current, [key]: loaded };
      catalogsRef.current = nextCatalogs;
      setCatalogs(nextCatalogs);
      setCatalogProgress((progress) => ({
        ...progress,
        [key]: `${loaded.length} TRACKS READY`,
      }));
      setArtistProgress((progress) => ({ ...progress, [key]: 100 }));
      if (activeArtistRef.current === key) {
        setPlayerMessage(
          playerRef.current
            ? `${loaded.length} TRACKS · PRESS PLAY`
            : `${loaded.length} TRACKS · STARTING PLAYER`,
        );
      }
      return loaded;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toUpperCase() : "CATALOG OFFLINE";
      setCatalogProgress((progress) => ({ ...progress, [key]: message }));
      setPlayerMessage(message);
      if (/SESSION|CONNECT/.test(message)) {
        setAuthenticated(false);
        setPlayerReady(false);
      }
      return null;
    } finally {
      loadingCatalogsRef.current.delete(key);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    void Promise.all(
      SPOTIFY_ARTISTS.map((item) => ensureCatalog(item.key)),
    );
  }, [authenticated, ensureCatalog]);

  useEffect(() => {
    if (!authenticated) return;
    let disposed = false;

    void loadSpotifySdk()
      .then((sdk) => {
        if (disposed) return;
        const player = new sdk.Player({
          name: "MAC's Private Listening Room",
          enableMediaSession: true,
          volume: 0.82,
          getOAuthToken: (callback) => {
            void getSpotifyAccessToken()
              .then(callback)
              .catch(() => {
                clearSpotifySession();
                setAuthenticated(false);
                setPlayerReady(false);
                setPlayerMessage("SESSION EXPIRED · CONNECT AGAIN");
              });
          },
        });

        playerRef.current = player;

        player.addListener("ready", (payload) => {
          const deviceId = (payload as { device_id?: string })?.device_id;
          if (!deviceId || disposed) return;
          deviceIdRef.current = deviceId;
          setPlayerReady(true);
          const count = catalogsRef.current[activeArtistRef.current]?.length ?? 0;
          setPlayerMessage(
            count ? `${count} TRACKS · PRESS PLAY` : "PLAYER READY · BUILDING ARCHIVE",
          );
        });

        player.addListener("not_ready", () => {
          if (disposed) return;
          setPlayerReady(false);
          setSpotifyPlaying(false);
          setPlayerMessage("PLAYER RECONNECTING");
        });

        player.addListener("player_state_changed", (payload) => {
          if (disposed || !payload) return;
          const state = payload as SpotifyWebPlaybackState;
          const playingArtist = playingArtistRef.current;
          const catalog = catalogsRef.current[playingArtist] ?? [];
          const index = catalog.findIndex(
            (item) => item.uri === state.track_window.current_track.uri,
          );

          if (index >= 0 && activeArtistRef.current === playingArtist) {
            setCurrentTrack(index);
            setDurationMs(state.duration);
            durationRef.current = state.duration;
            setProgressMs(state.position);
            progressAnchorRef.current = {
              at: performance.now(),
              position: state.position,
            };
            setSpotifyPlaying(!state.paused);
            setPlayerMessage(
              state.paused
                ? `${catalog.length} TRACKS · PAUSED`
                : `${catalog.length} TRACKS · PLAYING IN ORDER`,
            );

            const previous = previousStateRef.current;
            const endedBatch =
              state.paused &&
              index === queueEndRef.current &&
              index < catalog.length - 1 &&
              previous?.track_window.current_track.uri ===
                state.track_window.current_track.uri &&
              previous.position > Math.max(0, previous.duration - 1800);

            if (endedBatch && !autoAdvanceRef.current) {
              autoAdvanceRef.current = true;
              window.setTimeout(() => {
                void playAtRef.current?.(index + 1, playingArtist).finally(() => {
                  autoAdvanceRef.current = false;
                });
              }, 120);
            }
          }

          previousStateRef.current = state;
        });

        player.addListener("autoplay_failed", () => {
          setSpotifyPlaying(false);
          setPlayerMessage("PRESS PLAY TO START THE ROOM");
        });

        player.addListener("account_error", () => {
          setSpotifyPlaying(false);
          setPlayerReady(false);
          setPlayerMessage("SPOTIFY PREMIUM IS REQUIRED");
        });

        player.addListener("authentication_error", () => {
          clearSpotifySession();
          setAuthenticated(false);
          setPlayerReady(false);
          setSpotifyPlaying(false);
          setPlayerMessage("SESSION EXPIRED · CONNECT AGAIN");
        });

        player.addListener("initialization_error", () => {
          setPlayerReady(false);
          setPlayerMessage("THIS BROWSER CANNOT START SPOTIFY");
        });

        player.addListener("playback_error", (payload) => {
          const message = (payload as { message?: string })?.message;
          setSpotifyPlaying(false);
          setPlayerMessage((message ?? "PLAYBACK NEEDS ANOTHER TAP").toUpperCase());
        });

        return player.connect();
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setPlayerReady(false);
        setPlayerMessage(
          error instanceof Error ? error.message.toUpperCase() : "PLAYER OFFLINE",
        );
      });

    return () => {
      disposed = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
      deviceIdRef.current = "";
      setPlayerReady(false);
    };
  }, [authenticated]);

  useEffect(() => {
    const ticker = window.setInterval(() => {
      if (!spotifyPlaying) return;
      const elapsed = performance.now() - progressAnchorRef.current.at;
      setProgressMs(
        Math.min(
          durationRef.current,
          progressAnchorRef.current.position + elapsed,
        ),
      );
    }, 250);
    return () => window.clearInterval(ticker);
  }, [spotifyPlaying]);

  const playQueueAt = useCallback(
    async (requestedIndex: number, requestedArtist?: ArtistKey) => {
      const key = requestedArtist ?? activeArtistRef.current;
      let catalog = catalogsRef.current[key];

      if (!authenticated) {
        await beginSpotifyAuthorization(key);
        return;
      }
      if (!catalog?.length) {
        catalog = (await ensureCatalog(key)) ?? undefined;
      }
      if (!catalog?.length) return;
      if (!playerRef.current || !deviceIdRef.current) {
        setPlayerMessage("PLAYER IS STILL WARMING UP");
        return;
      }

      const index = (requestedIndex + catalog.length) % catalog.length;
      const batch = catalog.slice(index, index + PLAYBACK_BATCH_SIZE);
      const deviceId = deviceIdRef.current;
      const player = playerRef.current;

      try {
        await player.activateElement();
        setPlayerMessage("DROPPING THE NEEDLE");
        playingArtistRef.current = key;
        queueEndRef.current = index + batch.length - 1;
        setCurrentTrack(index);
        setProgressMs(0);
        setDurationMs(catalog[index].durationMs);
        durationRef.current = catalog[index].durationMs;

        await spotifyApi<void>(
          `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              position_ms: 0,
              uris: batch.map((item) => item.uri),
            }),
          },
        );

        void Promise.allSettled([
          spotifyApi<void>(
            `https://api.spotify.com/v1/me/player/shuffle?state=false&device_id=${encodeURIComponent(deviceId)}`,
            { method: "PUT" },
          ),
          spotifyApi<void>(
            `https://api.spotify.com/v1/me/player/repeat?state=off&device_id=${encodeURIComponent(deviceId)}`,
            { method: "PUT" },
          ),
        ]);
      } catch (error) {
        setSpotifyPlaying(false);
        setPlayerMessage(
          error instanceof Error
            ? error.message.toUpperCase()
            : "PLAYBACK NEEDS ANOTHER TAP",
        );
      }
    },
    [authenticated, ensureCatalog],
  );

  useEffect(() => {
    playAtRef.current = playQueueAt;
  }, [playQueueAt]);

  useEffect(() => {
    if (
      !entered ||
      !authenticated ||
      !playerReady ||
      !allCatalogsReady ||
      partyProgress < 100 ||
      autoPartyLaunchRef.current
    ) {
      return;
    }

    autoPartyLaunchRef.current = true;
    setAutoLaunchAttempted(true);
    setPlayerMessage("100% · DROPPING THE NEEDLE");
    const launchTimer = window.setTimeout(() => {
      void playAtRef.current?.(0, activeArtistRef.current);
    }, 520);

    return () => window.clearTimeout(launchTimer);
  }, [
    allCatalogsReady,
    authenticated,
    entered,
    partyProgress,
    playerReady,
  ]);

  useEffect(() => {
    if (!spotifyPlaying || partyProgress < 100) return;
    const dismissTimer = window.setTimeout(
      () => setPartyOverlayDismissed(true),
      1100,
    );
    return () => window.clearTimeout(dismissTimer);
  }, [partyProgress, spotifyPlaying]);

  const togglePlayback = async () => {
    if (!authenticated) {
      await beginSpotifyAuthorization(selectedArtist);
      return;
    }
    if (!playerReady || !playerRef.current) {
      setPlayerMessage("PLAYER IS STILL WARMING UP");
      return;
    }

    await playerRef.current.activateElement();
    if (spotifyPlaying) {
      await playerRef.current.pause();
      setSpotifyPlaying(false);
      return;
    }

    if (
      playingArtistRef.current === selectedArtist &&
      previousStateRef.current?.track_window.current_track.uri === track?.uri
    ) {
      await playerRef.current.resume();
    } else {
      await playQueueAt(currentTrack, selectedArtist);
    }
  };

  const selectArtist = (key: ArtistKey) => {
    if (key === selectedArtist) return;
    void playerRef.current?.pause();
    setSpotifyPlaying(false);
    setSelectedArtist(key);
    activeArtistRef.current = key;
    sessionStorage.setItem("mehak_spotify_selected_artist", key);
    setCurrentTrack(0);
    setProgressMs(0);
    setDurationMs(catalogsRef.current[key]?.[0]?.durationMs ?? 0);
    durationRef.current = catalogsRef.current[key]?.[0]?.durationMs ?? 0;
    previousStateRef.current = null;
    const count = catalogsRef.current[key]?.length ?? 0;
    setPlayerMessage(
      count ? `${count} TRACKS · PRESS PLAY` : `BUILDING ${key.toUpperCase()} ARCHIVE`,
    );
    if (authenticated) void ensureCatalog(key);
  };

  const enterExperience = async () => {
    setEntered(true);
    void videoRef.current?.play();
    if (!weatherRequestedRef.current) requestWeather();

    if (!authenticated && !authChecking) {
      await beginSpotifyAuthorization(selectedArtist);
      return;
    }
    if (authenticated && playerReady && activeCatalog.length) {
      await playQueueAt(currentTrack, selectedArtist);
    }
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
    setLaserBurst((burst) => burst + 1);
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

    const audio = {
      context,
      filter,
      gain,
      oscillator,
      oscillatorGain,
      source,
    };
    scratchAudioRef.current = audio;
    return audio;
  };

  const driveScratchSound = (angleDelta: number, elapsed: number) => {
    const audio = scratchAudioRef.current;
    if (!audio) return;

    const velocity = Math.abs(angleDelta) / Math.max(8, elapsed);
    const intensity = Math.min(1, velocity * 2.7);
    const directionTone = angleDelta < 0 ? 0.78 : 1.16;
    const now = audio.context.currentTime;
    const peak = 0.018 + intensity * 0.15;

    audio.gain.gain.cancelScheduledValues(now);
    audio.gain.gain.setValueAtTime(
      Math.max(0.0001, audio.gain.gain.value),
      now,
    );
    audio.gain.gain.linearRampToValueAtTime(peak, now + 0.012);
    audio.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    audio.oscillatorGain.gain.cancelScheduledValues(now);
    audio.oscillatorGain.gain.setValueAtTime(
      Math.max(0.0001, audio.oscillatorGain.gain.value),
      now,
    );
    audio.oscillatorGain.gain.linearRampToValueAtTime(
      0.004 + intensity * 0.028,
      now + 0.01,
    );
    audio.oscillatorGain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.095,
    );
    audio.filter.frequency.setTargetAtTime(
      620 + intensity * 4200,
      now,
      0.012,
    );
    audio.source.playbackRate.setTargetAtTime(
      (0.42 + intensity * 2.35) * directionTone,
      now,
      0.01,
    );
    audio.oscillator.frequency.setTargetAtTime(
      (120 + intensity * 760) * directionTone,
      now,
      0.012,
    );
  };

  const stopScratchAudio = () => {
    const audio = scratchAudioRef.current;
    scratchAudioRef.current = null;
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

  const startVinylScratch = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!("AudioContext" in window) || scratchGestureRef.current.active) return;
    event.preventDefault();
    event.stopPropagation();

    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const angle = Math.atan2(
      event.clientY - centerY,
      event.clientX - centerX,
    );

    event.currentTarget.setPointerCapture(event.pointerId);
    scratchGestureRef.current = {
      ...scratchGestureRef.current,
      active: true,
      centerX,
      centerY,
      lastAngle: angle,
      lastTime: performance.now(),
      pointerId: event.pointerId,
      wasPlaying: spotifyPlaying,
    };
    setIsScratching(true);
    startScratchAudio();

    if (spotifyPlaying) {
      void playerRef.current?.pause();
      setSpotifyPlaying(false);
    }
  };

  const moveVinylScratch = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = scratchGestureRef.current;
    if (!gesture.active || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const angle = Math.atan2(
      event.clientY - gesture.centerY,
      event.clientX - gesture.centerX,
    );
    let delta = ((angle - gesture.lastAngle) * 180) / Math.PI;
    delta = ((delta + 540) % 360) - 180;
    const now = performance.now();

    gesture.rotation += delta;
    gesture.lastAngle = angle;
    driveScratchSound(delta, now - gesture.lastTime);
    gesture.lastTime = now;
    recordRef.current?.style.setProperty(
      "--scratch-angle",
      `${gesture.rotation}deg`,
    );
  };

  const finishVinylScratch = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = scratchGestureRef.current;
    if (!gesture.active || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gesture.active = false;
    setIsScratching(false);
    stopScratchAudio();

    if (gesture.wasPlaying) {
      void playerRef.current?.resume().catch(() => {
        setPlayerMessage("PRESS PLAY TO RESUME THE ROOM");
      });
    }
  };

  const nudgeVinyl = (direction: -1 | 1) => {
    if (!("AudioContext" in window) || scratchGestureRef.current.active) return;
    const gesture = scratchGestureRef.current;
    gesture.active = true;
    gesture.wasPlaying = spotifyPlaying;
    gesture.rotation += direction * 42;
    recordRef.current?.style.setProperty(
      "--scratch-angle",
      `${gesture.rotation}deg`,
    );
    setIsScratching(true);
    startScratchAudio();
    driveScratchSound(direction * 42, 45);
    if (spotifyPlaying) {
      void playerRef.current?.pause();
      setSpotifyPlaying(false);
    }
    window.setTimeout(() => {
      gesture.active = false;
      setIsScratching(false);
      stopScratchAudio();
      if (gesture.wasPlaying) void playerRef.current?.resume();
    }, 150);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || !experienceRef.current) return;
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    experienceRef.current.style.setProperty("--tilt-x", `${y * -2.2}deg`);
    experienceRef.current.style.setProperty("--tilt-y", `${x * 2.8}deg`);
    experienceRef.current.style.setProperty("--shift-x", `${x * -18}px`);
    experienceRef.current.style.setProperty("--shift-y", `${y * -14}px`);
    experienceRef.current.style.setProperty("--hero-x", `${x * 9}px`);
    experienceRef.current.style.setProperty("--hero-y", `${y * 7}px`);
    experienceRef.current.style.setProperty("--hero-x-reverse", `${x * -5}px`);
    experienceRef.current.style.setProperty("--hero-y-reverse", `${y * -4}px`);
    experienceRef.current.style.setProperty("--hero-x-soft", `${x * 3}px`);
    experienceRef.current.style.setProperty("--hero-y-soft", `${y * 2}px`);
    experienceRef.current.style.setProperty("--pointer-x", `${event.clientX}px`);
    experienceRef.current.style.setProperty("--pointer-y", `${event.clientY}px`);
  };

  const resetPerspective = () => {
    if (!experienceRef.current) return;
    experienceRef.current.style.setProperty("--tilt-x", "0deg");
    experienceRef.current.style.setProperty("--tilt-y", "0deg");
    experienceRef.current.style.setProperty("--shift-x", "0px");
    experienceRef.current.style.setProperty("--shift-y", "0px");
    experienceRef.current.style.setProperty("--hero-x", "0px");
    experienceRef.current.style.setProperty("--hero-y", "0px");
    experienceRef.current.style.setProperty("--hero-x-reverse", "0px");
    experienceRef.current.style.setProperty("--hero-y-reverse", "0px");
    experienceRef.current.style.setProperty("--hero-x-soft", "0px");
    experienceRef.current.style.setProperty("--hero-y-soft", "0px");
  };

  const progress = Math.min(100, (progressMs / Math.max(1, durationMs)) * 100);
  const weatherText =
    typeof weather.temperature === "number"
      ? `${Math.round(weather.temperature)}${weather.unit ?? "°C"} ${weather.label}`
      : weather.label;
  const statusText = authChecking
    ? "CHECKING SPOTIFY"
    : !authenticated
      ? playerMessage
      : catalogProgress[selectedArtist] ?? playerMessage;
  const autoplayNeedsTap =
    autoLaunchAttempted &&
    /PRESS PLAY|ANOTHER TAP|AUTOPLAY/.test(playerMessage.toUpperCase());
  const partyLabel =
    partyProgress < 100
      ? "COUNTDOWN TO THE PARTY"
      : spotifyPlaying
        ? "PARTY ONLINE"
        : autoplayNeedsTap
          ? "TAP JUKEBOX PLAY TO DROP THE NEEDLE"
          : "DROPPING THE NEEDLE";
  const showPartyCountdown =
    entered && authenticated && !partyOverlayDismissed;
  const displayTitle = track?.title ?? `${artist.name} FULL ARCHIVE`;
  const displayArtist = track?.artists ?? "ALL UNIQUE CREDITED TRACKS";
  const displayAlbum = track
    ? `${track.album} · ${track.releaseDate.slice(0, 4)}`
    : "OLDEST TO NEWEST · FULL-LENGTH PLAYBACK";
  const playbackEnabled = !authChecking && (!authenticated || playerReady);

  return (
    <main
      ref={experienceRef}
      className={`experience${entered ? " is-live" : ""}${
        spotifyPlaying ? " is-playing" : ""
      }`}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPerspective}
    >
      <div className="visual-stage" aria-hidden="true">
        <video
          ref={videoRef}
          className="spiral-video"
          muted
          loop
          playsInline
          preload="auto"
          poster="/spiral-poster.jpg"
        >
          <source src="/spiral.mp4" type="video/mp4" />
        </video>
        <div className="projection-wash" />
      </div>

      <div className="ambient-beam ambient-beam-one" aria-hidden="true" />
      <div className="ambient-beam ambient-beam-two" aria-hidden="true" />

      {laserBurst > 0 ? (
        <div className="laser-show" key={laserBurst} aria-hidden="true">
          <div className="laser-flash" />
          {LASER_BEAMS.map(([left, angle, delay, color, length], index) => (
            <span
              className="laser-shot"
              key={`${laserBurst}-${index}`}
              style={
                {
                  "--laser-angle": angle,
                  "--laser-color": color,
                  "--laser-delay": delay,
                  "--laser-left": left,
                  "--laser-length": length,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div className="scanlines" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="cursor-light" aria-hidden="true" />

      <header className="topbar">
        <p className="room-name">
          <span className="room-monogram">M</span>
          MAC&apos;S PRIVATE LISTENING ROOM
        </p>

        <button
          className="environment-strip"
          type="button"
          onClick={requestWeather}
          aria-label="Refresh local date, time and weather"
        >
          <span>{clock.date}</span>
          <strong>{clock.time}</strong>
          <span className="weather-copy">{weatherText}</span>
        </button>

        <p className="signal-label">
          <span className={spotifyPlaying ? "signal is-playing" : "signal"} />
          {spotifyPlaying
            ? "JUKEBOX LIVE"
            : playerReady
              ? "ROOM READY"
              : authenticated
                ? "TUNING IN"
                : "SPOTIFY LOGIN"}
        </p>
      </header>

      {showPartyCountdown ? (
        <div
          className={`party-countdown${partyProgress >= 100 ? " is-ready" : ""}`}
          role="status"
          aria-live="polite"
        >
          <div className="party-countdown-topline">
            <span>{partyLabel}</span>
            <strong>
              {partyProgress}
              <small>%</small>
            </strong>
          </div>
          <div className="party-countdown-rail" aria-hidden="true">
            <span style={{ width: `${partyProgress}%` }} />
          </div>
          <div className="party-countdown-sources" aria-hidden="true">
            <span>ARTBAT {Math.round(artbatPartyProgress)}%</span>
            <span className={playerReady ? "is-ready" : ""}>
              DECK {playerReady ? "READY" : "WARMING"}
            </span>
            <span>SOLOMUN {Math.round(solomunPartyProgress)}%</span>
          </div>
        </div>
      ) : null}

      <div className="content-grid">
        <section className="title-block" aria-labelledby="main-title">
          <p className="eyebrow">
            <span aria-hidden="true" />
            YOUR TASTE DESERVED SOMETHING SPECIAL
          </p>

          <h1 id="main-title" className="kinetic-title">
            <span className="title-line title-mehak" data-echo="MEHAK'S">
              MEHAK&apos;S
            </span>
            <span className="title-line title-private" data-echo="PRIVATE">
              PRIVATE
            </span>
            <span className="title-line title-frequency" data-echo="FREQUENCY">
              FREQUENCY
            </span>
          </h1>

          <div className="hero-actions">
            <button className="laser-button" type="button" onClick={shootLasers}>
              <span className="laser-button-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              SHOOT LASERS
              <span className="rgb-tag">RGB</span>
            </button>
            <p>MOVE YOUR CURSOR · TURN IT UP · STAY AWHILE</p>
          </div>
        </section>

        <section className="jukebox" aria-label="Mehak's techno jukebox">
          <div className="jukebox-header">
            <div>
              <span>MEHAK&apos;S JUKEBOX</span>
              <p>COMPLETE ARTIST ARCHIVES · PLAYED WITH SPOTIFY</p>
            </div>
            <span className="track-count" aria-label="Current track and total tracks">
              {activeCatalog.length ? compactNumber(currentTrack + 1) : "--"}
              <i>/</i>
              {activeCatalog.length ? compactNumber(activeCatalog.length) : "--"}
            </span>
          </div>

          <div className="artist-switcher" role="tablist" aria-label="Choose artist archive">
            {SPOTIFY_ARTISTS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selectedArtist === item.key}
                className={selectedArtist === item.key ? "is-active" : ""}
                onClick={() => selectArtist(item.key)}
              >
                <span>{item.name}</span>
                <small>
                  {catalogs[item.key]?.length
                    ? `${catalogs[item.key]!.length} TRACKS`
                    : authenticated
                      ? "LOADING"
                      : "CONNECT"}
                </small>
              </button>
            ))}
          </div>

          <div className="jukebox-body">
            <div
              className={isScratching ? "record-bay is-scratching" : "record-bay"}
              role="application"
              tabIndex={0}
              aria-label="Interactive vinyl. Touch and drag to scratch, or use the left and right arrow keys."
              onPointerDown={startVinylScratch}
              onPointerMove={moveVinylScratch}
              onPointerUp={finishVinylScratch}
              onPointerCancel={finishVinylScratch}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                nudgeVinyl(event.key === "ArrowLeft" ? -1 : 1);
              }}
            >
              <div
                ref={recordRef}
                className={`record${spotifyPlaying ? " is-spinning" : ""}${
                  isScratching ? " is-scratching" : ""
                }`}
              >
                <span className="record-groove groove-one" />
                <span className="record-groove groove-two" />
                <span className="record-label">{artist.name.slice(0, 1)}</span>
              </div>
              <div
                className={`tonearm${spotifyPlaying ? " is-playing" : ""}${
                  isScratching ? " is-scratching" : ""
                }`}
                aria-hidden="true"
              >
                <span />
              </div>
              <span className="scratch-hint" aria-hidden="true">
                DRAG TO SCRATCH
              </span>
            </div>

            <div className="track-readout" aria-live="polite">
              <span className="now-playing-label">
                {spotifyPlaying
                  ? "NOW SPINNING · FULL TRACK"
                  : !authenticated
                    ? "PREMIUM PLAYER · LOGIN ONCE"
                    : activeCatalog.length
                      ? "READY · COMPLETE CATALOG"
                      : "BUILDING THE ARCHIVE"}
              </span>
              {track ? (
                <h2>
                  <a href={track.spotifyUrl} target="_blank" rel="noreferrer">
                    {displayTitle}
                  </a>
                </h2>
              ) : (
                <h2>{displayTitle}</h2>
              )}
              <p title={`${displayArtist} · ${displayAlbum}`}>
                {displayArtist} <span>·</span> {displayAlbum}
              </p>

              <div className="progress-rail" aria-label="Track progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="time-row">
                <span>{formatTime(progressMs)}</span>
                <span>{formatTime(durationMs || track?.durationMs || 0)}</span>
              </div>

              <div className={spotifyPlaying ? "equalizer is-moving" : "equalizer"}>
                {Array.from({ length: 14 }, (_, index) => (
                  <i
                    key={index}
                    style={
                      { "--bar-delay": `${index * -57}ms` } as CSSProperties
                    }
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="jukebox-controls">
            <button
              type="button"
              className="skip-button"
              onClick={() => void playQueueAt(currentTrack - 1, selectedArtist)}
              disabled={!playerReady || !activeCatalog.length}
              aria-label="Previous jukebox track"
            >
              <span className="skip-glyph is-previous" aria-hidden="true">
                <i />
                <b />
              </span>
              <small>PREV</small>
            </button>

            <button
              type="button"
              className={`playback-button${!authenticated ? " needs-login" : ""}`}
              onClick={() => void togglePlayback()}
              disabled={!playbackEnabled}
              aria-label={
                !authenticated
                  ? "Connect Spotify Premium"
                  : spotifyPlaying
                    ? "Pause jukebox"
                    : "Play jukebox"
              }
            >
              <span
                className={spotifyPlaying ? "pause-glyph" : "play-glyph"}
                aria-hidden="true"
              >
                <i />
                <i />
              </span>
            </button>

            <button
              type="button"
              className="skip-button"
              onClick={() => void playQueueAt(currentTrack + 1, selectedArtist)}
              disabled={!playerReady || !activeCatalog.length}
              aria-label="Next jukebox track"
            >
              <span className="skip-glyph is-next" aria-hidden="true">
                <i />
                <b />
              </span>
              <small>NEXT</small>
            </button>
          </div>

          <div className="jukebox-footer">
            <span title={statusText}>
              <i
                className={
                  playerReady && activeCatalog.length
                    ? "online-dot"
                    : "online-dot is-waiting"
                }
              />
              <span className="jukebox-status">{statusText}</span>
            </span>
            <a
              className="spotify-attribution"
              href={track?.spotifyUrl ?? artist.url}
              target="_blank"
              rel="noreferrer"
            >
              <span
                className="spotify-mark"
                style={{ backgroundImage: `url(${SPOTIFY_MARK})` }}
                aria-hidden="true"
              />
              PLAY ON SPOTIFY <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>

      <div className={`entry-gate${entered ? " is-open" : ""}`}>
        <p className="gate-label">MAC&apos;S PRIVATE LISTENING ROOM</p>
        <div className="gate-frequency" aria-hidden="true">
          130.00 <span>FM</span>
        </div>
        <button
          className={`enter-button${gateReady ? " is-ready" : ""}`}
          type="button"
          onClick={() => void enterExperience()}
          disabled={!gateReady || authChecking}
          aria-busy={!gateReady || authChecking}
          aria-label="Enter Mehak's room and play the techno jukebox"
        >
          <span className="button-orbit" aria-hidden="true" />
          <span className="play-mark" aria-hidden="true" />
          <span className="play-word">PLAY</span>
        </button>
        <p className="gate-note">
          {authenticated ? "ONE CLICK OPENS THE ROOM" : "PLAY OPENS THE ROOM"}
          <span aria-hidden="true"> · </span>
          {authenticated ? "SOUND ON" : "PREMIUM SPOTIFY"}
        </p>
      </div>
    </main>
  );
}
