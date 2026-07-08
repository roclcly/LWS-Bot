# Koyeb Hosting

This bot is ready for Koyeb as a Node web service.

Use:

- Build command: `npm ci`
- Run command: `npm start`
- Port: `10000`

The `npm start` script runs `scripts/render-state-bot.js`, which opens a tiny HTTP health endpoint and starts the Discord gateway bot.

Koyeb's Node buildpack can run `npm run start` by default for Node apps. Git-driven deployment requires Koyeb's GitHub app to have access to the repository.
