# Bafafá Connect — Roteiro Oficial de Teste do Piloto V20.5

**Projeto:** Bafafá Connect  
**Objetivo:** testar o aplicativo antes do uso com clientes reais  
**Aplicativo:** `[INSERIR LINK DO APLICATIVO]`  
**Canal para relatar problemas:** `[INSERIR WHATSAPP OU FORMULÁRIO]`  
**Responsável pelo teste:** `[NOME DO COORDENADOR]`

---

## 1. Antes de começar

Este não é um teste de conhecimento. O objetivo é descobrir o que está confuso, lento, quebrado ou diferente do esperado.

### Regras importantes

- Use seu próprio telefone e dados verdadeiros somente quando forem necessários ao cadastro.
- Não compartilhe o código recebido por SMS com ninguém.
- Não envie prints mostrando código de acesso, telefone completo ou outros dados pessoais.
- Quando o roteiro pedir teste de moderação, use apenas a expressão de teste fornecida pelo coordenador.
- Leia cada passo, execute uma ação por vez e marque o resultado.
- Mesmo que algo dê errado, continue somente quando o coordenador orientar.

### Identificação do participante

| Informação | Preenchimento |
|---|---|
| Nome | |
| Papel no teste | Cliente / Equipe / Administrador |
| Celular | |
| Sistema | Android / iPhone |
| Navegador | Chrome / Safari / Outro |
| Rede principal | Wi-Fi / 4G / 5G |
| Data e horário | |

### Como marcar

- `[ ]` Ainda não testado
- `[x]` Funcionou como esperado
- `[!]` Funcionou com dificuldade
- `[X]` Não funcionou

---

# PARTE A — TESTE DO CLIENTE

## A1. Cadastro pelo telefone

- [ ] Abra o link do aplicativo.
- [ ] Toque em **Criar cadastro**.
- [ ] Confirme que a opção **Telefone** está selecionada.
- [ ] Tente avançar sem preencher um campo obrigatório.
- [ ] Confirme que aparece uma orientação clara, sem mensagem técnica.
- [ ] Preencha nome, sobrenome, telefone com DDD e nascimento.
- [ ] Confirme que uma pessoa menor de 18 anos não consegue continuar.
- [ ] Confirme que a autorização de marketing começa desmarcada.
- [ ] Tente continuar sem aceitar cada consentimento obrigatório.
- [ ] Abra os Termos de Uso e a Política de Privacidade e depois volte.
- [ ] Marque os consentimentos obrigatórios.
- [ ] Toque em **Receber código**.
- [ ] Confirme que o SMS chega no telefone informado.
- [ ] Digite primeiro um código incorreto.
- [ ] Confirme que o app não entra e mostra uma orientação compreensível.
- [ ] Digite o código correto de seis números.
- [ ] Confirme que o cadastro termina e o aplicativo abre.

**Resultado do cadastro:** ________________________________________________

## A2. Entrada novamente

- [ ] Saia da conta.
- [ ] Volte à tela inicial.
- [ ] Toque em **Entrar** e selecione **Telefone**.
- [ ] Informe o mesmo telefone usado no cadastro.
- [ ] Confirme que um novo código é recebido.
- [ ] Digite o código correto.
- [ ] Confirme que o aplicativo reconhece a mesma conta, sem criar outro perfil.

**Resultado da entrada:** _________________________________________________

## A3. Início e BAFAFEED

- [ ] Abra a tela inicial antes de fazer check-in.
- [ ] Confirme que o BAFAFEED carrega normalmente.
- [ ] Confirme que promoções fixadas aparecem antes das demais.
- [ ] Abra uma promoção e volte para o feed.
- [ ] Abra um link externo, quando houver.
- [ ] Confirme que voltar ao aplicativo não marca uma compra como concluída.
- [ ] Observe se algum texto, botão ou card ficou cortado ou difícil de entender.

**Resultado do feed:** ____________________________________________________

## A4. Check-in por localização

### Fora do Bafafá

