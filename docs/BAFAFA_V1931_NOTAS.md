# Bafafá Connect V19.3.1

Correção de banco para a V19.3.

## Problema

A função `refresh_user_milestone_rewards(uuid)` usava:

```sql
ON CONFLICT (user_id, campaign_id) DO NOTHING
```

A estrutura atual de `user_rewards` não possui uma restrição `UNIQUE` nesse par de colunas, pois o sistema permite `per_user_limit` maior que 1. O PostgreSQL recusava a execução durante o reprocessamento dos usuários.

## Correção

O `ON CONFLICT` incompatível foi removido. A prevenção de concessões acima do limite continua sendo feita por:

- `pg_advisory_xact_lock` por usuário e campanha;
- contagem de recompensas da campanha;
- `total_available`;
- `per_user_limit`.

A instalação manual deve ser feita pelo arquivo `02-SUPABASE-EXECUTAR/BAFAFA_V1931_CORRECAO_COMPLETA.sql` do pacote de atualização.
