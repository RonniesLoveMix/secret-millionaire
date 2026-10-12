# Deployment checklist — for a trusted technical facilitator (not a player)

This package is **not live**. Do not distribute a link or collect player phone numbers until deployed and tested.

1. Use a Node-compatible host with **persistent disk** or a VPS and HTTPS reverse proxy. A static-only host or ephemeral filesystem is unsuitable for this SQLite version.
2. Set `DB_PATH` to a persistent writable path, e.g. `/data/game.db`. Set `UNLOCK_AT=2026-10-22T20:00:00+02:00`.
3. Install dependencies and start (`npm install && npm start`) or build and run the Dockerfile with a persistent volume mounted at `/data`.
4. A **trusted non-player** must create `private/missions.json` containing 60+ unique, approved agendas, and keep this file off any public source repository. It is currently empty; the game cannot start without it.
5. The facilitator creates an admin key (20+ random characters), keeps it private, tests admin controls, and prepares the assignments after all 12 adults register, before Thursday 20:00.
6. Test 12 separate registrations with **fake** details in a staging copy, Thursday gate, five missions per vault, close/vote/reveal flow, and backup/restore. Wipe the staging database before real registration.
7. Use a TLS certificate, origin/CSRF protections, backup, monitored hosting, and stronger distributed rate limiting before inviting real users. This prototype's in-memory rate limit is not sufficient for a public production service.
8. Obtain players' consent for processing their phone numbers; avoid national ID numbers. Delete game records after the weekend.

**Cost:** No purchases have been made. Hosting and any custom domain are subject to provider pricing and must be approved before payment.
