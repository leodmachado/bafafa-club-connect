# Teste — imagens e validade por minutos

## 1. Banco

Execute uma única vez no SQL Editor do Supabase:

`docs/UPLOADS_AND_MINUTES_SETUP.sql`

Resultado esperado: `Success. No rows returned`.

## 2. Evento com imagem

1. Entre como administrador.
2. Acesse `/admin` e abra **Eventos**.
3. Crie ou edite um evento.
4. Clique em **Escolher imagem** e selecione uma foto do computador ou celular.
5. Salve.
6. Confirme a imagem no painel, na página **Eventos** e na tela **Início**.
7. Edite o evento, troque a foto e confirme que a nova aparece.

## 3. Foto de perfil

1. Acesse **Perfil**.
2. Clique em **Escolher imagem**.
3. Selecione uma foto e salve o perfil.
4. Atualize a página e confirme que a imagem permanece.
5. Teste trocar e remover a foto.

## 4. Campanha com minutos

1. No painel, abra **Campanhas**.
2. Crie uma campanha com validade de `30 minutos`.
3. Salve e confirme que o card mostra `30 min`.
4. Edite para `90 minutos` e confirme que o card mostra `1h 30min`.
5. Teste também `2 horas`.

## Segurança esperada

- Usuário comum não consegue enviar imagem de evento.
- Usuário só consegue enviar e remover arquivos dentro da própria pasta de avatar.
- Imagens aceitas: JPG, PNG, WEBP e GIF, até 10 MB.
