-- Seed the first owner member (needed to create invites).
-- Replace the email/password-hash below for real use. To generate a hash for a
-- password P: run the worker's hashPassword(P) once (or use `openssl passwd` style),
-- then INSERT. For local smoke tests, bootstrapping an owner via SQL is the clean path.
-- NOTE: pass_hash must be the worker's "pbkdf2$<iter>$<salt>$<hex>" format.
INSERT OR IGNORE INTO members (id, name, email, pass_hash, role, account_status, created_at)
VALUES ('seed-owner', 'Seed Owner', 'owner@example.com', 'pbkdf2$210000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000', 'owner', 'active', '2026-11-20T00:00:00.000Z');
