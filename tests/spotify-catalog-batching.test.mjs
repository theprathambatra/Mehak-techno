import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchArtistCatalog,
  SPOTIFY_ARTISTS,
  spotifyApi,
} from "../github-pages/spotify.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

function jsonResponse(payload, status = 200, headerValues = {}) {
  return {
    clone: () => jsonResponse(payload, status, headerValues),
    headers: {
      get: (name) => headerValues[name.toLowerCase()] ?? null,
    },
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  };
}

test("artist catalogs use twenty-album batches instead of one request per release", async () => {
  const artist = SPOTIFY_ARTISTS[0];
  const requestCounts = {
    albumBatches: 0,
    albumTrackRequests: 0,
    releasePages: 0,
  };

  globalThis.localStorage = new MemoryStorage();
  globalThis.localStorage.setItem(
    "mehak_spotify_token_v1",
    JSON.stringify({
      accessToken: "test-token",
      expiresAt: Date.now() + 3_600_000,
      refreshToken: "test-refresh",
      scope: "streaming",
    }),
  );
  globalThis.window = {
    dispatchEvent: () => true,
    setTimeout,
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.detail = init?.detail;
      this.type = type;
    }
  };

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));

    if (url.pathname === `/v1/artists/${artist.id}/albums`) {
      requestCounts.releasePages += 1;
      const total = 45;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = 10;
      const end = Math.min(total, offset + limit);
      const items = Array.from({ length: end - offset }, (_, itemIndex) => {
        const releaseIndex = offset + itemIndex;
        return {
          id: `album-${releaseIndex}`,
          name: `Album ${releaseIndex}`,
          release_date: `202${releaseIndex % 6}-01-01`,
        };
      });
      const next =
        end < total
          ? `https://api.spotify.com/v1/artists/${artist.id}/albums?include_groups=album%2Csingle%2Cappears_on%2Ccompilation&limit=10&offset=${end}`
          : null;
      return jsonResponse({ items, next, total });
    }

    if (url.pathname === "/v1/albums") {
      requestCounts.albumBatches += 1;
      const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
      return jsonResponse({
        albums: ids.map((id) => ({
          id,
          name: id,
          release_date: "2026-01-01",
          tracks: {
            items: [
              {
                artists: [{ id: artist.id, name: artist.name }],
                disc_number: 1,
                duration_ms: 240_000,
                explicit: false,
                external_urls: { spotify: `https://open.spotify.com/track/${id}` },
                id: `track-${id}`,
                is_playable: true,
                name: `Track ${id}`,
                preview_url: null,
                track_number: 1,
                uri: `spotify:track:${id}`,
              },
            ],
            next: null,
            total: 1,
          },
        })),
      });
    }

    if (/\/v1\/albums\/[^/]+\/tracks$/.test(url.pathname)) {
      requestCounts.albumTrackRequests += 1;
    }

    return jsonResponse({ error: { message: "Unexpected request" } }, 500);
  };

  const tracks = await fetchArtistCatalog(artist);

  assert.equal(tracks.length, 45);
  assert.equal(requestCounts.releasePages, 5);
  assert.equal(requestCounts.albumBatches, 3);
  assert.equal(requestCounts.albumTrackRequests, 0);
});

test("quota exhaustion fails fast instead of trapping the startup curtain", async () => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.localStorage.setItem(
    "mehak_spotify_token_v1",
    JSON.stringify({
      accessToken: "test-token",
      expiresAt: Date.now() + 3_600_000,
      refreshToken: "test-refresh",
      scope: "streaming",
    }),
  );
  globalThis.window = {
    dispatchEvent: () => true,
    setTimeout,
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.detail = init?.detail;
      this.type = type;
    }
  };

  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return jsonResponse(
      {
        error: {
          message: "Too many requests",
          reason: "QUOTA_EXCEEDED",
          status: 429,
        },
      },
      429,
      { "retry-after": "60" },
    );
  };

  await assert.rejects(
    spotifyApi("https://api.spotify.com/v1/artists/test/albums"),
    /quota busy/i,
  );
  assert.equal(requests, 1);
});
