"use client";

import { useEffect, useRef, useState } from "react";

const PLAYLIST_URI = "spotify:playlist:18vUeZ9BdtMRNV6gI8RnR6";
const PLAYLIST_URL =
  "https://open.spotify.com/playlist/18vUeZ9BdtMRNV6gI8RnR6";

type SpotifyEvent = {
  data?: {
    isPaused?: boolean;
  };
};

type SpotifyController = {
  play: () => void;
  addListener: (event: string, callback: (event: SpotifyEvent) => void) => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: { width: string; height: number; uri: string },
    callback: (controller: SpotifyController) => void,
  ) => void;
};

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [spotifyPlaying, setSpotifyPlaying] = useState(false);
  const [embedFallback, setEmbedFallback] = useState(false);
  const experienceRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const spotifyControllerRef = useRef<SpotifyController | null>(null);
  const requestedPlaybackRef = useRef(false);

  useEffect(() => {
    const gateTimer = window.setTimeout(() => setGateReady(true), 420);
    let active = true;

    const spotifyWindow = window as typeof window & {
      onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
    };

    spotifyWindow.onSpotifyIframeApiReady = (IFrameAPI) => {
      const element = document.getElementById("spotify-embed");
      if (!active || !element) return;

      IFrameAPI.createController(
        element,
        { width: "100%", height: 352, uri: PLAYLIST_URI },
        (controller) => {
          if (!active) return;
          spotifyControllerRef.current = controller;

          controller.addListener("ready", () => {
            setSpotifyReady(true);
            setEmbedFallback(false);
            if (requestedPlaybackRef.current) controller.play();
          });

          controller.addListener("playback_started", () => {
            setSpotifyPlaying(true);
          });

          controller.addListener("playback_update", (event) => {
            if (typeof event.data?.isPaused === "boolean") {
              setSpotifyPlaying(!event.data.isPaused);
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
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(gateTimer);
      window.clearTimeout(fallbackTimer);
      script.remove();
      delete spotifyWindow.onSpotifyIframeApiReady;
    };
  }, []);

  const enterExperience = () => {
    requestedPlaybackRef.current = true;
    setEntered(true);
    void videoRef.current?.play();
    spotifyControllerRef.current?.play();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || !experienceRef.current) return;
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    experienceRef.current.style.setProperty("--tilt-x", `${y * -2.2}deg`);
    experienceRef.current.style.setProperty("--tilt-y", `${x * 2.8}deg`);
    experienceRef.current.style.setProperty("--shift-x", `${x * -18}px`);
    experienceRef.current.style.setProperty("--shift-y", `${y * -14}px`);
    experienceRef.current.style.setProperty("--pointer-x", `${event.clientX}px`);
    experienceRef.current.style.setProperty("--pointer-y", `${event.clientY}px`);
  };

  const resetPerspective = () => {
    if (!experienceRef.current) return;
    experienceRef.current.style.setProperty("--tilt-x", "0deg");
    experienceRef.current.style.setProperty("--tilt-y", "0deg");
    experienceRef.current.style.setProperty("--shift-x", "0px");
    experienceRef.current.style.setProperty("--shift-y", "0px");
  };

  return (
    <main
      ref={experienceRef}
      className={`experience${entered ? " is-live" : ""}`}
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

      <div className="light-beam light-beam-one" aria-hidden="true" />
      <div className="light-beam light-beam-two" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="cursor-light" aria-hidden="true" />

      <header className="topbar">
        <p>MEHAK / TECHNO ARCHIVE</p>
        <p className="topbar-center">PRIVATE TRANSMISSION 001</p>
        <p className="signal-label">
          <span className={spotifyPlaying ? "signal is-playing" : "signal"} />
          {spotifyPlaying
            ? "TRANSMITTING"
            : spotifyReady
              ? "SYSTEM READY"
              : "CONNECTING"}
        </p>
      </header>

      <div className="content-grid">
        <section className="title-block" aria-labelledby="main-title">
          <p className="eyebrow">A LOVE LETTER AT 130 BPM</p>
          <h1 id="main-title">
            <span>BUILT FOR</span>
            <span>MEHAK&apos;S LOVE</span>
            <span>FOR TECHNO</span>
          </h1>
          <div className="title-rule">
            <span />
            <p>SELECTED FREQUENCIES / NO INTERRUPTIONS</p>
          </div>
        </section>

        <section className="player-console" aria-label="Mehak's techno playlist">
          <div className="console-header">
            <div>
              <span className="console-kicker">NOW TRANSMITTING</span>
              <p>MEHAK&apos;S TECHNO PLAYLIST</p>
            </div>
            <span className="console-index">01</span>
          </div>

          <div className="spotify-shell">
            {embedFallback ? (
              <iframe
                className="spotify-fallback"
                title="Spotify playlist player"
                src="https://open.spotify.com/embed/playlist/18vUeZ9BdtMRNV6gI8RnR6?utm_source=generator&theme=0"
                width="100%"
                height="352"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="eager"
              />
            ) : (
              <div id="spotify-embed" className="spotify-mount" />
            )}
          </div>

          <div className="console-footer">
            <span>SPOTIFY EMBED</span>
            <a href={PLAYLIST_URL} target="_blank" rel="noreferrer">
              OPEN PLAYLIST <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </div>

      <div className={`entry-gate${entered ? " is-open" : ""}`}>
        <p className="gate-label">PRIVATE LISTENING ROOM</p>
        <button
          className={`enter-button${gateReady ? " is-ready" : ""}`}
          type="button"
          onClick={enterExperience}
          disabled={!gateReady || (!spotifyReady && !embedFallback)}
          aria-busy={!spotifyReady && !embedFallback}
          aria-label="Play Mehak's techno playlist and enter"
        >
          <span className="button-orbit" aria-hidden="true" />
          <span className="play-mark" aria-hidden="true" />
          <span className="play-word">PLAY</span>
        </button>
        <p className="gate-note">
          SOUND ON <span aria-hidden="true">•</span> BEST EXPERIENCED FULL SCREEN
        </p>
      </div>
    </main>
  );
}