- [ ] Com a localização do celular ativada, tente fazer check-in fora da área permitida.
- [ ] Confirme que o app não realiza o check-in.
- [ ] Confirme que aparece uma orientação clara e uma alternativa por QR.

### Dentro do Bafafá

- [ ] Vá até a área indicada pelo coordenador.
- [ ] Permita o acesso à localização precisa.
- [ ] Faça o check-in.
- [ ] Confirme que aparece apenas um check-in.
- [ ] Tente fazer o mesmo check-in novamente.
- [ ] Confirme que ele não é contado duas vezes.
- [ ] Confirme que o aplicativo direciona para a Resenha quando esse fluxo estiver ativo.

**Resultado do check-in:** ________________________________________________

## A5. Check-in alternativo por QR

- [ ] Abra o código de check-in no celular.
- [ ] Peça para a equipe escanear ou digitar o código.
- [ ] Confirme que o nome e a experiência corretos aparecem para a equipe.
- [ ] Gere um novo código e aguarde o vencimento indicado pelo coordenador.
- [ ] Confirme que um código vencido não é aceito.
- [ ] Tente reutilizar um código já utilizado.
- [ ] Confirme que ele não é aceito novamente.

**Resultado do QR:** ______________________________________________________

## A6. Fofoquinhas e utilização

- [ ] Abra a carteira ou a área de Fofoquinhas.
- [ ] Confirme que a promoção mostra nome, benefício e condição de uso.
- [ ] Ative uma Fofoquinha quando o coordenador autorizar.
- [ ] Confirme que o prazo de utilização fica visível.
- [ ] Mostre o QR ou código para a equipe.
- [ ] Confirme que a equipe visualiza o cliente e a promoção corretos.
- [ ] Utilize a promoção.
- [ ] Confirme que ela muda para utilizada e não pode ser usada novamente.
- [ ] Confirme que um produto não participante não recebe desconto.

**Resultado das Fofoquinhas:** ___________________________________________

## A7. Resenha pública

- [ ] Entre na Resenha liberada pelo check-in.
- [ ] Envie uma mensagem normal.
- [ ] Responda a outra mensagem.
- [ ] Atualize a tela e confirme que o histórico permitido permanece.
- [ ] Use a expressão sensível fornecida pelo coordenador.
- [ ] Confirme que a mensagem é bloqueada e não aparece no histórico.
- [ ] Denuncie uma mensagem de teste.
- [ ] Bloqueie outro participante.
- [ ] Confirme que mensagens e interações bloqueadas deixam de aparecer conforme a regra do app.
- [ ] Desbloqueie o participante e observe o comportamento.

**Resultado da Resenha:** _________________________________________________

## A8. Salve e conversa privada

- [ ] Envie um Salve para outro participante.
- [ ] Confirme que a conversa não abre antes da aceitação.
- [ ] O outro participante deve recusar o primeiro Salve.
- [ ] Confirme que nenhuma conversa é aberta.
- [ ] Envie outro Salve e peça para aceitarem.
- [ ] Confirme que a conversa privada abre somente depois da aceitação.
- [ ] Envie uma mensagem normal.
- [ ] Teste a moderação usando a expressão fornecida pelo coordenador.
- [ ] Confirme que o conteúdo bloqueado não aparece.
- [ ] Denuncie uma mensagem privada de teste.
- [ ] Bloqueie o participante.
- [ ] Confirme que a conversa ativa é encerrada conforme a regra do aplicativo.

**Resultado do Salve e conversa:** ________________________________________

## A9. Perfil e privacidade

- [ ] Abra o perfil.
- [ ] Confirme que uma conta nova começa com os campos privados esperados.
- [ ] Ative apenas um campo público.
- [ ] Peça para outro participante abrir seu perfil.
- [ ] Confirme que somente o campo autorizado aparece.
- [ ] Confirme que telefone, nascimento e detalhes internos não aparecem publicamente.
- [ ] Tente salvar o nome de usuário sensível fornecido pelo coordenador.
- [ ] Confirme que ele não é salvo.
- [ ] Salve um nome legítimo.
- [ ] Confirme que o perfil é atualizado normalmente.

