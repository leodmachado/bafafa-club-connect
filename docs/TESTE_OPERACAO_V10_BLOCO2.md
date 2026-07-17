# BAFAFÁ — V10 Bloco 2: roteiro de teste operacional

## Antes de abrir o app

1. Execute `BAFAFA_OPERACAO_V10_BLOCO2_SETUP.sql` no SQL Editor do Supabase uma única vez.
2. Como foram adicionadas bibliotecas de QR, execute `bun install` antes de iniciar esta versão.
3. Inicie com `bun run dev`.
4. A câmera funciona em `localhost` ou em site publicado com HTTPS. Em endereço de rede `http://192.168...`, o navegador pode bloquear a câmera; nesse caso, use o código manual ou teste o site publicado.

## 1. Eventos

- Crie um evento como **Rascunho**: ele não pode aparecer no app do cliente.
- Abra **Prévia** e confira imagem, data, atração e textos.
- Clique em **Publicar**: o evento deve aparecer no app.
- Clique em **Duplicar**: deve surgir uma cópia sete dias depois, em rascunho. Campanhas copiadas ficam pausadas.
- Teste uma data de encerramento anterior à abertura do check-in: o formulário e o banco devem bloquear.
- Clique em **Fechar check-in**: novos códigos não podem ser gerados.

## 2. QR pela câmera

- Entre como equipe/admin em `/staff/checkin`.
- No celular do cliente, gere o check-in. Agora aparecem QR e seis números.
- No celular da equipe, abra a câmera e permita o acesso.
- Escaneie o QR: deve vibrar/emitir som discreto e mostrar o cliente.
- Tente escanear novamente: deve informar check-in duplicado, sem criar outro.
- Teste o modo **Digitar** com os seis números.

## 3. Campanhas e mimos

- Crie campanha com limite total e validade curta, por exemplo 10 minutos.
- Confira a prévia.
- Faça check-in e confirme os contadores: liberado e disponível.
- Pause a campanha: novos check-ins não devem liberar o mimo.
- Reative e valide outro usuário.
- No app do cliente, clique em **Usar meu mimo**. Deve aparecer confirmação antes de gerar QR.
- Escaneie o QR no modo Mimo da equipe.
- Confira o contador de utilizados e o histórico do funcionário.
- Aguarde um mimo vencer e reabra Mimos: ele deve ir para Expirados.

## Resultado esperado

- Nenhum rascunho é visível ao público.
- Check-ins e resgates não duplicam.
- QR não contém nome, telefone ou nascimento: somente token temporário.
- Código manual continua disponível quando a câmera falha.
- Histórico e métricas preservam os registros após encerrar eventos ou campanhas.
