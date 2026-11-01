# Project memory

## Product intent & audience

- Accounting/folder-management app; lets users save data per "accounting folder"
- Currently a no-login demo (no authentication); real sign-in planned for later

## Brand personality & voice

- Concise, action-oriented communication; explains what was done and what's next
- Transparent about limitations and security trade-offs

## Visual design & UX direction

- No specific visual/UX details inferred yet

## Decisions, constraints & rationale

- Database created: single table holding each accounting folder's saved data
- App is now connected to the database; folder data saves there automatically
- Browser storage serves as fallback (intended once DB connected; status of fallback now that DB is live unclear)
- Security check passed (no issues reported at creation)
- Current security model: anyone with app's public key can read/write stored data — acceptable for no-login demo, must be tightened with real auth
- Framework directive: `DEFAULT_TO_DEV` — proceed with implementation when repeated/confirmed
- Known limitation: app waits for database before first screen, with no timeout
- Known limitation: concurrent edits on same folder from two devices will overwrite each other

## Open questions & assumptions

- Supabase inferred as database provider (public key mentioned)
- No auth system in place yet; security tightening deferred until sign-in exists
- Table schema details not yet specified beyond "folder saved data"
- No save record verified yet — app couldn't be opened in-browser; first real test: open app, edit folder, confirm record appears in table
- Status of browser storage fallback now that DB is live needs clarification
- Timeout behavior for DB connection pending future improvement
- Conflict resolution for concurrent edits not yet addressed