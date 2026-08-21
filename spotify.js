// app/spotify.ts
var TOKEN_STORAGE_KEY = "mehak_spotify_token_v1";
var VERIFIER_STORAGE_KEY = "mehak_spotify_pkce_verifier";
var STATE_STORAGE_KEY = "mehak_spotify_oauth_state";
var REDIRECT_STORAGE_KEY = "mehak_spotify_redirect_uri";
var PENDING_ROOM_KEY = "mehak_spotify_pending_room";
var CATALOG_CACHE_VERSION = 3;
var CATALOG_CACHE_TTL = 30 * 24 * 60 * 60 * 1e3;
var SPOTIFY_MAX_RATE_LIMIT_RETRIES = 10;
var SPOTIFY_ALBUM_BATCH_SIZE = 20;
var SPOTIFY_CLIENT_ID = "d7993980b50b4617908c37aa3c3d3692";
var SPOTIFY_ARTISTS = [
  {
    key: "artbat",
    id: "3BkRu2TGd2I1uBxZKddfg1",
    name: "ARTBAT",
    url: "https://open.spotify.com/artist/3BkRu2TGd2I1uBxZKddfg1"
  },
  {
    key: "solomun",
    id: "5wJK4kQAkVGjqM9x46KQOC",
    name: "SOLOMUN",
    url: "https://open.spotify.com/artist/5wJK4kQAkVGjqM9x46KQOC"
  }
];
var refreshPromise = null;
function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function randomToken(length = 64) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}
async function codeChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );
  return toBase64Url(new Uint8Array(digest));
}
function getRedirectUri() {
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/index\.html$/i, "");
  return `${url.origin}${path}`;
}
function readStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw);
    if (typeof token.accessToken !== "string" || typeof token.expiresAt !== "number" || typeof token.refreshToken !== "string") {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}
function saveToken(payload, previous) {
  const token = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1e3,
    refreshToken: payload.refresh_token ?? previous?.refreshToken ?? "",
    scope: payload.scope ?? previous?.scope ?? ""
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  return token;
}
function clearCallbackParameters() {
  const url = new URL(window.location.href);
  ["code", "state", "error", "error_description"].forEach(
    (name) => url.searchParams.delete(name)
  );
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
function clearSpotifySession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}
function wasRoomPending() {
  return sessionStorage.getItem(PENDING_ROOM_KEY) === "1";
}
function clearPendingRoom() {
  sessionStorage.removeItem(PENDING_ROOM_KEY);
}
async function beginSpotifyAuthorization(selectedArtist) {
  const verifier = randomToken();
  const state = randomToken(24);
  const redirectUri = getRedirectUri();
  const challenge = await codeChallenge(verifier);
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);
  sessionStorage.setItem(REDIRECT_STORAGE_KEY, redirectUri);
  sessionStorage.setItem(PENDING_ROOM_KEY, "1");
  sessionStorage.setItem("mehak_spotify_selected_artist", selectedArtist);
  const parameters = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-playback-state",
      "user-modify-playback-state"
    ].join(" "),
    show_dialog: "false",
    state
  });
  window.location.assign(
    `https://accounts.spotify.com/authorize?${parameters.toString()}`
  );
}
async function completeSpotifyAuthorization() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    clearCallbackParameters();
    throw new Error(
      oauthError === "access_denied" ? "Spotify connection was cancelled" : "Spotify could not connect"
    );
  }
  if (!code) {
    return Boolean(readStoredToken());
  }
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  const expectedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const redirectUri = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
  if (!verifier || !expectedState || returnedState !== expectedState || !redirectUri) {
    clearCallbackParameters();
    throw new Error("Spotify security check expired \u2014 connect again");
  }
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!response.ok) {
    clearCallbackParameters();
    throw new Error("Spotify login expired \u2014 connect again");
  }
  saveToken(await response.json());
  [VERIFIER_STORAGE_KEY, STATE_STORAGE_KEY, REDIRECT_STORAGE_KEY].forEach(
    (key) => sessionStorage.removeItem(key)
  );
  clearCallbackParameters();
  return true;
}
async function getSpotifyAccessToken(forceRefresh = false) {
  const token = readStoredToken();
  if (!token) throw new Error("Connect Spotify to continue");
  if (!forceRefresh && token.expiresAt > Date.now() + 6e4) {
    return token.accessToken;
  }
  if (!token.refreshToken) {
    clearSpotifySession();
    throw new Error("Spotify session expired \u2014 connect again");
  }
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken
        })
      });
      if (!response.ok) {
        clearSpotifySession();
        throw new Error("Spotify session expired \u2014 connect again");
      }
      return saveToken(
        await response.json(),
        token
      ).accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
