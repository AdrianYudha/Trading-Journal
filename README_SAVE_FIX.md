# Save Fix - Public Mode

This version fixes the save error:
`Could not find the 'user_id' column of 'trade_logs' in the schema cache`.

The public/no-login journal no longer sends `user_id` to Supabase. It is compatible with the original single-tenant `trade_logs` schema.

It also keeps the backward-compatible `reward_r` fallback: if `reward_r` is not present, the app stores the logical R/outcome in the notes metadata and restores it when reading.

No login, register, Edge Function, or auth setup is required for this public mode.
