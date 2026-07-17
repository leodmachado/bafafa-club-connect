# Bafafá Connect V20.0

## Objetivo da versão

A V20 reorganiza o aplicativo em torno de cinco pilares: CRM, Fofoquinhas, agilidade, validação e comunidade. A jornada principal passa a conectar cadastro, check-in, benefício, compra, progresso por consumo líquido, Resenha, avaliação e retorno.

## O que foi implementado

### Cadastro e CRM

- Cadastro e entrada por telefone com código SMS, condicionado à ativação do provedor Phone no Supabase.
- E-mail mantido como alternativa temporária para testes.
- Nome, sobrenome, telefone, nascimento e consentimento de marketing.
- Perfil comercial com primeiro e último check-in, visitas, consumo líquido, última compra e segmento atual.
- Segmentos automáticos: Bafafã novo, Bafafã recorrente, Sumido da Resenha, Aniversariante, Presença Garantida, Caçador de Fofoquinha e Fofoqueiro Oficial.

### Jornada e feed

- Feed adaptado ao estado do cliente antes e depois do check-in.
- Destaque de evento, check-in, Fofoquinha, progresso, Resenha e avaliação.
- Uma ação principal por card.
- Cópias revisadas para manter a linguagem jovem, inclusiva e coerente com o samba e o pagode.

### Produtos e histórico

- Catálogo de produtos com nome normalizado para evitar duplicidades.
- Criação automática de produto quando um nome novo é utilizado em promoção.
- Preço de venda, custo, categoria, elegibilidade, regras de funil e Fofocômetro.
- Histórico de alterações com valor anterior, novo valor, responsável, data e motivo.
- Preço e custo ficam congelados em cada item de venda, preservando o histórico.

### Funil de consumo

- Regras por evento configuráveis no painel.
- Etapa 1 por check-in.
- Etapa 2 por consumo líquido, com padrão de R$ 50.
- Etapa 3 por consumo líquido, com padrão de R$ 100 e benefício para o retorno.
- Percentuais, limites, marcos, produto, categoria, prazo para ativação, prazo de uso e validade futura configuráveis.
- Cancelamentos e estornos recalculam o progresso e revogam benefícios que deixaram de ser elegíveis.

### Venda e validação

- Carteirinha digital com QR e código numérico temporários.
- QR específico para ativação de Fofoquinha.
- Operação da equipe com leitura de cliente, seleção de produtos, quantidade, preço e custo.
- Cálculo de valor bruto, desconto real, valor líquido, custo e margem.
- Código marcado como utilizado somente após a transação ser concluída.
- Proteção contra reutilização do QR.

### Fofocômetro

- Metas coletivas por evento.
- Contagem somente de Fofoquinhas efetivamente validadas no consumo.
- Tela pública para televisão em `/fofocometro/ID_DO_EVENTO`.
- Receita, desconto, custo e margem ligados às contribuições do placar.

### Resenha e consentimento

- Resenha exclusiva para clientes com check-in.
- Solicitação de conversa por “Mandar um salve”.
- Conversa privada somente depois de “Dar moral”.
- Denúncia, bloqueio e moderação preservados.

### Painel administrativo

- Visão geral comercial.
- CRM.
- Produtos.
- Funil.
- Vendas e estornos.
- Fofocômetro.
- Avaliações.
- Indicador principal: margem dos itens extras vendidos nas compras que utilizaram Fofoquinha.

## Limites externos desta versão

O SMS depende da ativação do provedor de telefone no Supabase e de um fornecedor de envio compatível com o projeto. O fluxo por WhatsApp poderá usar a mesma experiência quando um provedor oficial estiver integrado.

A integração automática com a Zig não foi ativada porque depende de credenciais, documentação da API e regras de conciliação que não estavam disponíveis. A V20 entrega a operação manual por QR e deixa a estrutura preparada para importação ou integração futura.

Os tempos de check-in abaixo de oito segundos e validação abaixo de três segundos precisam ser medidos no ambiente real, com celular, internet e Supabase de produção. A arquitetura evita aprovações manuais, mas a latência final depende desses serviços.