**Resultado do perfil:** __________________________________________________

---

# PARTE B — TESTE DA EQUIPE

## B1. Acesso e segurança

- [ ] Entre usando sua conta individual de equipe.
- [ ] Confirme o segundo fator de segurança, quando solicitado.
- [ ] Confirme que a área operacional abre.
- [ ] Tente abrir a administração completa.
- [ ] Confirme que uma conta de equipe não recebe acesso administrativo indevido.

## B2. Validação de check-in

- [ ] Selecione a experiência indicada pelo coordenador.
- [ ] Escaneie o QR do Cliente 01.
- [ ] Confirme nome, experiência e situação do código antes de validar.
- [ ] Valide o check-in.
- [ ] Tente validar o mesmo código novamente.
- [ ] Confirme que o sistema impede duplicidade.
- [ ] Teste um código vencido.
- [ ] Teste um código pertencente a outra experiência.
- [ ] Confirme que o sistema alerta sobre a diferença e não valida silenciosamente o item errado.

## B3. Validação de Fofoquinha

- [ ] Leia o QR de uma Fofoquinha disponível.
- [ ] Confirme o cliente, a campanha e o produto participante.
- [ ] Registre a utilização conforme orientação do coordenador.
- [ ] Confirme que o desconto correto é aplicado.
- [ ] Tente reutilizar a mesma Fofoquinha.
- [ ] Confirme que o segundo uso é bloqueado.
- [ ] Teste uma Fofoquinha vencida.
- [ ] Confirme que ela não pode ser utilizada.

## B4. Registro de problema operacional

- [ ] Registre qualquer código que não foi lido.
- [ ] Registre divergência entre cliente, promoção ou experiência.
- [ ] Registre lentidão superior a dez segundos.
- [ ] Nunca copie token completo, código OTP ou dados pessoais desnecessários.

**Resultado da equipe:** __________________________________________________

---

# PARTE C — TESTE DO ADMINISTRADOR

## C1. Preparação do piloto

- [ ] Confirme que o backup foi concluído.
- [ ] Confirme que o reset operacional foi verificado com `verificacao_ok = true`.
- [ ] Confirme que administradores e equipe continuam com acesso.
- [ ] Confirme que eventos, campanhas, check-ins e conversas começaram zerados.
- [ ] Crie uma experiência de teste com horário, local, raio e check-in ativos.
- [ ] Ative a Resenha durante a janela de teste.
- [ ] Crie uma Fofoquinha vinculada à experiência.
- [ ] Crie uma campanha de marco com três check-ins.
- [ ] Confirme que a campanha começa no horário correto.

## C2. Permissões

- [ ] Confirme que cliente não abre a área da equipe.
- [ ] Confirme que cliente não abre a administração.
- [ ] Confirme que equipe abre apenas as ferramentas operacionais autorizadas.
- [ ] Confirme que administrador usa MFA para operações privilegiadas.
- [ ] Confirme que cada pessoa usa sua própria conta.

## C3. Moderação e suporte

- [ ] Abra a fila de denúncias públicas.
- [ ] Abra a fila de denúncias privadas.
- [ ] Analise uma denúncia de teste.
- [ ] Remova uma mensagem de teste.
- [ ] Encerre uma conversa privada de teste.
- [ ] Confirme que o registro de auditoria é criado.
- [ ] Confirme que nenhuma mensagem bloqueada foi persistida.

## C4. Indicadores do piloto

- [ ] Confira quantidade de cadastros.
- [ ] Confira quantidade de check-ins.
- [ ] Confira Fofoquinhas liberadas, utilizadas e vencidas.
- [ ] Confira mensagens, denúncias e bloqueios.
- [ ] Confira se o mesmo cliente não foi contado duas vezes no mesmo evento.
- [ ] Exporte somente os dados necessários para análise.