function announceSpotifyCooldown(retryAfterSeconds, attempt) {
  window.dispatchEvent(
    new CustomEvent("mehak:spotify-rate-limit", {
      detail: { attempt, retryAfterSeconds }
    })
  );
}
async function spotifyApi(url, init = {}, attempt = 0, forceRefresh = false) {
  let currentAttempt = attempt;
  let refreshed = forceRefresh;
  let accessToken = await getSpotifyAccessToken(forceRefresh);
  while (true) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...init.body ? { "Content-Type": "application/json" } : {},
        ...init.headers
      }
    });
    if (response.status === 401 && !refreshed) {
      accessToken = await getSpotifyAccessToken(true);
      refreshed = true;
      continue;
    }
    if (response.status === 429 && currentAttempt < SPOTIFY_MAX_RATE_LIMIT_RETRIES) {
      const headerValue = Number(response.headers.get("Retry-After"));
      const retryAfterSeconds = Number.isFinite(headerValue) && headerValue > 0 ? Math.ceil(headerValue) : Math.min(30, 2 ** (currentAttempt + 1));
      announceSpotifyCooldown(retryAfterSeconds, currentAttempt + 1);
      await wait(retryAfterSeconds * 1e3 + Math.round(Math.random() * 250));
      currentAttempt += 1;
      continue;
    }
    if (!response.ok) {
      let message = `Spotify request failed (${response.status})`;
      try {
        const payload = await response.json();
        if (typeof payload.error === "string") message = payload.error;
        if (typeof payload.error === "object" && payload.error?.message) {
          message = payload.error.message;
        }
      } catch {
      }
      throw new Error(message);
    }
    if (response.status === 204) return void 0;
    return await response.json();
  }
}
async function fetchAllPages(initialUrl, onProgress) {
  const items = [];
  let next = initialUrl;
  while (next) {
    const page = await spotifyApi(next);
    items.push(...page.items);
    onProgress?.(items.length, page.total);
    next = page.next;
  }
  return items;
}
function recordingKey(track) {
  const normalizedTitle = track.name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const artists = track.artists.map((artist) => artist.id).sort().join(",");
  return `${normalizedTitle}|${artists}|${Math.round(track.duration_ms / 2e3)}`;
}
function readCachedCatalog(artist) {
  try {
    const raw = localStorage.getItem(
      `mehak_spotify_catalog_${artist.id}_v${CATALOG_CACHE_VERSION}`
    );
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CATALOG_CACHE_TTL || !Array.isArray(cached.tracks) || cached.tracks.length === 0) {
      return null;
    }
    return cached.tracks;
  } catch {
    return null;
  }
}
async function fetchArtistCatalog(artist, onProgress) {
  const cached = readCachedCatalog(artist);
  if (cached) {
    onProgress?.({
      completed: cached.length,
      percent: 100,
      phase: "cache",
      total: cached.length
    });
    return cached;
  }
  onProgress?.({ completed: 0, percent: 1, phase: "releases", total: 1 });
  const albumUrl = new URL(
    `https://api.spotify.com/v1/artists/${artist.id}/albums`
  );
  albumUrl.search = new URLSearchParams({
    include_groups: "album,single,appears_on,compilation",
    limit: "10"
  }).toString();
  const albums = await fetchAllPages(
    albumUrl.toString(),
    (loaded, total) => {
      const ratio = loaded / Math.max(1, total);
      onProgress?.({
        completed: Math.min(loaded, total),
        percent: Math.min(12, 2 + Math.round(ratio * 10)),
        phase: "releases",
        total
      });
    }
  );
  const uniqueAlbums = Array.from(
    new Map(albums.map((album) => [album.id, album])).values()
  );
  const collected = [];
  let loadedAlbums = 0;
  onProgress?.({
    completed: 0,
    percent: 12,
    phase: "tracks",
    total: uniqueAlbums.length
  });
  for (let index = 0; index < uniqueAlbums.length; index += SPOTIFY_ALBUM_BATCH_SIZE) {
    const batch = uniqueAlbums.slice(index, index + SPOTIFY_ALBUM_BATCH_SIZE);
    const url = new URL("https://api.spotify.com/v1/albums");
    url.searchParams.set("ids", batch.map((album) => album.id).join(","));
    const response = await spotifyApi(url.toString());
    const expanded = await Promise.all(
      response.albums.map(async (album, albumIndex) => {
        if (!album) return [];
        const sourceAlbum = batch[albumIndex] ?? album;
        const tracks2 = [...album.tracks.items];
        if (album.tracks.next) {
          tracks2.push(...await fetchAllPages(album.tracks.next));
        }
        return tracks2.map((track) => ({ album: sourceAlbum, track }));
      })
    );
    expanded.forEach((tracks2) => collected.push(...tracks2));
    loadedAlbums += batch.length;
    onProgress?.({
      completed: Math.min(loadedAlbums, uniqueAlbums.length),
      percent: 12 + Math.round(
        loadedAlbums / Math.max(1, uniqueAlbums.length) * 88
      ),
      phase: "tracks",
      total: uniqueAlbums.length
    });
  }
  const uniqueTracks = /* @__PURE__ */ new Map();
  collected.forEach(({ album, track }) => {
    if (!track.id || !track.uri || track.is_playable === false || !track.artists.some((credit) => credit.id === artist.id)) {
      return;
    }
    const candidate = {
      album: album.name,
      artistIds: track.artists.map((credit) => credit.id),
      artists: track.artists.map((credit) => credit.name).join(" \xB7 "),
      discNumber: track.disc_number,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      id: track.id,
      previewUrl: track.preview_url ?? null,
      releaseDate: album.release_date || "9999",
      spotifyUrl: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      title: track.name,
      trackNumber: track.track_number,
      uri: track.uri
    };
    const key = recordingKey(track);
    const existing = uniqueTracks.get(key);
    if (!existing || candidate.releaseDate < existing.releaseDate) {
      uniqueTracks.set(key, candidate);
    }
  });
  const tracks = Array.from(uniqueTracks.values()).sort(
    (left, right) => left.releaseDate.localeCompare(right.releaseDate) || left.album.localeCompare(right.album) || left.discNumber - right.discNumber || left.trackNumber - right.trackNumber || left.title.localeCompare(right.title)
  );
  if (tracks.length === 0) {
    throw new Error(`No playable ${artist.name} tracks were returned`);
  }
  try {
    localStorage.setItem(
      `mehak_spotify_catalog_${artist.id}_v${CATALOG_CACHE_VERSION}`,
      JSON.stringify({ fetchedAt: Date.now(), tracks })
    );
  } catch {
  }
  return tracks;
}
export {
  SPOTIFY_ARTISTS,
  SPOTIFY_CLIENT_ID,
  beginSpotifyAuthorization,
  clearPendingRoom,
  clearSpotifySession,
  completeSpotifyAuthorization,
  fetchArtistCatalog,
  getSpotifyAccessToken,
  spotifyApi,
  wasRoomPending
};
