# Teste de aceitação — piloto V20.4.2

Use duas contas adultas de teste e dois celulares reais. Não use dados de clientes sem autorização.

## 0. Transparência e privacidade

1. Abra `/privacidade` sem estar autenticado.
2. Confirme Bafafa Gastrobar LTDA, CNPJ 39.715.843/0001-00 e `bafafa.bar@gmail.com`.
3. Confirme que o link de contato abre um novo e-mail com assunto de privacidade.
4. Confira os critérios de 24 meses, 180 dias e retenções legais de até cinco anos.
5. Entre numa conta legada e confirme que o perfil começou privado, podendo ser publicado novamente.

## 1. Preparação

1. Confirme backup recente do Supabase.
2. Confirme que uma Sessão da Casa de teste tem início, fim, local, raio, check-in e Resenha ativos.
3. Deixe uma Fofoquinha geral e uma missão publicadas.
4. Deixe a Agenda oculta.
5. Abra o app em rede móvel e Wi-Fi.

## 2. Cadastro e consentimento

1. Abra o cadastro por telefone.
2. Confirme que marketing começa desmarcado.
3. Tente continuar sem cada consentimento obrigatório; o app deve orientar sem mensagem técnica.
4. Abra Termos, Privacidade e Comunidade e volte ao cadastro.
5. Tente nascimento de menor de 18 anos; o cadastro deve ser impedido.
6. Cadastre um adulto e valide o OTP real.
7. Repita o essencial por e-mail.
8. Nos dois cadastros, tente um nome da lista interna de moderação; o envio deve ser bloqueado antes
   da criação da conta e sem mensagem técnica.

## 3. BAFAFEED e Fofoquinhas

1. Confirme que o BAFAFEED abre mesmo sem check-in.
2. Confirme que Agenda/Eventos não aparece na navegação.
3. Confirme a ordem editorial de Fofoquinhas.
4. Abra um link externo e verifique a mensagem: o app registra apenas o clique.
5. Volte ao app e confira que nenhuma compra foi marcada como concluída.

## 4. Check-in e Resenha

1. Fora do raio, confirme orientação segura e alternativa por QR.
2. Dentro do raio, faça check-in e confirme redirecionamento imediato para a Resenha.
3. Confirme que nenhuma tela do cliente mostra “evento” ou “Sessão da Casa” nesse fluxo.
4. Envie, responda, denuncie e bloqueie uma mensagem pública.
5. Confirme que a conversa fecha no horário configurado e o histórico permitido permanece legível.
6. Tente um palavrão direto, uma forma com pontos entre as letras e uma forma com números. As três
   mensagens devem ser bloqueadas e não podem aparecer no histórico.

## 5. Salve e conversa privada

1. Conta A envia um salve; a conversa não deve abrir ainda.
2. Conta B recusa; nada deve abrir.
3. Envie novamente e aceite; somente então abra a conversa.
4. Tente envio rápido repetido; o limite deve interromper abuso.
5. Denuncie uma mensagem recebida e confirme a fila no painel.
6. No painel, remova a mensagem, encerre a conversa e teste o descarte em denúncias separadas.
7. Bloqueie a outra conta; a conversa ativa deve encerrar e não reabrir ao desbloquear.
8. Repita o teste de moderação no quebra-gelo do salve e na conversa privada.

## 6. Perfil e acessibilidade

1. Confirme que uma conta nova começa com perfil público fechado.
2. Ative um campo por vez e confira o perfil público em outro celular.
3. Confirme que telefone, nascimento, bairro e detalhes de presença não aparecem.
4. Tente salvar um `@` ofensivo, inclusive com substituição de letras por números; o Perfil deve
   orientar e não salvar.
5. Salve um nome legítimo contendo uma sequência parecida, como `computador`; ele não deve ser
   bloqueado.
6. Navegue somente com teclado: foco deve ser visível.
7. Ative “reduzir movimento” no aparelho e confirme que animações são reduzidas.
8. Verifique texto e botões em largura de 320 px e com zoom de 200%.

## 7. Critério de saída

O piloto não deve começar com falha em cadastro, OTP, check-in, RLS, moderação preventiva, bloqueio,
denúncia, privacidade, contraste crítico ou navegação pública. Registre qualquer falha com horário,
conta de teste, aparelho, rede, tela e resultado esperado — sem anexar tokens, o texto ofensivo
completo ou dados pessoais desnecessários.
