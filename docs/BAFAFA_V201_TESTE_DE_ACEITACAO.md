# Teste de aceitação V20.1

## 1. Feed sem check-in

1. Entre com uma conta que ainda não fez check-in no evento atual.
2. Abra o Início.
3. Confirme que eventos, publicações e Fofoquinhas carregam sem o erro `record "v_next_stage" is not assigned yet`.
4. Confirme que existe uma chamada para check-in quando houver evento atual.

## 2. Feed depois do check-in

1. Faça o check-in.
2. Volte ao Início.
3. Confirme que a jornada, o progresso e a Resenha aparecem.
4. No card do evento atual, confirme que aparece `Presença confirmada` e não um novo botão de check-in.

## 3. Posição de publicação

1. No Backoffice, abra Feed do Bafafá.
2. Edite a publicação de teste.
3. Escolha `Colocar no topo` e salve.
4. Atualize o feed e confira a posição.
5. Repita com `Depois dos eventos`.

## 4. Fofocômetro no feed

1. Ative uma meta para o evento atual.
2. Abra o Início.
3. Confirme a exibição do card `Meta da galera` com contagem, barra e percentual.
4. Valide uma Fofoquinha que conta para a meta.
5. Atualize o feed e confirme o avanço.

## 5. Fofocômetro no evento

1. Abra Eventos.
2. Expanda o evento vinculado à meta.
3. Confirme que o mesmo progresso aparece nos detalhes.

## 6. Tela pública

1. Abra `/fofocometro/ID_DO_EVENTO`.
2. Confirme que a tela encontra a meta e não fica no estado vazio quando há uma meta cadastrada.
