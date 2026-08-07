-- V20.7 — objetos futuros do aplicativo fechados por padrão.
--
-- Não altera grants de objetos já existentes.
-- As migrations e funções do aplicativo são criadas pelo papel postgres.
-- O papel interno supabase_admin possui default privileges gerenciados pela
-- plataforma e não pode ser alterado pela conexão disponível ao projeto.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select, update
  on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute
  on functions from public, anon, authenticated;
