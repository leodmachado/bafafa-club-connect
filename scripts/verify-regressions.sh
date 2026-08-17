#!/usr/bin/env bash
#
# Prova "vermelho antes / verde depois" para os testes de regressão.
#
# Para cada teste registrado abaixo, o script:
#   1. cria um worktree no commit ANTERIOR à correção e roda o teste ali,
#      exigindo que ele FALHE (vermelho — o bug existia e o teste o detecta);
#   2. roda o mesmo teste no commit da correção, exigindo que ele PASSE (verde).
#
# Um teste de regressão que passa nas duas pontas não prova nada: ele não
# estaria testando a correção. Por isso o passo 1 falha o script se o teste
# passar no código antigo.
#
# Uso:  bash scripts/verify-regressions.sh
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_BASE="${TMPDIR:-/tmp}/bafafa-regression-worktrees"

# Formato: <arquivo de teste>|<commit da correção>|<descrição>
REGRESSIONS=(
  "test/regression/aal2-privileged-gate.test.ts|6e05948|Conta privilegiada em AAL1 escapava do 2FA trocando de rota"
  # A remoção da RPC privilegiada foi feita em duas etapas — 2cab099 tratou
  # inicio.tsx e 715f69a tratou checkin.tsx. Ancoramos no commit que conclui a
  # correção; em 715f69a^ o checkin ainda chamava a RPC, então o vermelho vale.
  "test/regression/privileged-rpc-sync.test.ts|715f69a|Telas de membro chamavam RPC privilegiada sync_event_statuses"
)

pass_count=0
fail_count=0

cleanup() {
  rm -rf "$WORKTREE_BASE"
  git -C "$REPO_ROOT" worktree prune >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Monta um worktree em <commit> com a infraestrutura de testes atual copiada
# por cima. O código de produção vem do commit; os testes vêm do HEAD.
prepare_worktree() {
  local commit="$1" dir="$2" test_file="$3"

  git -C "$REPO_ROOT" worktree add --detach -f "$dir" "$commit" >/dev/null 2>&1 || return 1

  ln -sfn "$REPO_ROOT/node_modules" "$dir/node_modules"
  cp "$REPO_ROOT/vitest.config.ts" "$dir/vitest.config.ts"
  mkdir -p "$dir/test/helpers" "$dir/$(dirname "$test_file")"
  cp "$REPO_ROOT/test/setup.ts" "$dir/test/setup.ts"
  cp -r "$REPO_ROOT/test/helpers/." "$dir/test/helpers/"
  cp "$REPO_ROOT/$test_file" "$dir/$test_file"
}

run_suite() {
  local dir="$1" test_file="$2"
  (cd "$dir" && npx vitest run --root "$dir" "$test_file" >/dev/null 2>&1)
}

rm -rf "$WORKTREE_BASE"
mkdir -p "$WORKTREE_BASE"

echo "Verificando regressões (vermelho antes / verde depois)"
echo "======================================================"

for entry in "${REGRESSIONS[@]}"; do
  IFS="|" read -r test_file fix_commit description <<<"$entry"

  echo
  echo "• $description"
  echo "  teste:  $test_file"
  echo "  correção: $fix_commit"

  if [ ! -f "$REPO_ROOT/$test_file" ]; then
    echo "  ✗ arquivo de teste não encontrado"
    fail_count=$((fail_count + 1))
    continue
  fi

  before_dir="$WORKTREE_BASE/before-$fix_commit"
  after_dir="$WORKTREE_BASE/after-$fix_commit"

  # --- VERMELHO: código anterior à correção ---
  if ! prepare_worktree "${fix_commit}^" "$before_dir" "$test_file"; then
    echo "  ✗ não foi possível preparar o worktree de ${fix_commit}^"
    fail_count=$((fail_count + 1))
    continue
  fi

  if run_suite "$before_dir" "$test_file"; then
    echo "  ✗ VERMELHO falhou: o teste PASSOU em ${fix_commit}^ (não cobre a correção)"
    fail_count=$((fail_count + 1))
    continue
  fi
  echo "  ✓ vermelho: o teste falha em ${fix_commit}^ (bug detectado)"

  # --- VERDE: código já corrigido ---
  if ! prepare_worktree "$fix_commit" "$after_dir" "$test_file"; then
    echo "  ✗ não foi possível preparar o worktree de $fix_commit"
    fail_count=$((fail_count + 1))
    continue
  fi

  if ! run_suite "$after_dir" "$test_file"; then
    echo "  ✗ VERDE falhou: o teste não passa em $fix_commit"
    fail_count=$((fail_count + 1))
    continue
  fi
  echo "  ✓ verde: o teste passa em $fix_commit (correção comprovada)"

  pass_count=$((pass_count + 1))
done

echo
echo "======================================================"
echo "Regressões comprovadas: $pass_count | com problema: $fail_count"
[ "$fail_count" -eq 0 ]
