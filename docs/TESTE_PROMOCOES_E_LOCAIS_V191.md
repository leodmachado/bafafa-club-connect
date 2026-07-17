# BAFAFÁ V19.1 — Teste de promoções gerais e locais

## 1. Promoção geral

1. Entre como administrador com MFA confirmado.
2. Abra Administração → Campanhas → Nova campanha.
3. Selecione **Promoção geral**.
4. Preencha nome, benefício, período e limites.
5. Teste primeiro sem exigir presença.
6. Salve e confirme que aparece no feed durante o período configurado.
7. Edite a campanha, ative **Exigir presença no período** e confirme que ela passa a exigir um check-in válido.

## 2. Local cadastrado

1. Abra Administração → Eventos → Novo evento.
2. Clique em **Novo local**.
3. Com Google Maps configurado, pesquise o estabelecimento e escolha uma sugestão.
4. Sem Google Maps configurado, use **Usar localização atual** ou preencha manualmente.
5. Salve o local.
6. Confirme que ele aparece selecionado no evento.
7. Salve o evento com check-in por localização ativo.
8. Crie outro evento e confirme que o local pode ser reutilizado sem digitar latitude e longitude.

## 3. Google Maps

Variável local e da Vercel:

```env
VITE_GOOGLE_MAPS_API_KEY=CHAVE_RESTRITA
```

A chave deve ser restrita aos domínios do aplicativo e somente às APIs necessárias.
Após alterar variável na Vercel, gere um novo deployment.
