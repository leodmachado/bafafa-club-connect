# Roadmap de segurança — Clube dos Bafafãs

## V15 — Segurança do banco (entregue neste pacote)

- privilégio mínimo nas tabelas sensíveis;
- atualização de perfil por coluna;
- auditoria protegida;
- equipe operacional sem acesso bruto;
- funções auxiliares sem enumeração de terceiros;
- roteiro de verificação pós-migration.

## Próxima etapa — Autenticação e contas privilegiadas

- reativar confirmação de identidade antes do piloto;
- recuperação de senha validando evento `PASSWORD_RECOVERY`;
- confirmação de senha e encerramento de outras sessões;
- MFA TOTP obrigatório para administradores;
- CAPTCHA em cadastro, login e recuperação;
- política de senha e proteção contra senhas vazadas;
- revisão de duração das sessões.

## Etapa seguinte — Aplicação, uploads e navegador

- cabeçalhos de segurança e CSP;
- mensagens de erro sem detalhes internos;
- limites de formulários no frontend e no banco;
- imagens sem GIF, tamanho menor e processamento para remover metadados;
- política de cache para telas sensíveis;
- retirada da telemetria da Lovable em produção.

## Infraestrutura e operação

- MFA no GitHub, Supabase e Vercel;
- proteção da branch `main`;
- previews privados durante a auditoria;
- backups e teste de restauração;
- inventário de segredos e acessos;
- alertas de falha de QR e autenticação.

## Teste de invasão por papel

Executar como visitante, cliente, equipe, moderador e administrador, tentando
ler ou modificar dados que aquele papel não deveria acessar. O piloto público
só deve começar depois dessa matriz passar sem falhas críticas ou altas.
