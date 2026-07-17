# Bafafá Connect V20.1

## Objetivo

Corrigir a falha do feed para clientes sem check-in, tornar o posicionamento das publicações compreensível para a equipe e levar o Fofocômetro para a experiência do cliente.

## Entregas

### Feed resiliente

- Corrige a função `my_event_journey`, que tentava acessar `v_next_stage` antes de o registro ser inicializado.
- O feed público continua carregando mesmo quando um módulo personalizado, como jornada ou Fofocômetro, estiver temporariamente indisponível.
- O botão de check-in só aparece no evento que está acontecendo agora.
- Depois do check-in, o card do evento mostra `Presença confirmada` em vez de repetir o botão.

### Posicionamento editorial

O campo numérico `Prioridade` saiu da interface administrativa. A equipe escolhe uma posição legível:

- Colocar no topo
- Depois das Fofoquinhas
- Depois do evento de hoje
- Depois dos eventos
- No final do feed

A opção `Mostrar primeiro nesta posição` organiza apenas publicações que compartilham o mesmo lugar do feed.

### Fofocômetro para clientes

- Card de progresso no feed durante o evento atual.
- Card dentro dos detalhes do evento atual ou futuro.
- Contagem, percentual, quantidade restante e recompensa coletiva.
- Chamada para acessar as Fofoquinhas que ajudam a completar a meta.
- Correção do retorno da função pública usada pela tela de televisão.

## Banco de dados

Esta versão exige a migration:

`supabase/migrations/20260727120000_feed_resiliente_fofocometro_v201.sql`

Para aplicação manual no Supabase, use:

`docs/BAFAFA_FEED_FOFOCOMETRO_V201_SETUP.sql`