**Resultado da administração:** __________________________________________

---

# PARTE D — TESTE OBRIGATÓRIO: CAMPANHAS DE TRÊS CHECK-INS

Este teste confirma que cada campanha começa em zero e não reaproveita visitas anteriores.

## D1. Preparação funcional rápida

O administrador cria seis experiências internas de teste:

- Ciclo A: Teste A1, A2 e A3
- Ciclo B: Teste B1, B2 e B3

A campanha **Ciclo A — 3 check-ins** deve ser criada antes dos check-ins A1, A2 e A3.

## D2. Primeiro ciclo

- [ ] Antes do A1, o Cliente 01 aparece com `0/3`.
- [ ] Após o A1, aparece `1/3`.
- [ ] Repetir o check-in no A1 não altera o progresso.
- [ ] Após o A2, aparece `2/3`.
- [ ] Após o A3, aparece `3/3`.
- [ ] A Fofoquinha é liberada uma única vez.
- [ ] A equipe utiliza a Fofoquinha.
- [ ] O benefício não pode ser utilizado novamente.

## D3. Segundo ciclo

Somente depois da conclusão do Ciclo A, o administrador cria a campanha **Ciclo B — 3 check-ins**.

- [ ] A nova campanha aparece para o mesmo cliente com `0/3`.
- [ ] Os check-ins A1, A2 e A3 não são reaproveitados.
- [ ] Após o B1, aparece `1/3`.
- [ ] Após o B2, aparece `2/3`.
- [ ] Após o B3, aparece `3/3`.
- [ ] A nova Fofoquinha é liberada uma única vez.

## D4. Teste em visitas reais

Depois da simulação funcional, repita a regra em três dias ou sessões reais diferentes. O resultado deve ser o mesmo.

**Resultado da contagem:** ________________________________________________

---

# PARTE E — COMO RELATAR UM PROBLEMA

Registre um problema por vez.

| Campo | Informação |
|---|---|
| Código do problema | EX.: CLI-A4-001 |
| Participante | |
| Papel | Cliente / Equipe / Administrador |
| Data e horário | |
| Aparelho e navegador | |
| Rede | Wi-Fi / 4G / 5G |
| Tela | |
| Passo do roteiro | |
| O que deveria acontecer | |
| O que aconteceu | |
| Conseguiu repetir? | Sim / Não |
| Evidência sem dados sensíveis | |

### Classificação

- **Bloqueador:** impede cadastro, login, check-in, uso ou administração.
- **Grave:** permite ação errada, duplicidade, acesso indevido ou vazamento de informação.
- **Médio:** funciona parcialmente, com erro ou confusão relevante.
- **Leve:** texto, alinhamento, aparência ou melhoria de compreensão.

---

# PARTE F — ENCERRAMENTO

O participante deve responder:

1. Em qual etapa teve mais dificuldade?  
   ______________________________________________________________________

2. Alguma palavra ou botão ficou confuso?  
   ______________________________________________________________________

3. O que você esperava encontrar e não encontrou?  
   ______________________________________________________________________

4. Você usaria este aplicativo durante uma noite no Bafafá? Por quê?  
   ______________________________________________________________________

5. Nota geral de 0 a 10: ______

### Confirmação do participante

- [ ] Concluí as etapas destinadas ao meu papel.
- [ ] Relatei os problemas encontrados.
- [ ] Não compartilhei códigos de acesso nem dados sensíveis.

**Nome:** __________________________________  **Data:** __________________

---

## Critério para liberar o piloto real

O aplicativo não deve ser liberado para clientes reais enquanto existir falha bloqueadora ou grave em:

- cadastro e OTP;
- login e recuperação de acesso;
- check-in e prevenção de duplicidade;
- contagem independente por campanha;
- liberação e utilização de Fofoquinha;
- permissões de cliente, equipe e administrador;
- moderação preventiva;
- privacidade e exposição de dados;
- denúncias, bloqueios e auditoria.
