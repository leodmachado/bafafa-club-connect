# Bafafá Connect V20.3

## Design system e padronização visual

Esta versão atua somente na camada visual e de experiência do cliente. Rotas, autenticação, banco de dados, regras de negócio, check-in, Fofoquinhas, Resenha e Perfil continuam usando os fluxos da V20.2.

## Código visual por categoria

| Categoria   | Cor principal | Textura              | Uso                              |
| ----------- | ------------- | -------------------- | -------------------------------- |
| Novidades   | Laranja       | Xadrez claro         | Publicações editoriais do Bafafá |
| Fofoquinhas | Amarelo       | Recortes geométricos | Promoções e vantagens liberadas  |
| Missões     | Turquesa      | Grade e pontos       | Progresso e marcos do cliente    |
| Resenha     | Roxo noturno  | Pontos e luzes       | Conversa, presença e interação   |
| Perfil      | Azul          | Faixas diagonais     | Identidade e carteirinha         |
| Check-in    | Verde         | Grade clara          | Entrada, presença e liberação    |

A cor nunca deve ser o único indicador. Cada categoria também mantém etiqueta, ícone, título e estrutura próprios.

## Alterações de interface

- O cabeçalho do Início passa a usar o nome `BAFAFEED`.
- A saudação é escolhida de forma determinística a cada novo login.
- O endereço foi retirado do cabeçalho do Início.
- A logo ganhou tratamento de placa, com contorno, sombra e pontos de fixação.
- Novidades usam o padrão visual laranja.
- Promoções gerais usam amarelo.
- Missões usam turquesa.
- Check-in usa verde.
- Chamadas da Resenha usam roxo noturno.
- Chamadas do Perfil usam azul.
- A Resenha ganhou cabeçalho, sala, balões, compositor e modais próprios.
- A carteirinha e as configurações do Perfil ganharam linguagem visual de identidade.
- Os campos suspensos do Perfil ganharam seta, separador, sombra e foco padronizados.
- A navegação inferior agora reforça a cor de cada área.

## Arquivos alterados

- `src/styles.css`
- `src/components/layout/bottom-nav.tsx`
- `src/routes/_authenticated/inicio.tsx`
- `src/routes/_authenticated/mimos.tsx`
- `src/routes/_authenticated/resenha.tsx`
- `src/routes/_authenticated/perfil.tsx`

## Banco de dados

Esta versão não altera o Supabase. Nenhuma migration ou consulta SQL deve ser executada.
