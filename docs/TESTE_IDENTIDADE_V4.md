# Teste — Identidade Bafafá v4

## 1. Atualização do banco

Execute uma única vez no SQL Editor do Supabase:

`docs/BRAND_V4_SETUP.sql`

Resultado esperado:

`Success. No rows returned`

## 2. Reinício local

Pare o servidor com `Ctrl + C` e inicie novamente:

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run dev
```

Abra `http://localhost:8080`.

## 3. Revisão das telas do cliente

Verifique:

- autenticação com logo oficial;
- Início com próximo evento, foto e campanha;
- Eventos com cards em estilo de flyer;
- Check-in com seletor e código temporário;
- Mimos com formato de cupom/ticket;
- Perfil com foto, nome, selos, título, progresso e formulário.

## 4. Selo Sócio Fundador

1. Entre como administrador.
2. Abra `/admin`.
3. Acesse Clientes.
4. Localize um usuário.
5. Clique em **Conceder Sócio Fundador**.
6. Abra o perfil desse usuário.
7. Confirme que a coroa aparece ao lado do nome e na coleção de selos.
8. Confirme que o título **Sócio Fundador** pode ser selecionado.
9. Volte ao admin e remova o selo.
10. Confirme que selo e título foram retirados.

O cliente não deve conseguir conceder o próprio selo.

## 5. Perfil público

1. No perfil, defina um nome de usuário.
2. Ative a visibilidade pública.
3. Salve.
4. Abra uma janela anônima em `/u/<username>`.
5. Confirme que aparecem apenas informações autorizadas.

Nunca devem aparecer no perfil público:

- telefone;
- e-mail;
- data de nascimento;
- bairro;
- preferências privadas;
- check-ins;
- histórico de mimos.

## 6. Responsividade

Teste ao menos nas larguras aproximadas:

- 360 px;
- 390 px;
- 768 px;
- desktop.

Confira especialmente a barra inferior, o botão central de check-in e o recorte das fotos.
