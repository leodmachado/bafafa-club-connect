# Teste da V18

1. Execute `BAFAFA_INFRAESTRUTURA_CONTINUIDADE_V18_SETUP.sql` no Supabase.
2. Execute `VERIFICAR_INFRAESTRUTURA_V18.sql`.
3. Entre como admin com MFA e abra **Administração → Segurança**.
4. Confirme que a postura do banco aparece como OK.
5. Marque um controle externo como concluído e registre uma evidência.
6. Conceda e remova o papel `equipe` de uma conta de teste.
7. Confirme que os eventos aparecem na aba Segurança.
8. Marque o evento como resolvido.
9. Faça uma exportação CSV e confirme o evento de exportação.
10. Execute `bun run security:secrets`.
11. Faça push e confirme o check `Build e segurança` no GitHub.
12. Gere um backup de teste e execute `verify-backup.ps1`.

Não use dados reais no teste de restauração.
