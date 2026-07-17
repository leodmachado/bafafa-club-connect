# Plano de resposta a incidentes — Clube dos Bafafãs

## Prioridades

1. proteger pessoas e dados;
2. impedir que o incidente continue;
3. preservar evidências;
4. restaurar a operação com segurança;
5. documentar causas e correções.

## Exemplos de incidente

- chave ou senha publicada;
- conta administrativa comprometida;
- acesso indevido a dados de clientes;
- exportação não autorizada;
- alteração indevida de papéis;
- perda ou corrupção do banco;
- exclusão de imagens;
- abuso do chat ou do validador;
- malware ou dependência vulnerável explorada.

## Ação imediata

1. não apague logs;
2. registre horário, usuário, tela e ação observada;
3. suspenda a conta ou função afetada;
4. revogue/rotacione o segredo comprometido;
5. encerre sessões quando aplicável;
6. proteja ou pause o deployment afetado;
7. consulte GitHub Actions, Vercel Logs, Supabase Auth Audit Logs, API Logs e a aba Segurança;
8. avalie se o banco precisa ser restaurado.

## Segredo exposto

- revogue primeiro;
- crie um segredo novo;
- atualize Vercel/Supabase;
- gere novo deployment;
- revise o histórico do Git;
- não confie apenas em apagar o arquivo do commit mais recente.

## Conta privilegiada comprometida

- remova temporariamente o papel privilegiado;
- encerre sessões;
- altere senha e MFA;
- revise alterações de papéis, exportações e configurações;
- só devolva o acesso após verificar o aparelho e a conta.

## Suspeita de vazamento de dados

- preserve logs e escopo;
- identifique quais campos e usuários foram afetados;
- interrompa o acesso;
- registre a linha do tempo;
- busque orientação jurídica e de proteção de dados para avaliar comunicações e obrigações.

## Responsáveis

Preencher antes do piloto:

- responsável pelo negócio:
- responsável técnico:
- responsável pela comunicação:
- contato jurídico/proteção de dados:
- canal de emergência:

## Pós-incidente

- causa raiz;
- impacto;
- dados afetados;
- correção imediata;
- correção preventiva;
- responsável;
- prazo;
- evidência de conclusão.
