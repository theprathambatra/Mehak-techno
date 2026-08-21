# Built for Mehak's Love for Techno

A single-screen immersive techno listening room built with Next.js. It uses a
cursor-responsive spiral video, an animated entry gate, and Spotify's official
playlist embed.

## Official website resources

- `app/page.tsx`: layout, Spotify integration, entry interaction and pointer motion
- `app/globals.css`: complete visual design, animation and responsive behaviour
- `app/layout.tsx`: page title, description and social-sharing metadata
- `public/spiral.mp4`: optimized 720p seamless website loop
- `public/spiral-poster.jpg`: loading poster for the video
- `public/og.png`: social-sharing image
- `public/favicon.svg`: browser icon

The music is not copied into this repository. Playback uses Spotify's official
embed for playlist `18vUeZ9BdtMRNV6gI8RnR6`, so no Spotify API key is required.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

1. Upload this project to a GitHub repository.
2. In Vercel, select **Add New > Project** and import the repository.
3. Keep the detected **Next.js** settings and deploy.
4. Optionally add `NEXT_PUBLIC_SITE_URL` with the final custom-domain URL, then redeploy. This keeps social-share links pointed at the final domain.

## Notes

- The uploaded source video was optimized into a compact seamless loop for fast web playback.
- Audio starts from the visitor's PLAY gesture when Spotify and the browser permit it.
- If Spotify's programmable player is blocked, the page automatically falls back to its standard official embed.
