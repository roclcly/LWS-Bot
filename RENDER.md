# Render Hosting

This bot can run on Render with:

- Build Command: `npm ci`
- Start Command: `npm start`
- Runtime: Node

The included `render.yaml` defines a free web service with a small health endpoint. The Discord bot starts inside `scripts/render-state-bot.js`.

For a true always-on Discord Gateway bot, a Render background worker or paid always-on web service is better. Render's free web service can sleep, which disconnects the bot until it wakes again.

## Manual Dashboard Setup

1. Push this folder to a GitHub repo.
2. In Render, create a new Web Service from the repo.
3. Use `npm ci` as the build command.
4. Use `npm start` as the start command.
5. Confirm the environment variables from `render.yaml`.
