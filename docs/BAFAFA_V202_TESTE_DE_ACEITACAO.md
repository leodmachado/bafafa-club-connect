# Teste de aceitação V20.2

Execute os testes depois do SQL do Supabase e antes do deployment de produção.

## 1. Verificação técnica

No PowerShell:

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" install
& "$env:USERPROFILE\.bun\bin\bun.exe" run lint
& "$env:USERPROFILE\.bun\bin\bun.exe" run build
& "$env:USERPROFILE\.bun\bin\bun.exe" run dev
```

Critério: lint sem erros e build concluído.

## 2. Navegação

- Confirmar quatro itens no menu: Início, Fofoquinhas, Resenha e Perfil.
- Acessar `/eventos` diretamente e confirmar redirecionamento para `/inicio`.
- Confirmar que nenhum card de evento ou promoção de evento aparece no aplicativo público.

## 3. Cadastro

- Criar um novo usuário de teste.
- Concluir a confirmação disponível no ambiente.
- Confirmar redirecionamento para o Início.

## 4. Feed sem sessão

- Manter todas as Sessões da Casa fora do horário atual.
- Abrir o Início.
- Confirmar que publicações e Fofoquinhas aparecem normalmente.
- Abrir a Resenha e confirmar a mensagem de que ela está fechada.

## 5. Sessão da Casa

- No painel administrativo, abrir Sessão da Casa.
- Criar uma sessão usando um local com latitude e longitude.
- Tentar criar outra sessão sobreposta e confirmar que o banco bloqueia.
- Confirmar que a sessão não aparece como evento para o cliente.

## 6. Check-in

- Abrir o Início durante a sessão.
- Confirmar que aparece a chamada de presença.
- Fazer check-in por localização.
- Confirmar redirecionamento automático para a Resenha.
- Repetir com QR alternativo e confirmar redirecionamento depois da validação da equipe.

## 7. Resenha

- Confirmar que somente usuários com check-in entram.
- Confirmar envio, resposta e reação em mensagens.
- Testar denúncia, bloqueio e silenciamento.
- Encerrar a Sessão da Casa e confirmar bloqueio de novas mensagens.

## 8. Fofoquinhas no Início

- Criar uma promoção geral e uma missão.
- Abrir Organizar o Início.
- Mover uma campanha para o topo das Fofoquinhas.
- Retirar outra do Início.
- Confirmar que a campanha retirada continua visível na área Fofoquinhas.
- Restaurar a ordem automática e confirmar promoção geral antes da missão.

## 9. Link externo

- Criar uma campanha com compra em site externo.
- Confirmar botão com o texto configurado.
- Clicar e confirmar abertura do endereço correto.
- Atualizar o painel e confirmar aumento do contador de cliques.

## 10. Ativação por QR

- Abrir uma recompensa disponível.
- Ativar a Fofoquinha.
- Confirmar geração do QR sem o erro de `expires_at`.
- Validar uma vez e confirmar que o mesmo código não pode ser reutilizado.
