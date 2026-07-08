# WOS State Discord Builder

This package builds a neutral Whiteout Survival state hub, defaulting to `State 4500`.

It is separate from the LWS builder so the two servers cannot overwrite each other.

## Setup

1. Invite a bot to the state Discord server with:
   - Manage Roles
   - Manage Channels
   - Manage Nicknames
   - View Channels
   - Send Messages
   - Manage Messages
   - Read Message History
   - Add Reactions
   - Use Slash Commands
2. Put the bot role above roles it will create or assign.
3. Copy `.env.example` to `.env`.
4. Fill in:

```env
DISCORD_TOKEN=...
GUILD_ID=...
STATE_NAME=State 4500
```

## Commands

Preview without Discord login:

```powershell
npm.cmd run dry-run
```

Preview against the live server without changing it:

```powershell
npm.cmd run live-dry-run
```

Apply the server build:

```powershell
npm.cmd run apply
```

Start the persistent verification/reaction bot:

```powershell
npm.cmd run verify-bot
```

Or double-click:

```text
Start-StateVerifyBot.bat
```

## Verification

New members can only see `🐺・verify-state`.

They verify with:

```text
/verify username: TheirWOSName alliance: TAG
```

The bot sets their nickname to `[TAG] TheirWOSName`, grants `Verified State Member`, and creates/assigns the alliance role if needed.
