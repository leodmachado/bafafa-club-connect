import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Ban, LoaderCircle, LockKeyhole, RefreshCw, Undo2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type BlockedUser = {
  blocked_user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  is_public: boolean;
  blocked_at: string;
};

export function BlockedUsersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase.rpc("my_event_chat_blocks");
    if (loadError) {
      setError(loadError.message);
    } else {
      setUsers((data ?? []) as BlockedUser[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void loadBlockedUsers();
  }, [loadBlockedUsers, open]);

  async function unblock(user: BlockedUser) {
    setUnblockingId(user.blocked_user_id);
    const { error: unblockError } = await supabase.rpc("set_event_chat_block", {
      _blocked_user_id: user.blocked_user_id,
      _blocked: false,
    });
    setUnblockingId(null);
    if (unblockError) return toast.error(unblockError.message);
    setUsers((current) => current.filter((item) => item.blocked_user_id !== user.blocked_user_id));
    toast.success(`${user.display_name} foi desbloqueado.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82dvh] overflow-hidden rounded-3xl p-0 sm:max-w-md">
        <DialogHeader className="border-b border-foreground/10 px-5 pb-4 pt-5 text-left">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-foreground bg-samba text-samba-foreground shadow-[2px_3px_0_var(--foreground)]">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-2xl">Pessoas bloqueadas</DialogTitle>
              <DialogDescription className="mt-1">
                Você pode desbloquear alguém a qualquer momento. As mensagens futuras voltam a
                aparecer na Resenha.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[56dvh] overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex min-h-36 items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Abrindo a lista…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
              <p className="text-sm font-black text-destructive">Não conseguimos abrir a lista.</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={() => void loadBlockedUsers()}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background px-3 py-2 text-xs font-black"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-foreground/20 bg-muted/35 px-6 text-center">
              <div>
                <LockKeyhole className="mx-auto h-7 w-7 text-primary" />
                <p className="mt-3 font-black">Ninguém bloqueado por aqui.</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Sua Resenha está sem gente na lista de bloqueio.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <article
                  key={user.blocked_user_id}
                  className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card p-3"
                >
                  {user.username ? (
                    <Link
                      to="/u/$username"
                      params={{ username: user.username }}
                      className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-foreground/20 bg-primary font-black text-primary-foreground"
                      aria-label={`Abrir perfil de ${user.display_name}`}
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (user.display_name[0]?.toUpperCase() ?? "B")
                      )}
                    </Link>
                  ) : (
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-foreground/20 bg-primary font-black text-primary-foreground">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (user.display_name[0]?.toUpperCase() ?? "B")
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black">{user.display_name}</p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                      {user.username ? `@${user.username}` : "Sem nome de usuário"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void unblock(user)}
                    disabled={unblockingId === user.blocked_user_id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-foreground bg-background px-3 py-2 text-[11px] font-black shadow-[2px_2px_0_var(--foreground)] disabled:opacity-50"
                  >
                    {unblockingId === user.blocked_user_id ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="h-3.5 w-3.5" />
                    )}
                    Desbloquear
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-foreground/10 px-4 py-3 sm:justify-between">
          <div className="hidden items-center gap-2 text-[11px] font-semibold text-muted-foreground sm:flex">
            <UserRound className="h-3.5 w-3.5" /> Perfis privados continuam protegidos.
          </div>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
