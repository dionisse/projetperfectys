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
- App continues using browser storage; database not yet connected to app
- Browser storage will serve as fallback once database is connected
- Security check passed (no issues reported at creation)
- Current security model: anyone with the app's public key can read/write stored data — acceptable for no-login demo, must be tightened with real auth
- Framework directive: `DEFAULT_TO_DEV` — proceed with implementation when repeated/confirmed

## Open questions & assumptions

- Next step pending user confirmation: connect app to database so folder data saves there
- Supabase inferred as database provider (public key mentioned)
- No auth system in place yet; security tightening deferred until sign-in exists
- Table schema details not yet specified beyond "folder saved data"