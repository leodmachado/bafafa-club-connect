# BAFAFÁ v9 — Bloco 1: Correções e experiência

Antes dos testes, execute uma única vez `docs/EXPERIENCIA_V9_BLOCO1_SETUP.sql` no SQL Editor do Supabase. O script mantém a Resenha em modo somente leitura por até 48 horas após o encerramento.

## 1. Home

- Abra `/inicio` em uma tela larga e em um celular pequeno.
- Confirme que “Chegue mais, Bafafã” aparece como etiqueta separada, sem encostar na saudação.
- Confirme que nomes longos, evento, campanha e selo recente não ultrapassam os cards.
- Simule perda de conexão e confirme que aparece a opção “Tentar novamente”.

## 2. Check-in

Teste um evento em cada situação:

- antes da abertura: mostra “Ainda não abriu” e contagem regressiva;
- durante a janela: mostra “Check-in liberado”, encerramento e botão de gerar código;
- depois do fechamento: mostra “Check-in encerrado”;
- depois da validação: mostra “Presença confirmada”, atalho para Mimos e, quando ativa, Resenha.

Use o botão de atualizar no topo e o botão “Já validaram?” após gerar o código.

## 3. Perfil

- Confirme o carregamento e o tratamento de erro.
- Deixe um campo obrigatório incompleto e use “Completar agora”.
- O app deve rolar até o próximo campo pendente.
- Preencha todos os dados, salve e confirme 100% e o selo Perfil no Grau.
- Confirme que os selos continuam sem duplicação.

## 4. Resenha

- Abra a sala com duas contas.
- Envie mensagens e confirme a diferença visual entre mensagem própria e de terceiros.
- Role para cima em uma conta e envie uma nova mensagem na outra: deve aparecer o botão de novas mensagens, sem puxar a tela à força.
- Toque no botão para voltar ao fim.
- Teste resposta, apagar, denunciar e bloquear.
- Configure o encerramento da sala e confirme que o campo de envio é substituído por “Resenha encerrada”.
- Confirme que o número exibido é de participantes que já escreveram na conversa, sem expor dados privados.

## Resultado esperado

Os fluxos existentes continuam funcionando. A migration nova altera somente a leitura da Resenha encerrada, sem apagar mensagens. Mantenha o Pull Request aberto até concluir o teste em celular e computador.
