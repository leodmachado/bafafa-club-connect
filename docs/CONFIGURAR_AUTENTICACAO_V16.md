# BAFAFÁ V16 — Configuração de autenticação e contas privilegiadas

Esta versão adiciona MFA por aplicativo autenticador, recuperação de senha protegida, CAPTCHA opcional e menor privilégio para consentimentos e preferências. Algumas proteções são código/banco; outras precisam ser ativadas manualmente no painel do Supabase.

## 1. Ordem segura de instalação

1. Tenha pelo menos **duas contas administrativas individuais**. Não compartilhe uma única conta.
2. Execute `BAFAFA_AUTENTICACAO_PRIVILEGIADA_V16_SETUP.sql` no SQL Editor.
3. Saia e entre novamente na conta administradora.
4. Abra **Perfil → Segurança da conta** e configure o TOTP imediatamente.
5. Faça o mesmo para cada conta `admin`, `moderador` e `equipe`.
6. Só depois ative confirmação de e-mail e CAPTCHA no painel.

A partir do SQL, os papéis privilegiados continuam cadastrados, mas operações protegidas pelo banco só funcionam com sessão `aal2`.

## 2. MFA por aplicativo autenticador

O fluxo está em **Perfil → Segurança da conta**:

1. tocar em Configurar agora;
2. escanear o QR com Google Authenticator, Microsoft Authenticator, 1Password ou outro app TOTP;
3. informar o código de seis dígitos;
4. confirmar que `/admin` ou `/staff/checkin` abriu.

É possível adicionar um segundo autenticador. Para contas privilegiadas, mantenha ao menos um fator verificado.

### Recuperação de acesso privilegiado

- mantenha um segundo administrador com conta própria e MFA;
- não compartilhe senha nem QR/segredo TOTP;
- se um administrador perder o autenticador, use o painel seguro do Supabase para remover o fator da conta afetada e force uma recuperação de senha;
- nunca coloque `service_role` no navegador, GitHub, Vercel com prefixo `VITE_` ou arquivos enviados pelo WhatsApp.

## 3. Confirmação de e-mail

Antes do piloto público, ative **Confirm email** no provedor Email do Supabase.

O trigger da V16 cria perfil, preferências, papel gratuito e histórico inicial de consentimentos mesmo quando o usuário ainda não possui sessão confirmada.

Para produção, configure SMTP próprio. Teste:

- confirmação de cadastro;
- recuperação de senha;
- entrega em spam;
- links do Preview e do domínio de produção.

## 4. Política de senha no Supabase

A interface exige 10 ou mais caracteres, letra e número. No painel do Supabase, configure também o comprimento mínimo para que a regra seja aplicada pelo servidor.

Recomendações:

- mínimo de 10 caracteres;
- proteção contra senhas vazadas, se disponível no plano;
- notificações de senha alterada e fator MFA adicionado/removido;
- não habilitar uma exigência de senha atual sem antes testar o fluxo de recuperação, pois o usuário que esqueceu a senha não a conhece.

A aplicação não oferece troca direta por uma sessão antiga: ela envia um link de recuperação, valida o evento `PASSWORD_RECOVERY`, exige duas entradas iguais e encerra as outras sessões após a alteração.

## 5. CAPTCHA com Cloudflare Turnstile

1. Crie um widget Turnstile para:
   - domínio de Preview da Vercel;
   - domínio de produção;
   - `localhost`, somente se for testar localmente e o provedor permitir.
2. No Supabase, ative proteção CAPTCHA e salve a **Secret key**.
3. Na aplicação, use somente a **Site key pública**:
   - `.env.local`: `VITE_TURNSTILE_SITE_KEY=...`
   - Vercel → Environment Variables → Preview e Production.
4. Faça novo deploy.

A aplicação envia o token em cadastro, login e recuperação de senha. A tela Segurança também exige o desafio antes de enviar um novo link de recuperação.

**Não ative CAPTCHA no Supabase antes de publicar a Site key no app**, ou os fluxos de autenticação serão bloqueados.

## 6. URLs permitidas

Em Authentication → URL Configuration, mantenha as URLs exatas usadas pelo app:

- Preview da branch;
- domínio de produção;
- `http://localhost:8080/**` para desenvolvimento;
- rota `/reset-password` dentro desses domínios.

Remova previews antigos quando não forem mais usados.

## 7. Rate limits e Auth Audit Logs

Revise os limites de:

- cadastro e login;
- recuperação de senha;
- envio de e-mail;
- verificação de tokens;
- tentativas MFA.

Consulte periodicamente os Auth Audit Logs para falhas repetidas, recuperação de senha, alterações de usuário e eventos MFA.

## 8. Sessões

A tela Segurança permite:

- encerrar outras sessões;
- sair de todos os aparelhos;
- pedir troca de senha por e-mail.

Se o plano permitir controle de duração/inatividade, teste primeiro com contas fictícias. Não reduza o JWT para intervalos extremos; alterações de sessão só passam a valer conforme os tokens são atualizados.

## 9. Preferências e consentimentos

A V16 remove escrita direta do navegador em `user_preferences` e `user_consents`.

- o cliente ainda consegue salvar preferências normalmente;
- a função `set_my_preferences` fixa o usuário em `auth.uid()`;
- limita quantidade e tamanho das preferências;
- registra histórico de marketing apenas quando a escolha muda;
- consentimentos não podem ser fabricados por uma inserção direta na API.

## 10. Contas externas

Ative MFA também nas contas que controlam a infraestrutura:

- GitHub;
- Vercel;
- Supabase;
- e-mail administrativo;
- Cloudflare, quando Turnstile/domínio estiverem configurados.
