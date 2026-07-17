# Teste de aceitação da V20.0

Faça o teste com um evento ativo, um usuário cliente e um usuário com papel de equipe ou admin.

## 1. Banco e acesso

1. Execute o SQL de instalação.
2. Execute o SQL de verificação.
3. Confirme que todos os campos da primeira consulta aparecem como `true`.
4. Ative o provedor Phone no Supabase ou mantenha o e-mail de teste durante a validação inicial.

## 2. Cadastro

1. Cadastre um cliente pelo telefone.
2. Confirme que o perfil recebe nome, telefone, data de nascimento e consentimento.
3. Confirme que o segmento inicial aparece como Bafafã novo.

## 3. Produto

1. Cadastre um produto no painel comercial.
2. Informe preço e custo.
3. Edite o preço com um motivo.
4. Confirme que o histórico foi criado e que o valor anterior permaneceu registrado.

## 4. Funil

1. Abra Admin, CRM e vendas, Funil.
2. Selecione o evento.
3. Configure os três marcos, percentuais, limites, produto ou categoria e prazos.
4. Confirme no SQL de verificação que três etapas foram criadas.

## 5. Check-in e primeira Fofoquinha

1. Faça check-in pelo celular dentro da área autorizada.
2. Meça o tempo entre o toque no botão e a confirmação.
3. Confirme que a Resenha foi liberada.
4. Confirme que a primeira Fofoquinha aparece sem aprovação da equipe.

## 6. Compra e desconto

1. Abra a carteirinha digital do cliente.
2. No modo equipe, leia o QR.
3. Adicione um produto elegível.
4. Registre a compra.
5. Confirme valor bruto, desconto real, valor líquido, custo e margem.
6. Tente usar o mesmo QR novamente e confirme que ele é recusado.

## 7. Marcos

1. Registre compras até alcançar o segundo marco.
2. Confirme o progresso em reais no feed.
3. Confirme a liberação do Babado Forte.
4. Alcance o terceiro marco.
5. Confirme a Fofoquinha para a próxima visita.

## 8. Cancelamento e estorno

1. Cancele ou estorne uma venda no painel.
2. Confirme que o consumo líquido diminuiu.
3. Confirme que um marco perdido foi revertido e a recompensa disponível foi revogada.

## 9. Fofocômetro

1. Ative uma meta coletiva no painel.
2. Valide uma Fofoquinha marcada para o Fofocômetro.
3. Confirme que o placar aumentou uma unidade.
4. Confirme que mensagens da Resenha não alteram o placar.

## 10. Resenha e salve

1. Envie um salve para outro participante.
2. Confirme que a conversa não abre antes da resposta.
3. Aceite com Dar moral.
4. Abra a conversa privada e envie uma mensagem.
5. Teste denúncia e bloqueio.

## 11. Avaliação e retorno

1. Encerre o evento.
2. Entre novamente no feed do cliente.
3. Envie uma avaliação.
4. Confirme a avaliação no painel comercial.
5. Teste o benefício futuro em outro evento.

## Resultado esperado

A versão está pronta para produção quando o SQL estiver validado, o build terminar sem erros e todos os fluxos acima funcionarem em celular sem orientação da equipe.
