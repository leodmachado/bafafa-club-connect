# Bafafá Connect V20.5 — Preparação do piloto controlado

## Escopo

Esta entrega prepara o aplicativo para o teste com clientes convidados, equipe e administração, sem executar reset e sem fazer deploy.

## Mudanças

### 1. Check-ins isolados por campanha

A função `campaign_progress_for_user` passa a considerar somente check-ins com `created_at` dentro de `campaigns.starts_at` e `campaigns.ends_at`.

Consequência:

- campanha nova começa em zero;
- visitas anteriores não são reaproveitadas;
- campanhas consecutivas possuem progresso independente;
- check-in repetido no mesmo evento continua sem aumentar `distinct_checkins`;
- `total_checkins`, `distinct_checkins`, `category_checkins` e `event_checkin` respeitam a janela da campanha.

### 2. Verificação controlada

`VERIFICAR_CHECKINS_POR_CAMPANHA_V205.sql` cria eventos, campanhas e check-ins sintéticos dentro de uma transação. O arquivo termina com `ROLLBACK`, portanto não deixa dados de teste no projeto.

O resultado esperado é:

```text
verificacao_ok = true
```

### 3. Reset operacional

O reset foi dividido em três arquivos:

1. `BAFAFA_RESET_OPERACIONAL_PILOTO_V205_PREVIEW.sql`
2. `BAFAFA_RESET_OPERACIONAL_PILOTO_V205_EXECUTAR.sql`
3. `BAFAFA_RESET_OPERACIONAL_PILOTO_V205_VERIFICAR.sql`

O reset preserva:

- contas e perfis;
- papéis de acesso;
- produtos e locais;
- preferências e consentimentos;
- definições de selos e títulos;
- configurações, segurança e auditoria.

O reset remove:

- eventos, campanhas e feed;
- check-ins, recompensas e QR temporários;
- Resenha, Salves e conversas privadas;
- vendas e progresso comercial;
- metas, funis, segmentos, selos e títulos concedidos por testes.

O arquivo de execução possui confirmação manual e cancela a transação se dados preservados forem alterados.

## Ordem segura de uso

1. Aplicar a migration V20.5.
2. Executar `VERIFICAR_CHECKINS_POR_CAMPANHA_V205.sql`.
3. Só prosseguir se `verificacao_ok = true`.
4. Configurar e testar o OTP por telefone com um único número.
5. Fazer backup do Supabase.
6. Executar a prévia do reset.
7. Revisar as quantidades.
8. Editar a confirmação manual no arquivo de execução.
9. Executar o reset.
10. Executar a verificação do reset.
11. Só prosseguir se `verificacao_ok = true`.
12. Criar o cenário do piloto.
13. Distribuir o workflow oficial aos participantes.

## Fora do escopo desta entrega

- configuração das credenciais Twilio no painel;
- aplicação da migration;
- execução do reset;
- criação dos eventos reais do piloto;
- deploy.
