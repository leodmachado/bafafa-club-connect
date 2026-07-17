# Teste — V11 Bloco 3: Gestão, métricas e piloto

## Pré-requisitos

1. A V10 deve abrir normalmente nas rotas `/checkin`, `/mimos` e `/staff/checkin`.
2. As dependências `qrcode.react` e `@zxing/browser` precisam estar instaladas (`bun install`).
3. Execute `BAFAFA_GESTAO_V11_BLOCO3_SETUP.sql` no Supabase e confirme `Success. No rows returned`.

## 1. Painel de métricas

1. Entre como administrador e abra `/admin`.
2. Clique em **Gestão e piloto**.
3. Troque o período entre 7, 30, 90 dias e todo o período.
4. Filtre por um evento.
5. Confira:
   - cadastros;
   - perfis mínimos e completos;
   - check-ins únicos;
   - clientes recorrentes;
   - mimos liberados e usados;
   - participantes e mensagens da Resenha.

> As métricas visuais usam até 1.000 registros por conjunto, suficiente para o piloto. As exportações são montadas no banco e não usam esse limite da tela.

## 2. Exportações

1. No bloco **Exportar CSV**, clique em Clientes.
2. Confirme o aviso de dados pessoais.
3. Abra o CSV no Excel ou Google Planilhas.
4. Repita para Check-ins, Campanhas e Eventos.
5. Abra **Auditoria** e confirme o registro `admin_export`.

Os arquivos usam ponto e vírgula e BOM UTF-8 para abrir corretamente no Excel em português.

## 3. Configuração do piloto

1. Clique em **Nova configuração**.
2. Escolha evento e campanha.
3. Defina público esperado e metas.
4. Escolha ao menos uma pessoa com papel de equipe ou administrador.
5. Preencha o roteiro de comunicação e notas internas.
6. Salve.
7. Resolva o checklist operacional.
8. Marque como pronto.
9. Ative a campanha na aba Campanhas.
10. Inicie o piloto.

A seleção de equipe é uma escala operacional e não muda as permissões. As permissões continuam sendo gerenciadas na aba **Equipe**.

## 4. Metas

Ao selecionar um ciclo salvo, o filtro de evento muda para o evento do piloto. Confira o progresso de:

- cadastros;
- check-ins;
- mimos utilizados.

## 5. Encerramento

1. Com o piloto em andamento, clique em Encerrar piloto.
2. Confirme que o status muda para Encerrado.
3. As métricas e exportações permanecem disponíveis.

## Segurança

- `pilot_runs` é visível somente para administradores.
- exportações exigem papel admin e são auditadas;
- nenhuma chave secreta é usada no navegador;
- o CSV de clientes contém dados pessoais e deve ser armazenado apenas em local autorizado.
