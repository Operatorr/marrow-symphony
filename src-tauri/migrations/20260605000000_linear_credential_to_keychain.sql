-- Move the Linear credential out of SQLite and into the OS keychain.
--
-- The access token (personal API key or OAuth token) is now stored in the
-- platform secure store (macOS Keychain / Windows Credential Manager / Linux
-- Secret Service), keyed by the app, and never written to the database again.
-- `linear_connection` keeps only non-secret metadata (method + workspace name).
--
-- Purge any previously-stored plaintext token first, then drop the column so the
-- secret can never be persisted to the DB file. An existing connection therefore
-- has to be re-entered once after upgrading; reconnecting writes the credential
-- to the keychain. (Bytes already written to free pages are reclaimed on the next
-- VACUUM; VACUUM cannot run inside this migration's transaction.)
DELETE FROM linear_connection;
ALTER TABLE linear_connection DROP COLUMN access_token;
