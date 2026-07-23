# UGVoice Frontend

React, TypeScript, Material UI, and Vite frontend for UGVoice.

## Local development

1. Install dependencies with `npm install`.
2. Set `VITE_API_BASE_URL` in `.env.local` when the API is not running at `http://127.0.0.1:9000`.
3. Run `npm run dev`.

## Production

Run `npm run build` to create the production bundle in `dist`.

For Vercel, configure `VITE_API_BASE_URL` with the public URL of the independently deployed UGVoice backend.
