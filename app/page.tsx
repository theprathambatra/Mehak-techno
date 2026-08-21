"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";

const PLAYLIST_URL =
  "https://open.spotify.com/playlist/18vUeZ9BdtMRNV6gI8RnR6";

const JUKEBOX_TRACKS = [
  {
    title: "Vois sur ton chemin",
    mix: "Techno Mix",
    artist: "BENNETT",
    uri: "spotify:track:31nfdEooLEq7dn3UMcIeB5",
    duration: 178,
  },
  {
    title: "Bla Bla Bla",
    mix: "Club Cut",
    artist: "ILYAA",
    uri: "spotify:track:4d8rAz6gWPJ5Vq516k2kac",
    duration: 118,
  },
  {
    title: "Push Up",
    mix: "Main Edit",
    artist: "CREEDS",
    uri: "spotify:track:3AjSfp5FDvwtMU9XBsbS8j",
    duration: 139,
  },
  {
    title: "Rockafeller Skank",
    mix: "Rave Edit",
    artist: "ILYAA",
    uri: "spotify:track:2CeMzUrbykkE7QWA3qlXvx",
    duration: 145,
  },
  {
    title: "Thank You (Not So Bad)",
    mix: "Techno Cut",
    artist: "DIMITRI VEGAS · TIËSTO · DIDO · W&W",
    uri: "spotify:track:09CnYHiZ5jGT1wr1TXJ9Zt",
    duration: 140,
  },
  {
    title: "Self Aware",
    mix: "2026 Mix",
    artist: "ILYAA · ROBBE · DIVERZION",
    uri: "spotify:track:1zgmIvxibz0QHVDq19zqSR",
    duration: 144,
  },
] as const;

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

type SpotifyEvent = {
  data?: {
    duration?: number;
    isPaused?: boolean;
    playingURI?: string;
    position?: number;
  };
};

type SpotifyController = {
  addListener: (event: string, callback: (event: SpotifyEvent) => void) => void;
  destroy?: () => void;
  loadEntity: (spotifyUriOrUrl: string) => void;
  pause: () => void;
  play: () => void;
  resume: () => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { height: number; uri: string; width: string },
    callback: (controller: SpotifyController) => void,
  ) => void;
};

