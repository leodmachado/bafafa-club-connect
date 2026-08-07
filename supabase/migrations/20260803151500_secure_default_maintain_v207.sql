-- V20.7 — remove MAINTAIN de futuras tabelas da API.
-- Complementa o hardening de default privileges do papel postgres.

alter default privileges for role postgres in schema public
  revoke maintain
  on tables from public, anon, authenticated;
