# Moderação preventiva de conteúdo — V20.4.2

## Objetivo

Impedir que nomes, nomes de usuário, mensagens da Resenha, salves e conversas privadas publiquem
palavrões, conteúdo sexual explícito ou ataques racistas, homofóbicos e transfóbicos.

## Como funciona

1. O aplicativo consulta a moderação antes de enviar e orienta a pessoa sem repetir o termo ofensivo.
2. O Supabase repete a validação por gatilho, inclusive se alguém tentar ignorar a interface.
3. Maiúsculas, acentos, repetições, separadores e substituições comuns por números ou símbolos são
   normalizados antes da comparação.
4. A lista fica no schema privado e não pode ser consultada por visitantes ou clientes autenticados.
5. Conteúdo bloqueado não é inserido nas tabelas do aplicativo.

## Escopo protegido

- nome no cadastro por telefone ou e-mail;
- nome público e `@` editados no Perfil;
- mensagem pública da Resenha;
- quebra-gelo do salve;
- mensagem de conversa privada.

## Decisões de segurança e produto

- A barreira automática usa correspondências de alta confiança. Palavras legítimas que apenas contêm
  uma sequência curta não devem ser bloqueadas; o roteiro verifica explicitamente esse caso.
- Denúncia, bloqueio, silenciamento e moderação humana continuam ativos. Contexto, ironia, novas gírias
  e disfarces criativos não podem ser resolvidos somente por uma lista.
- Não foi adicionada moderação por inteligência artificial neste piloto. Ela aumentaria custo, latência,
  compartilhamento de texto com outro fornecedor e complexidade operacional antes de haver volume real.
- Novos termos devem entrar por migration revisada, com categoria, teste de falso positivo e script de
  verificação. Não editar a lista diretamente em produção.

## Operação

Se uma expressão ofensiva escapar:

1. a pessoa afetada denuncia e pode bloquear o autor;
2. a moderação remove a mensagem ou encerra a conversa;
3. a equipe registra somente a categoria e o contexto necessários;
4. o termo normalizado entra em uma migration posterior, depois de testar nomes e palavras legítimas.

Se uma expressão legítima for bloqueada, não libere toda a categoria. Desative apenas o termo causador
em nova migration e acrescente um caso de regressão ao script de verificação.

## Limitação conhecida

Tentativas bloqueadas são descartadas na mesma transação e não entram no histórico. Isso reduz a
retenção de conteúdo ofensivo e a exposição de dados, mas ainda não oferece métrica de tentativas. Se o
piloto indicar necessidade operacional real, essa métrica deve registrar apenas usuário, categoria,
contexto e horário — nunca o texto completo.
