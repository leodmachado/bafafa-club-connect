# Teste do painel administrativo v2

1. Execute `ADMIN_V2_SETUP.sql` no SQL Editor do Supabase.
2. Reinicie o servidor local e entre com uma conta que tenha papel `admin`.
3. No Perfil, toque em **Administração**.
4. Crie um evento futuro com check-in habilitado.
5. Crie uma campanha vinculada ao evento.
6. Confirme no aplicativo do cliente que o evento aparece em **Eventos**.
7. Abra **Equipe** no painel e conceda o papel `equipe` a uma segunda conta de teste.
8. Na segunda conta, abra `/staff/checkin` e valide um código.
9. Confirme no painel que o check-in apareceu e que a auditoria registrou a ação.

Não remova o próprio papel de administrador. A migration bloqueia essa operação como proteção adicional.
