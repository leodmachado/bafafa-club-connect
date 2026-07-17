# Bafafá Connect V20.2

## Objetivo

Simplificar a experiência pública para quatro áreas: Início, Fofoquinhas, Resenha e Perfil. A Agenda fica preservada tecnicamente, mas oculta do cliente até a futura reformulação.

## Arquitetura adotada

O check-in e a Resenha passam a usar uma Sessão da Casa. Ela é cadastrada no painel administrativo e utiliza internamente a tabela de eventos, sem ser apresentada como evento para o cliente.

A Sessão da Casa controla:

- período de funcionamento;
- abertura e encerramento do check-in;
- abertura e encerramento da Resenha;
- localização e raio permitido;
- histórico de presença e moderação;
- vínculo interno com o Fofocômetro.

O banco impede duas Sessões da Casa sobrepostas. Isso garante uma única referência operacional para o aplicativo.

## Navegação pública

A barra inferior contém:

1. Início
2. Fofoquinhas
3. Resenha
4. Perfil

A rota antiga da Agenda redireciona para o Início. Os dados e o painel de eventos continuam preservados para uma versão futura.

## Início

O feed funciona mesmo sem check-in ou Sessão da Casa ativa. Ele pode exibir:

- publicações da equipe;
- chamada contextual para check-in;
- Fofoquinhas gerais;
- missões e marcos;
- progresso do Fofocômetro;
- chamada para completar a carteirinha.

As Fofoquinhas possuem ordem editorial manual. Sem ordem manual, o sistema usa:

1. promoção geral;
2. missão ou marco do cliente;
3. promoção vinculada a evento.

Enquanto a Agenda estiver oculta, promoções de evento não aparecem para clientes.

A visibilidade no Início é independente da visibilidade na área Fofoquinhas. Retirar uma campanha do Início não remove a vantagem da carteira do cliente.

## Links externos

Cada campanha pode ser configurada para:

- validação pelo aplicativo;
- compra em site externo;
- as duas opções.

O clique externo é registrado por campanha, cliente, origem e horário. O painel mostra a quantidade de cliques. A confirmação da venda depende de integração futura com o site externo.

## Check-in

O check-in público aceita somente a Sessão da Casa atual. Após confirmação por localização, o cliente é direcionado à Resenha.

No QR alternativo, o aplicativo verifica a confirmação periodicamente. Depois que a equipe validar, o cliente também é direcionado automaticamente à Resenha.

## Resenha

A Resenha mantém as regras existentes de denúncia, bloqueio, silenciamento, moderação, salves e consentimento para conversa privada.

A tela diferencia:

- casa fechada;
- sessão aberta sem check-in;
- check-in confirmado antes da abertura da conversa;
- Resenha ao vivo;
- Resenha encerrada.

## Correção da ativação

A função de QR foi corrigida para eliminar a ambiguidade da coluna `expires_at`. A referência agora usa explicitamente o registro da recompensa, evitando o erro `column reference expires_at is ambiguous`.

## Banco de dados

Esta versão exige execução do SQL do Supabase. O frontend novo depende das colunas, funções, tabela de cliques e gatilhos incluídos na migration V20.2.
