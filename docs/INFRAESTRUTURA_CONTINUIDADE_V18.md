# BAFAFÁ V18 — Infraestrutura, continuidade e monitoramento

Esta etapa não adiciona dados de clientes nem integra tokens externos ao aplicativo. Ela cria uma rotina para evitar perda de dados, detectar alterações sensíveis e documentar responsabilidades.

## 1. Contas administrativas

Habilite MFA nas três contas usadas para administrar o projeto:

- GitHub;
- Vercel;
- Supabase.

Nunca compartilhe uma conta administrativa. Cada pessoa deve usar sua própria conta.

## 2. Proteção da branch `main`

No GitHub, abra **Settings → Rules → Rulesets → New branch ruleset**.

Use como alvo a branch `main` e habilite:

- bloquear exclusão da branch;
- bloquear force push;
- exigir Pull Request;
- exigir que a branch esteja atualizada antes do merge;
- exigir o check **Build e segurança / build-and-audit**;
- exigir resolução de conversas;
- usar squash merge como padrão.

Enquanto apenas uma pessoa desenvolve, a exigência de segunda aprovação pode permanecer desativada. Quando outro responsável técnico entrar, exija uma aprovação.

## 3. Dependências e segredos

A V18 inclui:

- `.github/dependabot.yml` para Bun e GitHub Actions;
- verificação semanal de build e vulnerabilidades;
- scanner local de segredos de alta confiança;
- `CODEOWNERS` e checklist de Pull Request.

No GitHub, ative **Dependency graph**, **Dependabot alerts** e **Dependabot security updates**. Ative Secret Scanning e Push Protection quando o seu plano permitir.

Comando local antes de um push importante:

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run security:verify
```

## 4. Vercel

- mantenha a `main` como Production Branch;
- mantenha previews protegidos;
- limite os membros com acesso ao projeto;
- revise as variáveis de ambiente em Preview e Production;
- variáveis `VITE_` podem chegar ao navegador: use nelas apenas a URL e a chave publicável do Supabase;
- nunca use `service_role`, senha do banco ou token da Twilio no frontend.

Revise periodicamente **Activity Log**, **Deployments** e **Logs**.

## 5. Supabase

Revise periodicamente:

- Authentication → Audit Logs;
- Logs Explorer → Auth, API, Postgres e Storage;
- Database → Backups;
- membros e papéis da organização;
- uso e limites do projeto.

A trilha interna do aplicativo fica em **Administração → Segurança**.

## 6. Backup do banco

O backup do banco não inclui os arquivos físicos do Storage. Faça os dois.

### Pré-requisitos

- Docker Desktop instalado e aberto;
- projeto vinculado ao Supabase CLI;
- Session Pooler URL copiada do botão **Connect**;
- senha do banco conhecida.

No PowerShell, defina a URL apenas para a sessão atual:

```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.PROJECT_REF:SENHA@HOST:5432/postgres"
```

Não salve essa URL em arquivo. Execute:

```powershell
& "$env:USERPROFILE\.bun\bin\bun.exe" run backup:supabase
```

O script cria:

- `roles.sql`;
- `schema.sql`;
- `data.sql`;
- cópia dos buckets `avatars` e `event-images`, quando o CLI estiver vinculado;
- `manifest.json` com SHA-256.

Depois, remova a variável da sessão:

```powershell
Remove-Item Env:SUPABASE_DB_URL
```

Copie a pasta para um local externo protegido. A pasta `backups/` é ignorada pelo Git.

## 7. Verificar o backup

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-backup.ps1 -BackupDirectory ".\backups\bafafa-AAAAMMDD-HHMMSS"
```

Verificar o hash não substitui um teste de restauração.

## 8. Teste de restauração

Nunca teste restauração no banco de produção.

1. crie um projeto Supabase separado;
2. restaure schema e dados conforme o guia oficial de backup/restore;
3. recrie Auth Settings, Redirect URLs, SMTP, CAPTCHA, Realtime e variáveis;
4. restaure os objetos do Storage;
5. abra o aplicativo apontando para o projeto de teste;
6. valide login, evento, check-in, mimo, Resenha, perfil e painel admin;
7. registre a evidência no checklist da aba Segurança.

## 9. Rotina recomendada

### Semanal

- verificar Dependabot e GitHub Actions;
- revisar eventos de segurança em aberto;
- verificar Auth Audit Logs;
- revisar contas privilegiadas.

### Mensal

- gerar backup externo do banco e Storage;
- validar integridade do backup;
- revisar variáveis e membros nas três plataformas;
- atualizar o checklist no painel.

### Trimestral

- restaurar um backup em projeto separado;
- revisar o plano de incidente;
- revisar quem precisa continuar com acesso administrativo.
