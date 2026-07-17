# BAFAFÁ V15 — teste de segurança base

Esta versão não adiciona funcionalidades visíveis. Ela reduz o que cada papel consegue fazer diretamente pela API do Supabase.

## Ordem

1. Faça backup lógico do banco ou confirme que o projeto possui backup recente.
2. Execute `BAFAFA_SEGURANCA_BASE_V15_SETUP.sql` uma vez no SQL Editor.
3. Execute `VERIFICAR_SEGURANCA_V15.sql` e confira os resultados esperados.
4. Teste o aplicativo local antes de enviar para a Vercel.

## Testes como cliente comum

- Abrir e editar o próprio perfil.
- Trocar foto, nome, username, cidade, bairro, bio, preferências e título.
- Abrir um perfil público por `/u/username`.
- Confirmar que telefone, nascimento e bairro não aparecem publicamente.
- Abrir os próprios check-ins e mimos.
- Entrar na Resenha somente após check-in.
- Bloquear e desbloquear outra pessoa.

## Tentativas que devem falhar

Use uma conta comum e o console/requisição manual somente em ambiente de teste.

- Atualizar `phone_verified_at`, `is_over_18`, `member_since` ou `deleted_at` no próprio perfil.
- Consultar a tabela `profiles` de outro cliente.
- Inserir linha diretamente em `audit_logs`.
- Inserir check-in diretamente em `checkins`.
- Atualizar diretamente um mimo em `user_rewards`.
- Consultar `has_role()` de outro usuário.
- Consultar acesso à Resenha de outro usuário pelas funções auxiliares.

## Testes como equipe

- Abrir `/staff/checkin`.
- Validar check-in por QR e código curto.
- Validar um mimo.
- Confirmar que a equipe não consegue listar a base completa de check-ins, mimos ou resgates por consulta direta.

## Testes como administrador

- Abrir o painel administrativo.
- Listar clientes, check-ins, mimos e auditoria.
- Criar/editar evento e campanha.
- Atribuir e remover papel de equipe de uma conta de teste.
- Confirmar que a auditoria é registrada pelos triggers.

## Reversão emergencial

Não faça reversão automática sem identificar o erro. A migration não apaga dados. Se o perfil deixar de salvar, verifique primeiro qual coluna o frontend tentou alterar e ajuste o grant de coluna de forma explícita.
