# Roteiro de teste — Autenticação V16

Use contas fictícias. Faça os testes no local e no Preview da Vercel.

## A. Administrador sem MFA

1. Execute o SQL da V16.
2. Saia e entre como administrador.
3. Abra `/admin`.
4. O sistema deve exigir configuração ou confirmação do autenticador.
5. Antes do TOTP, tente operações administrativas: o banco deve negar.

## B. Configuração e desafio MFA

1. Abra Perfil → Segurança da conta.
2. Configure TOTP e confirme o código.
3. Abra `/admin`: deve funcionar.
4. Adicione um segundo autenticador e confirme.
5. Saia e entre novamente.
6. Código errado deve falhar; código correto deve elevar a sessão a `aal2`.
7. Remova um fator, mantendo pelo menos um em conta privilegiada.

## C. Equipe e moderador

1. Atribua `equipe` a uma conta de teste.
2. Sem MFA, `/staff/checkin` deve bloquear.
3. Com MFA confirmado, o validador deve funcionar.
4. Equipe não deve acessar `/admin`.
5. Repita a exigência de AAL2 com uma conta `moderador`, caso esse papel esteja em uso.

## D. Cliente comum

1. Entre com conta `gratuito`.
2. O app deve funcionar sem MFA obrigatório.
3. A pessoa pode ativar TOTP voluntariamente.
4. Remover o último fator voluntário deve ser permitido para conta não privilegiada após confirmar AAL2.

## E. Recuperação de senha

1. Abra “Esqueci minha senha”.
2. Com CAPTCHA ativo, tente sem resolver o desafio: deve falhar.
3. Solicite o link corretamente.
4. Acesse `/reset-password` diretamente: deve mostrar link inválido.
5. Abra o link real: deve mostrar nova senha e confirmação.
6. Senha curta, simples ou divergente deve ser recusada.
7. Salve uma senha válida: outras sessões devem ser encerradas.
8. Reutilizar o link deve falhar.

## F. Confirmação de e-mail

1. Ative confirmação no Supabase.
2. Crie conta nova.
3. Antes de confirmar, o login deve ser negado.
4. Confirme e entre.
5. Verifique se existem perfil, papel `gratuito`, preferências e consentimentos.

## G. CAPTCHA

1. Configure Turnstile no Supabase e no ambiente da aplicação.
2. Teste cadastro, login e recuperação sem token: devem ser negados.
3. Resolva o desafio: devem funcionar.
4. Confirme que Preview e Production têm a variável pública.
5. Confirme que nenhuma Secret key aparece no bundle, GitHub ou variáveis `VITE_`.

## H. Preferências e consentimentos

1. Altere preferências e marketing pelo Perfil: deve salvar.
2. Salve novamente sem mudar marketing: não deve criar novo histórico de marketing.
3. Mude marketing: deve criar um novo registro.
4. Tente inserir diretamente em `user_consents` com a chave pública: deve falhar.
5. Tente atualizar diretamente `user_preferences`: deve falhar.

## I. AAL1 contra AAL2

1. Entre como admin e ainda não confirme TOTP.
2. Chame pela interface uma operação protegida: deve ser negada.
3. Confirme TOTP.
4. Repita: deve funcionar.
5. Use a RPC `my_auth_security_status` no cliente autenticado e confira:
   - `privileged = true`;
   - antes do TOTP: `aal = aal1` e acesso privilegiado falso;
   - depois: `aal = aal2` e acesso privilegiado verdadeiro.

## J. Sessões

1. Entre em dois navegadores/aparelhos.
2. Em Segurança, encerre outras sessões.
3. O outro aparelho deve perder a sessão após atualização/renovação.
4. Teste “Sair de todos os aparelhos”.
