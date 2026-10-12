# Secret Millionaire — private weekend game

A runnable **starter prototype**, not yet a deployed or production-audited service.

## Start locally

1. Install Node.js 20+.
2. Run `npm install` then `npm start`.
3. Visit `http://localhost:3000`.

## Before playing

- The private mission bank at `private/missions.json` is intentionally empty to avoid exposing agendas to the player who commissioned the game. A trusted non-playing person should populate it with **at least 60 approved, unique, safe strings**, without showing the file to any players. Example structure: `["Mission text 1", "Mission text 2", ...]`. The game will refuse to start until this is done.
- Register 12 players. Each uses a phone number and a personal 6–12 digit PIN. Phone numbers are hashed in the database, not stored in plaintext. **This is not SMS verification**: someone knowing another person's phone number and PIN can log in.
- Create an admin key (20+ characters) by POSTing JSON `{ "key": "..." }` to `/api/admin/setup` once. Protect this key and give it to a trusted non-playing administrator. Admin endpoints require header `x-admin-key`.
- The admin checks `/api/admin/status`, starts via POST `/api/admin/start`, closes agendas via POST `/api/admin/close`, and after all 12 have voted, reveals via POST `/api/admin/reveal`.
- Role selection uses cryptographically secure randomization on the server. No player can view another player's role or missions before the reveal.

## Deployment considerations

- Do not deploy this SQLite app to ephemeral serverless storage: use a persistent volume or migrate to a managed database. A free static hosting tier alone cannot run the backend.
- HTTPS is mandatory for public use. Add rate limiting, CSRF/origin protections, login lockout, backups, and an admin UI before a public deployment.
- Couple labels are currently registration metadata only. Scoring, scheduled bonuses, richer finale, and an admin interface are not yet implemented.
- Do not store national identity numbers. Ask adults for consent to use their phone numbers; delete the database after the weekend.
- Avoid unsafe, humiliating or coercive missions, particularly involving children, personal belongings, food, or substances.

## Non-player facilitator interface

A simple facilitator control screen is available at `/admin.html` after deployment. It can configure the admin key once, show the 12-player registration list, start the game, open voting and trigger the final reveal. **Do not give this link or key to a player.** This control panel does not display agendas or identities.

## Current status (October 2026)

This is **version 1.1**, a local/deployable prototype. It has **not** been published to a live URL, tested with twelve devices, or security audited. There is no populated mission bank, automatic time scheduler, bonus-mission engine, or production-grade login protection. The user should not register real personal information until a production deployment has been configured and tested. Do not promise that the platform will run unattended until the remaining work is done.

## Version 1.2 — date-gated vault

- Vault content is hidden until **22 October 2026 at 20:00 SAST**, even if a facilitator prepares the assignments earlier. Set `UNLOCK_AT` to a different ISO-8601 timestamp if required.
- The facilitator must still manually run **Start game** after all 12 players have registered, preferably *before* Thursday 20:00. Otherwise vaults remain sealed until that action is taken.
- Saturday 24 October at approximately 20:00: facilitator closes missions, players vote, and facilitator triggers reveal once all 12 votes are in.
- This version has **no automatic mission generation, populated secret agendas, timed bonus missions, or deployed hosting**. Do not share a public registration link until the missing pieces and security hardening are complete.
- Hosting and database costs have **not** been incurred.