type WeatherState = {
  label: string;
  temperature?: number;
  unit?: string;
};

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

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [embedFallback, setEmbedFallback] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(
    JUKEBOX_TRACKS[0].duration * 1000,
  );
  const [laserBurst, setLaserBurst] = useState(0);
  const [timeZone, setTimeZone] = useState<string>();
  const [clock, setClock] = useState({ date: "SYNCING DATE", time: "--:--:--" });
  const [weather, setWeather] = useState<WeatherState>({
    label: "LOCAL WEATHER",
  });

  const experienceRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const spotifyControllerRef = useRef<SpotifyController | null>(null);
  const requestedPlaybackRef = useRef(false);
  const weatherRequestedRef = useRef(false);

  useEffect(() => {
    const updateClock = () => setClock(formatClock(timeZone));
    updateClock();
    const clockTimer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(clockTimer);
  }, [timeZone]);

  useEffect(() => {
    const gateTimer = window.setTimeout(() => setGateReady(true), 520);
    let active = true;

    const spotifyWindow = window as typeof window & {
      onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    };

    spotifyWindow.onSpotifyIframeApiReady = (IFrameAPI) => {
      const element = document.getElementById("spotify-embed");
      if (!active || !element) return;

      IFrameAPI.createController(
        element,
        {
          width: "100%",
          height: 152,
          uri: JUKEBOX_TRACKS[0].uri,
        },
        (controller) => {
          if (!active) return;
          spotifyControllerRef.current = controller;

          controller.addListener("ready", () => {
            setSpotifyReady(true);
            setEmbedFallback(false);
            if (requestedPlaybackRef.current) controller.play();
          });

          controller.addListener("playback_started", (event) => {
            setSpotifyPlaying(true);
            const activeUri = event.data?.playingURI;
            const trackIndex = JUKEBOX_TRACKS.findIndex(
              (track) => track.uri === activeUri,
            );
            if (trackIndex >= 0) {
              setCurrentTrack(trackIndex);
              setDurationMs(JUKEBOX_TRACKS[trackIndex].duration * 1000);
            }
          });

          controller.addListener("playback_update", (event) => {
            if (typeof event.data?.isPaused === "boolean") {
              setSpotifyPlaying(!event.data.isPaused);
            }
            if (typeof event.data?.position === "number") {
              setProgressMs(event.data.position);
            }
            if (
              typeof event.data?.duration === "number" &&
              event.data.duration > 0
            ) {
              setDurationMs(event.data.duration);
            }
          });
        },
      );
    };

    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.dataset.spotifyApi = "true";
    document.body.appendChild(script);

    const fallbackTimer = window.setTimeout(() => {
      if (!spotifyControllerRef.current) setEmbedFallback(true);
    }, 6500);

    return () => {
      active = false;
      window.clearTimeout(gateTimer);
      window.clearTimeout(fallbackTimer);
      spotifyControllerRef.current?.destroy?.();
      spotifyControllerRef.current = null;
      script.remove();
      delete spotifyWindow.onSpotifyIframeApiReady;
    };
  }, []);

  const requestWeather = () => {
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
  };

  const enterExperience = () => {
    requestedPlaybackRef.current = true;
    setEntered(true);
    void videoRef.current?.play();
    spotifyControllerRef.current?.play();
    if (!weatherRequestedRef.current) requestWeather();
  };

  const togglePlayback = () => {
    const controller = spotifyControllerRef.current;
    if (!controller) return;
    requestedPlaybackRef.current = true;
    if (spotifyPlaying) {
      controller.pause();
      setSpotifyPlaying(false);
    } else {
      controller.resume();
      setSpotifyPlaying(true);
    }
  };

  const loadTrack = (index: number) => {
    const normalizedIndex =
      (index + JUKEBOX_TRACKS.length) % JUKEBOX_TRACKS.length;
    const controller = spotifyControllerRef.current;
    const track = JUKEBOX_TRACKS[normalizedIndex];

    setCurrentTrack(normalizedIndex);
    setProgressMs(0);
    setDurationMs(track.duration * 1000);
    requestedPlaybackRef.current = true;

    if (!controller) return;
    controller.loadEntity(track.uri);
    window.setTimeout(() => controller.play(), 180);
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

  const track = JUKEBOX_TRACKS[currentTrack];
  const progress = Math.min(100, (progressMs / Math.max(1, durationMs)) * 100);
  const weatherText =
    typeof weather.temperature === "number"
      ? `${Math.round(weather.temperature)}${weather.unit ?? "°C"} ${weather.label}`
      : weather.label;

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
            : spotifyReady
              ? "ROOM READY"
              : "TUNING IN"}
        </p>
      </header>

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
              <p>HANDPICKED FROM THE TECHNO PLAYLIST</p>
            </div>
            <span className="track-count">
              {String(currentTrack + 1).padStart(2, "0")}
              <i>/</i>
              {String(JUKEBOX_TRACKS.length).padStart(2, "0")}
            </span>
          </div>

          <div className="jukebox-body">
            <div className="record-bay" aria-hidden="true">
              <div className={spotifyPlaying ? "record is-spinning" : "record"}>
                <span className="record-groove groove-one" />
                <span className="record-groove groove-two" />
                <span className="record-label">M</span>
              </div>
              <div className={spotifyPlaying ? "tonearm is-playing" : "tonearm"}>
                <span />
              </div>
            </div>

            <div className="track-readout" aria-live="polite">
              <span className="now-playing-label">
                {spotifyPlaying ? "NOW SPINNING" : "READY TO SPIN"}
              </span>
              <h2>{track.title}</h2>
              <p>
                {track.artist} <span>·</span> {track.mix}
              </p>

              <div className="progress-rail" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="time-row">
                <span>{formatTime(progressMs)}</span>
                <span>{formatTime(durationMs)}</span>
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
              onClick={() => loadTrack(currentTrack - 1)}
              disabled={!spotifyReady}
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
              className="playback-button"
              onClick={togglePlayback}
              disabled={!spotifyReady}
              aria-label={spotifyPlaying ? "Pause jukebox" : "Play jukebox"}
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
              onClick={() => loadTrack(currentTrack + 1)}
              disabled={!spotifyReady}
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
            <span>
              <i className={spotifyReady ? "online-dot" : "online-dot is-waiting"} />
              {embedFallback
                ? "OPEN SPOTIFY TO LISTEN"
                : spotifyReady
                  ? "JUKEBOX ONLINE"
                  : "TUNING JUKEBOX"}
            </span>
            <a href={PLAYLIST_URL} target="_blank" rel="noreferrer">
              FULL PLAYLIST ON SPOTIFY <span aria-hidden="true">↗</span>
            </a>
          </div>

          <div id="spotify-embed" className="spotify-engine" aria-hidden="true" />
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
          onClick={enterExperience}
          disabled={!gateReady}
          aria-busy={!gateReady}
          aria-label="Play Mehak's techno jukebox and enter"
        >
          <span className="button-orbit" aria-hidden="true" />
          <span className="play-mark" aria-hidden="true" />
          <span className="play-word">PLAY</span>
        </button>
        <p className="gate-note">
          ONE CLICK OPENS THE ROOM <span aria-hidden="true">·</span> SOUND ON
        </p>
      </div>
    </main>
  );
}
