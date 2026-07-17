# Teste da V17 — aplicação, navegador e uploads

## 1. Banco e Storage

1. Execute `docs/BAFAFA_APLICACAO_NAVEGADOR_V17_SETUP.sql` no Supabase.
2. Execute `docs/VERIFICAR_APLICACAO_NAVEGADOR_V17.sql`.
3. Confirme:
   - `avatars`: 1.572.864 bytes e somente `image/webp`;
   - `event-images`: 3.145.728 bytes e somente `image/webp`;
   - quatro triggers de proteção ativos;
   - três funções de proteção existentes.

## 2. Upload de perfil

1. Entre como cliente.
2. Tente selecionar GIF, SVG, PDF ou imagem maior que 8 MB: deve ser recusado.
3. Selecione JPG/PNG/WEBP válido e salve.
4. No Storage, confirme que o novo arquivo termina em `.webp`.
5. Confirme que a imagem continua após atualizar a página.
6. Edite o perfil novamente sem trocar a foto: deve salvar normalmente, inclusive para fotos antigas.

## 3. Upload de evento

1. Entre como administrador com MFA confirmado.
2. Crie ou edite um evento com JPG/PNG/WEBP.
3. Confirme que o arquivo novo termina em `.webp` e fica dentro de `event-images/events/`.
4. Uma conta comum não deve conseguir enviar arquivo para `event-images` pela API.

## 4. Erros públicos

1. Desconecte temporariamente a rede e abra uma tela de dados.
2. A interface deve mostrar mensagem genérica, sem nome de tabela, função, código PGRST, SQL ou stack trace.
3. Em desenvolvimento, o console ainda pode conter detalhes para diagnóstico; em produção, não há envio automático à Lovable.

## 5. Cache e privacidade

1. Faça login, abra Perfil e depois faça logout.
2. Use o botão Voltar do navegador: dados privados não devem reaparecer de um cache antigo.
3. Em uma janela anônima, `/admin`, `/perfil` e `/staff/checkin` devem exigir autenticação.

## 6. Cabeçalhos na Vercel

Depois do push e do deployment Ready:

```bash
npm run security:headers -- https://SEU-ENDERECO.vercel.app
```

Também é possível abrir DevTools → Network → documento HTML → Response Headers.
Confirme CSP, HSTS, `nosniff`, bloqueio de iframe, Permissions-Policy, noindex e `Cache-Control: no-store`.

## 7. CSP

Teste:

- login e logout;
- Turnstile, se configurado;
- carregamento das fontes;
- imagens do Supabase;
- câmera do QR;
- Realtime da Resenha;
- preview da Vercel.

Se o navegador registrar violação de CSP e uma função legítima parar, não remova a CSP inteira. Acrescente somente a origem necessária após confirmar que ela é confiável.

## 8. GitHub Actions

Após o push, abra **GitHub → Actions → Build e segurança**.
O workflow deve concluir:

- instalação reproduzível pelo `bun.lock`;
- build de produção;
- auditoria de dependências de produção, falhando para vulnerabilidades altas ou críticas.

Não faça merge quando o workflow estiver vermelho. Abra o log para identificar se a falha veio do build ou de uma dependência vulnerável.
