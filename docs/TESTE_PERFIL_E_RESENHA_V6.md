# Teste — Perfil 100% e Resenha do Evento (v6)

## Antes de abrir o app

1. Execute `docs/PERFIL_E_RESENHA_V6_SETUP.sql` no SQL Editor do Supabase, uma única vez.
2. Reinicie o servidor local.
3. Entre novamente no app.

## 1. Perfil 100% atingível

O percentual agora vem apenas do banco e usa estes critérios:

- Nome + nascimento: 20%
- Cidade: 10%
- Bairro: 10%
- Preferências de eventos: 15%
- Preferências de bebidas: 10%
- Preferências de comidas: 10%
- Como conheceu o Bafafá: 10%
- Foto do perfil: 10%
- Nome de usuário: 5%

A confirmação de telefone não entra no percentual. Ela continua sendo uma verificação separada para quando o OTP for ativado.

### Teste

1. Abra **Perfil**.
2. Veja o checklist abaixo da barra de progresso.
3. Preencha um item de cada vez e salve.
4. Confirme que o percentual aumenta com o peso mostrado.
5. Complete todos os itens.
6. Confirme 100% e o selo **Perfil no Grau**.
7. Abra **Administração → Clientes** e confira se o mesmo percentual aparece.

## 2. Liberar a Resenha em um evento

1. Entre em **Administração → Eventos**.
2. Edite um evento de teste.
3. Ative **Resenha do evento**.
4. Para facilitar o teste, defina abertura alguns minutos antes do horário atual e encerramento algumas horas depois.
5. Salve.

Se os campos de horário ficarem vazios, a sala abre 1 hora antes do evento e fecha até 4 horas após o fim (ou 10 horas após o início quando não houver fim cadastrado).

## 3. Acesso por check-in

### Administrador/moderador/equipe

Esses papéis podem abrir a sala para operação e moderação sem check-in.

### Cliente comum

1. Crie uma segunda conta em janela anônima ou outro navegador.
2. Gere o código em **Check-in**.
3. Com a conta administradora, valide em `/staff/checkin`.
4. Aguarde até 5 segundos na tela do cliente.
5. A confirmação aparecerá com o botão **Entrar na Resenha**.

## 4. Conversa em tempo real

1. Abra a mesma Resenha em dois navegadores.
2. Envie mensagens em ambos.
3. Teste resposta a uma mensagem.
4. Confirme que nome, título e selos aparecem sem telefone ou outros dados privados.
5. Apague uma mensagem própria.
6. Teste o limite: mensagens com mais de 300 caracteres não são aceitas e há proteção contra disparos muito rápidos.

## 5. Denúncia, bloqueio e moderação

1. Em uma mensagem de outro usuário, clique em **denunciar**.
2. Escolha o motivo e envie.
3. Entre em **Administração → Resenha**.
4. Confirme que a denúncia aparece.
5. Teste **Ocultar mensagem** e **Manter e encerrar**.
6. No cliente, teste **bloquear**. Os dois usuários deixam de ver as mensagens um do outro.

## Limite desta versão

Esta entrega inclui o mural público do evento. Não inclui mensagens privadas nem compra/envio de bebidas. O próximo piloto deve validar adesão, volume de mensagens e carga de moderação antes de criar o **Manda um Mimo**.
