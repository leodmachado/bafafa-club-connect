import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  ArrowDown,
  Ban,
  Clock3,
  Flag,
  HeartHandshake,
  MessageCircleMore,
  RefreshCw,
  Reply,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundX,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BlockedUsersDialog } from "@/components/chat/blocked-users-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { NameWithBadges, type BafafaBadgeDefinition } from "@/components/profile/bafafa-badge";
import { ErrorCard, LoadingCard } from "@/components/ui/async-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { parseHouseSession, type HouseSession } from "@/lib/house-session";

export const Route = createFileRoute("/_authenticated/resenha")({
  component: Resenha,
});

type ChatRoom = {
  event_id: string;
  event_name: string;
  starts_at: string;
  ends_at: string | null;
  image_url: string | null;
  category: string;
  chat_closes_at: string;
  message_count: number;
  last_message_at: string | null;
};

type ChatMessage = {
  message_id: string;
  event_id: string;
  author_id: string;
  body: string;
  reply_to: string | null;
  created_at: string;
  author_name: string;
  author_username: string | null;
  author_avatar_url: string | null;
  author_title: string | null;
  author_badges: BafafaBadgeDefinition[];
  is_mine: boolean;
};

type SalveItem = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: string;
  opener: string | null;
  created_at: string;
  sender_name?: string;
  recipient_name?: string;
  thread_id?: string;
};

type PrivateChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

const REPORT_REASONS = [
  ["spam", "Spam ou divulgação"],
  ["assedio", "Assédio ou insistência"],
  ["ofensa", "Ofensa ou discriminação"],
  ["exposicao", "Exposição de alguém"],
  ["outro", "Outro motivo"],
] as const;

function Resenha() {
  const { roles, user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [houseSession, setHouseSession] = useState<HouseSession | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("outro");
  const [reportDetails, setReportDetails] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);
  const [salveTarget, setSalveTarget] = useState<ChatMessage | null>(null);
  const [salveOpener, setSalveOpener] = useState("");
  const [salvesOpen, setSalvesOpen] = useState(false);
  const [salves, setSalves] = useState<SalveItem[]>([]);
  const [salvesLoading, setSalvesLoading] = useState(false);
  const [privateThread, setPrivateThread] = useState<{ id: string; otherName: string } | null>(
    null,
  );
  const [privateMessages, setPrivateMessages] = useState<PrivateChatMessage[]>([]);
  const [privateDraft, setPrivateDraft] = useState("");
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateSending, setPrivateSending] = useState(false);

  const [now, setNow] = useState(Date.now());
  const feedRef = useRef<HTMLDivElement | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);

  const selectedRoom = rooms.find((room) => room.event_id === selectedId) ?? null;
  const canModerate = roles.includes("admin") || roles.includes("moderador");
  const roomClosed = selectedRoom ? now > new Date(selectedRoom.chat_closes_at).getTime() : false;
  const participantCount = useMemo(
    () => new Set(messages.map((message) => message.author_id)).size,
    [messages],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const loadRooms = useCallback(async () => {
    const [{ data: roomData, error: roomError }, { data: sessionData, error: sessionError }] =
      await Promise.all([supabase.rpc("my_event_chat_rooms"), supabase.rpc("my_house_session")]);
    if (roomError) throw roomError;
    if (sessionError) throw sessionError;

    const nextRooms = (roomData ?? []).map((room) => ({
      ...room,
      message_count: Number(room.message_count ?? 0),
    })) as ChatRoom[];
    setHouseSession(parseHouseSession(sessionData));
    setRooms(nextRooms);
    setSelectedId((current) => {
      if (current && nextRooms.some((room) => room.event_id === current)) return current;
      return nextRooms[0]?.event_id ?? "";
    });
  }, []);

  const loadMessages = useCallback(async (eventId: string, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    const { data, error: feedError } = await supabase.rpc("get_event_chat_feed", {
      _event_id: eventId,
      _limit: 100,
    });
    if (feedError) {
      if (!quiet) setError(feedError.message);
    } else {
      const nextMessages = (data ?? []).map((message) => ({
        ...message,
        author_badges: Array.isArray(message.author_badges)
          ? (message.author_badges as unknown as BafafaBadgeDefinition[])
          : [],
      })) as ChatMessage[];

      const wasEmpty = messagesRef.current.length === 0;
      const oldIds = new Set(messagesRef.current.map((message) => message.message_id));
      const added = nextMessages.filter((message) => !oldIds.has(message.message_id));
      const ownAdded = added.some((message) => message.is_mine);
      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      if (nearBottomRef.current || forceScrollRef.current || ownAdded || wasEmpty) {
        forceScrollRef.current = false;
        setNewMessages(0);
        window.requestAnimationFrame(() => scrollToBottom("smooth"));
      } else if (added.length > 0) {
        setNewMessages((count) => count + added.length);
      }
    }
    if (!quiet) setLoadingMessages(false);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadRooms();
    } catch (roomError) {
      setError(
        roomError instanceof Error ? roomError.message : "Não foi possível abrir a Resenha.",
      );
    } finally {
      setLoading(false);
    }
  }, [loadRooms]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!selectedId) {
      messagesRef.current = [];
      setMessages([]);
      return;
    }
    setError(null);
    setNewMessages(0);
    nearBottomRef.current = true;
    forceScrollRef.current = true;
    void loadMessages(selectedId);

    const channel = supabase
      .channel(`event-chat-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_chat_messages",
          filter: `event_id=eq.${selectedId}`,
        },
        () => void loadMessages(selectedId, true),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMessages, selectedId]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    feedEndRef.current?.scrollIntoView({ behavior, block: "end" });
    nearBottomRef.current = true;
    setNewMessages(0);
  }

  function handleFeedScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    nearBottomRef.current = distance < 90;
    if (nearBottomRef.current) setNewMessages(0);
  }

  async function refreshChat() {
    if (!selectedId) return;
    setRefreshing(true);
    await Promise.all([loadRooms(), loadMessages(selectedId, true)]);
    setRefreshing(false);
    toast.success("Resenha atualizada.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !draft.trim() || sending || roomClosed) return;
    setSending(true);
    const { error: sendError } = await supabase.rpc("send_event_chat_message", {
      _event_id: selectedId,
      _body: draft.trim(),
      _reply_to: replyingTo?.message_id ?? null,
    });
    setSending(false);
    if (sendError) return toast.error(sendError.message);
    setDraft("");
    setReplyingTo(null);
    forceScrollRef.current = true;
    await loadMessages(selectedId, true);
  }

  async function deleteMessage(message: ChatMessage) {
    const copy = message.is_mine ? "Apagar sua mensagem?" : "Ocultar esta mensagem da Resenha?";
    if (!window.confirm(copy)) return;
    const { error: deleteError } = await supabase.rpc("delete_event_chat_message", {
      _message_id: message.message_id,
    });
    if (deleteError) return toast.error(deleteError.message);
    toast.success(message.is_mine ? "Mensagem apagada." : "Mensagem retirada da Resenha.");
    await loadMessages(selectedId, true);
  }

  async function blockUser(message: ChatMessage) {
    if (
      !window.confirm(
        `Bloquear ${message.author_name}? Vocês deixam de ver as mensagens um do outro.`,
      )
    )
      return;
    const { error: blockError } = await supabase.rpc("set_event_chat_block", {
      _blocked_user_id: message.author_id,
      _blocked: true,
    });
    if (blockError) return toast.error(blockError.message);
    toast.success("Usuário bloqueado nesta experiência.");
    await loadMessages(selectedId, true);
  }

  async function submitReport() {
    if (!reporting) return;
    const { error: reportError } = await supabase.rpc("report_event_chat_message", {
      _message_id: reporting.message_id,
      _reason: reportReason,
      _details: reportDetails.trim() || null,
    });
    if (reportError) return toast.error(reportError.message);
    setReporting(null);
    setReportDetails("");
    setReportReason("outro");
    toast.success("Denúncia enviada para a moderação.");
  }

  async function loadSalves() {
    if (!selectedId || !user) return;
    setSalvesLoading(true);
    const { data, error: salveError } = await supabase
      .from("salve_requests")
      .select("id,sender_id,recipient_id,status,opener,created_at")
      .eq("event_id", selectedId)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (salveError) {
      setSalvesLoading(false);
      return toast.error(salveError.message);
    }

    const rows = data ?? [];
    const ids = [...new Set(rows.flatMap((item) => [item.sender_id, item.recipient_id]))];
    const [{ data: people }, { data: threads }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("id,display_name").in("id", ids)
        : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null }> }),
      supabase
        .from("private_chat_threads")
        .select("id,salve_request_id")
        .eq("event_id", selectedId),
    ]);
    const names = new Map((people ?? []).map((item) => [item.id, item.display_name ?? "Bafafã"]));
    const threadByRequest = new Map(
      (threads ?? []).map((item) => [item.salve_request_id, item.id]),
    );
    setSalves(
      rows.map((item) => ({
        ...item,
        sender_name: names.get(item.sender_id),
        recipient_name: names.get(item.recipient_id),
        thread_id: threadByRequest.get(item.id),
      })),
    );
    setSalvesLoading(false);
  }

  async function sendSalve() {
    if (!salveTarget || !selectedId) return;
    const { error: salveError } = await supabase.rpc("send_salve_request", {
      _event_id: selectedId,
      _recipient_id: salveTarget.author_id,
      _opener: salveOpener.trim() || null,
    });
    if (salveError) return toast.error(salveError.message);
    setSalveTarget(null);
    setSalveOpener("");
    toast.success("Salve enviado. A conversa só abre se a pessoa der moral.");
    await loadSalves();
  }

  async function respondSalve(requestId: string, accept: boolean) {
    const { error: responseError } = await supabase.rpc("respond_salve_request", {
      _request_id: requestId,
      _accept: accept,
    });
    if (responseError) return toast.error(responseError.message);
    toast.success(
      accept ? "Você deu moral. A conversa foi liberada." : "Tudo certo. O pedido foi encerrado.",
    );
    await loadSalves();
  }

  async function openPrivateConversation(threadId: string, otherName: string) {
    setPrivateThread({ id: threadId, otherName });
    setPrivateDraft("");
    setPrivateLoading(true);
    const { data, error: messagesError } = await supabase
      .from("private_chat_messages")
      .select("id,thread_id,sender_id,body,created_at,deleted_at")
      .eq("thread_id", threadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    setPrivateLoading(false);
    if (messagesError) {
      setPrivateThread(null);
      return toast.error(messagesError.message);
    }
    setPrivateMessages(data ?? []);
  }

  async function sendPrivateMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!privateThread || !privateDraft.trim() || privateSending) return;
    setPrivateSending(true);
    const { error: privateError } = await supabase.rpc("send_private_message", {
      _thread_id: privateThread.id,
      _body: privateDraft.trim(),
    });
    setPrivateSending(false);
    if (privateError) return toast.error(privateError.message);
    setPrivateDraft("");
    await openPrivateConversation(privateThread.id, privateThread.otherName);
  }

  return (
    <AppShell>
      <header className="resenha-header relative overflow-hidden border-b-2 border-foreground px-5 pb-5 pt-6 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="section-kicker text-white/65">Ao vivo na casa</p>
            <h1 className="mt-1 font-display text-4xl leading-none">Resenha do Bafas</h1>
            <p className="mt-2 text-xs font-bold text-white/72">Cantada pode. Desrespeito, não.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSalvesOpen(true);
                void loadSalves();
              }}
              className="bafafa-icon-button shrink-0"
              aria-label="Abrir salves"
              title="Salves"
            >
              <HeartHandshake className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setBlockedUsersOpen(true)}
              className="bafafa-icon-button shrink-0"
              aria-label="Gerenciar pessoas bloqueadas"
              title="Pessoas bloqueadas"
            >
              <UserRoundX className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void refreshChat()}
              disabled={refreshing || !selectedId}
              className="bafafa-icon-button shrink-0 disabled:opacity-50"
              aria-label="Atualizar Resenha"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {loading && <LoadingCard label="Abrindo a Resenha…" />}
      {error && !loading && (
        <div className="space-y-3">
          <ErrorCard message={error} />
          <div className="px-5">
            <button
              type="button"
              onClick={() => void initialize()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
            >
              <RefreshCw className="h-4 w-4" /> Tentar de novo
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="px-3 pt-3">
          {rooms.length === 0 ? (
            <ResenhaUnavailable session={houseSession} onRetry={() => void initialize()} />
          ) : (
            <section className="resenha-room flex h-[calc(100dvh-11.8rem)] min-h-[430px] flex-col overflow-hidden">
              <div className="resenha-room__header px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="section-kicker text-white/65">Papo aberto</p>
                    <p className="mt-1 truncate font-black">A conversa de quem já chegou</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                      roomClosed ? "bg-white/12 text-white/65" : "bg-mango text-foreground"
                    }`}
                  >
                    {roomClosed ? "encerrada" : "ao vivo"}
                  </span>
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-white/65">
                  <span className="flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5" /> {participantCount} na conversa
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" /> A sala fecha junto com a Sessão da Casa
                  </span>
                </div>
              </div>

              <div
                ref={feedRef}
                onScroll={handleFeedScroll}
                className="resenha-room__feed relative flex-1 space-y-2 overflow-y-auto px-3 py-3"
              >
                {loadingMessages ? (
                  <p className="py-16 text-center text-sm font-bold text-muted-foreground">
                    Puxando as últimas fofocas…
                  </p>
                ) : messages.length === 0 ? (
                  <div className="grid min-h-full place-items-center px-5 text-center">
                    <div>
                      <MessageCircleMore className="mx-auto h-9 w-9 text-primary" />
                      <p className="mt-3 font-display text-3xl">
                        A primeira mensagem pode ser sua.
                      </p>
                      <p className="mt-2 text-sm font-semibold text-muted-foreground">
                        Puxe assunto sem entregar ninguém.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const replied = message.reply_to
                      ? messages.find((candidate) => candidate.message_id === message.reply_to)
                      : null;
                    return (
                      <article
                        key={message.message_id}
                        className={`resenha-bubble max-w-[86%] px-3 py-2.5 ${
                          message.is_mine
                            ? "resenha-bubble--mine ml-auto"
                            : "resenha-bubble--other mr-auto"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {!message.is_mine &&
                            (message.author_username ? (
                              <Link
                                to="/u/$username"
                                params={{ username: message.author_username }}
                                className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-foreground/20 bg-primary text-[10px] font-black text-white transition-transform hover:scale-105"
                                aria-label={`Abrir perfil de ${message.author_name}`}
                              >
                                {message.author_avatar_url ? (
                                  <img
                                    src={message.author_avatar_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  (message.author_name[0]?.toUpperCase() ?? "B")
                                )}
                              </Link>
                            ) : (
                              <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-foreground/20 bg-primary text-[10px] font-black text-white">
                                {message.author_avatar_url ? (
                                  <img
                                    src={message.author_avatar_url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  (message.author_name[0]?.toUpperCase() ?? "B")
                                )}
                              </div>
                            ))}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {message.author_username ? (
                                <Link
                                  to="/u/$username"
                                  params={{ username: message.author_username }}
                                  className="min-w-0 flex-1 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary"
                                  aria-label={`Abrir perfil de ${message.author_name}`}
                                >
                                  <NameWithBadges
                                    name={message.is_mine ? "Você" : message.author_name}
                                    badges={message.author_badges}
                                    maxBadges={2}
                                    className="min-w-0 text-[12px] font-black"
                                  />
                                </Link>
                              ) : (
                                <NameWithBadges
                                  name={message.is_mine ? "Você" : message.author_name}
                                  badges={message.author_badges}
                                  maxBadges={2}
                                  className="min-w-0 flex-1 text-[12px] font-black"
                                />
                              )}
                              <time className="shrink-0 text-[9px] font-bold text-muted-foreground">
                                {formatMessageTime(message.created_at)}
                              </time>
                            </div>
                            {message.author_title && !message.is_mine && (
                              <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                {message.author_title}
                              </p>
                            )}
                            {replied && (
                              <div className="mt-1.5 rounded-lg border-l-2 border-primary bg-background/70 px-2 py-1.5 text-[11px] text-muted-foreground">
                                <strong>{replied.is_mine ? "Você" : replied.author_name}:</strong>{" "}
                                {replied.body.slice(0, 72)}
                              </div>
                            )}
                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {message.body}
                            </p>
                            <div className="mt-1 flex justify-end gap-0.5 text-muted-foreground">
                              <MessageAction
                                label="Responder"
                                onClick={() => setReplyingTo(message)}
                              >
                                <Reply className="h-3.5 w-3.5" />
                              </MessageAction>
                              {(message.is_mine || canModerate) && (
                                <MessageAction
                                  label="Apagar"
                                  onClick={() => void deleteMessage(message)}
                                  destructive
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </MessageAction>
                              )}
                              {!message.is_mine && (
                                <>
                                  {message.author_username && (
                                    <Link
                                      to="/u/$username"
                                      params={{ username: message.author_username }}
                                      className="grid h-7 w-7 place-items-center rounded-full hover:bg-background hover:text-foreground"
                                      aria-label={`Ver perfil de ${message.author_name}`}
                                      title="Ver perfil"
                                    >
                                      <UserRound className="h-3.5 w-3.5" />
                                    </Link>
                                  )}
                                  <MessageAction
                                    label="Mandar um salve"
                                    onClick={() => {
                                      setSalveTarget(message);
                                      setSalveOpener("");
                                    }}
                                  >
                                    <HeartHandshake className="h-3.5 w-3.5" />
                                  </MessageAction>
                                  <MessageAction
                                    label="Denunciar"
                                    onClick={() => setReporting(message)}
                                  >
                                    <Flag className="h-3.5 w-3.5" />
                                  </MessageAction>
                                  <MessageAction
                                    label="Bloquear"
                                    onClick={() => void blockUser(message)}
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </MessageAction>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
                <div ref={feedEndRef} />

                {newMessages > 0 && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    className="sticky bottom-2 left-1/2 z-10 mx-auto flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-foreground/20 bg-foreground px-3 py-2 text-xs font-black text-background shadow-lg"
                  >
                    <ArrowDown className="h-3.5 w-3.5" /> {newMessages} nova
                    {newMessages > 1 ? "s" : ""}
                  </button>
                )}
              </div>

              {roomClosed ? (
                <div className="border-t-2 border-foreground bg-[#2c1b4a] px-4 py-3 text-center text-white">
                  <p className="text-sm font-black">Resenha encerrada.</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/65">
                    As mensagens ficam somente para consulta.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={sendMessage}
                  className="resenha-composer border-t-2 border-foreground p-3"
                >
                  {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-bold">
                      <Reply className="h-3.5 w-3.5" />
                      <span className="min-w-0 flex-1 truncate">
                        Respondendo {replyingTo.author_name}: {replyingTo.body}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        aria-label="Cancelar resposta"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 300))}
                      placeholder="Manda a boa, Bafafã…"
                      rows={1}
                      className="max-h-28 min-h-11 resize-none rounded-2xl border-2 border-foreground bg-white shadow-[2px_3px_0_rgba(22,18,43,0.18)]"
                    />
                    <Button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="h-11 w-11 shrink-0 rounded-full p-0"
                      aria-label="Enviar mensagem"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  <p className="mt-1 text-right text-[9px] font-bold text-muted-foreground">
                    {draft.length}/300
                  </p>
                </form>
              )}
            </section>
          )}
        </div>
      )}

      <BlockedUsersDialog open={blockedUsersOpen} onOpenChange={setBlockedUsersOpen} />

      <Dialog open={Boolean(reporting)} onOpenChange={(open) => !open && setReporting(null)}>
        <DialogContent className="bafafa-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Denunciar mensagem</DialogTitle>
            <DialogDescription>
              A moderação recebe a denúncia sem informar seu nome ao autor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="report-reason">Motivo</Label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 text-sm font-bold"
              >
                {REPORT_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="report-details">Conte o que aconteceu (opcional)</Label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value.slice(0, 500))}
                rows={4}
                className="mt-2 border-2 border-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReporting(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitReport()}>
              Enviar denúncia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(salveTarget)} onOpenChange={(open) => !open && setSalveTarget(null)}>
        <DialogContent className="bafafa-dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Mandar um salve para {salveTarget?.author_name}
            </DialogTitle>
            <DialogDescription>
              A conversa só abre se a pessoa quiser. Sem pressão e sem exposição.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="salve-opener">Quebra-gelo, opcional</Label>
            <Textarea
              id="salve-opener"
              value={salveOpener}
              onChange={(event) => setSalveOpener(event.target.value.slice(0, 180))}
              placeholder="Ex.: curti seu gosto musical, bora trocar uma ideia?"
              className="mt-2"
            />
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              Cantada pode. Desrespeito, não.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalveTarget(null)}>
              Agora não
            </Button>
            <Button onClick={() => void sendSalve()}>
              <HeartHandshake className="h-4 w-4" /> Mandar salve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={salvesOpen} onOpenChange={setSalvesOpen}>
        <DialogContent className="bafafa-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Salves da noite</DialogTitle>
            <DialogDescription>
              Pedidos de conversa com consentimento dos dois lados.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto">
            {salvesLoading ? (
              <p className="py-8 text-center text-sm font-bold text-muted-foreground">
                Buscando os salves…
              </p>
            ) : salves.length === 0 ? (
              <p className="rounded-2xl bg-muted p-5 text-center text-sm font-semibold text-muted-foreground">
                Nenhum salve por enquanto.
              </p>
            ) : (
              salves.map((salve) => {
                const incoming = salve.recipient_id === user?.id;
                const otherName = incoming ? salve.sender_name : salve.recipient_name;
                return (
                  <article key={salve.id} className="rounded-2xl border border-input p-4">
                    <p className="font-black">
                      {incoming
                        ? `${otherName ?? "Alguém"} te mandou um salve`
                        : `Salve para ${otherName ?? "Bafafã"}`}
                    </p>
                    {salve.opener && (
                      <p className="mt-2 rounded-xl bg-muted p-3 text-sm">{salve.opener}</p>
                    )}
                    <p className="mt-2 text-xs font-bold uppercase text-muted-foreground">
                      {salve.status}
                    </p>
                    {incoming && salve.status === "pending" && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() => void respondSalve(salve.id, false)}
                        >
                          Agora não
                        </Button>
                        <Button onClick={() => void respondSalve(salve.id, true)}>Dar moral</Button>
                      </div>
                    )}
                    {salve.status === "accepted" && (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-black text-primary">
                          Conversa liberada pelos dois.
                        </p>
                        {salve.thread_id && (
                          <Button
                            className="w-full"
                            onClick={() => {
                              setSalvesOpen(false);
                              void openPrivateConversation(salve.thread_id!, otherName ?? "Bafafã");
                            }}
                          >
                            <MessageCircleMore className="h-4 w-4" /> Abrir conversa
                          </Button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(privateThread)}
        onOpenChange={(open) => {
          if (!open) {
            setPrivateThread(null);
            setPrivateMessages([]);
            setPrivateDraft("");
          }
        }}
      >
        <DialogContent className="bafafa-dialog flex max-h-[82vh] max-w-md flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Conversa com {privateThread?.otherName}
            </DialogTitle>
            <DialogDescription>Esse papo só abriu porque os dois deram moral.</DialogDescription>
          </DialogHeader>
          <div className="min-h-48 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-muted p-3">
            {privateLoading ? (
              <p className="py-12 text-center text-sm font-bold text-muted-foreground">
                Abrindo a conversa…
              </p>
            ) : privateMessages.length === 0 ? (
              <p className="py-12 text-center text-sm font-semibold text-muted-foreground">
                O primeiro salve já foi dado. Agora é com vocês.
              </p>
            ) : (
              privateMessages.map((message) => {
                const mine = message.sender_id === user?.id;
                return (
                  <article
                    key={message.id}
                    className={`max-w-[86%] rounded-2xl px-3 py-2.5 text-sm ${
                      mine ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-card"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.body}</p>
                    <time
                      className={`mt-1 block text-[9px] font-bold ${mine ? "opacity-70" : "text-muted-foreground"}`}
                    >
                      {formatMessageTime(message.created_at)}
                    </time>
                  </article>
                );
              })
            )}
          </div>
          <form onSubmit={sendPrivateMessage} className="mt-3 flex items-end gap-2">
            <Textarea
              value={privateDraft}
              onChange={(event) => setPrivateDraft(event.target.value.slice(0, 1000))}
              placeholder="Manda a boa…"
              rows={2}
              className="min-h-12 flex-1 resize-none"
            />
            <Button
              type="submit"
              disabled={privateSending || !privateDraft.trim()}
              className="h-12 w-12 shrink-0 rounded-full p-0"
              aria-label="Enviar mensagem privada"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function MessageAction({
  label,
  onClick,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-full hover:bg-background ${destructive ? "hover:text-destructive" : "hover:text-foreground"}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function ResenhaUnavailable({
  session,
  onRetry,
}: {
  session: HouseSession | null;
  onRetry: () => void;
}) {
  if (!session) {
    return (
      <section className="content-card content-card--chat p-6 text-white">
        <Clock3 className="h-9 w-9" />
        <h2 className="mt-4 font-display text-4xl leading-none">A Resenha tá fechada agora.</h2>
        <p className="mt-3 text-sm font-semibold opacity-75">
          Quando o Bafafá abrir a conversa, o check-in aparece no Início.
        </p>
        <Link
          to="/inicio"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-mango px-5 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
        >
          Voltar ao Início
        </Link>
      </section>
    );
  }

  if (!session.checked_in) {
    return (
      <section className="content-card content-card--chat p-6 text-white">
        <MessageCircleMore className="h-9 w-9" />
        <h2 className="mt-4 font-display text-4xl leading-none">A Resenha começa no check-in.</h2>
        <p className="mt-3 text-sm font-semibold opacity-75">
          Confirme sua presença para conversar com quem já chegou ao Bafafá.
        </p>
        <Link
          to="/checkin"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-mango px-5 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
        >
          Confirmar minha presença <ShieldCheck className="h-4 w-4" />
        </Link>
      </section>
    );
  }

  const now = Date.now();
  const opensAt = new Date(session.chat_opens_at).getTime();
  const closesAt = new Date(session.chat_closes_at).getTime();
  const waiting = session.chat_enabled && now < opensAt;
  const ended = !session.chat_enabled || now > closesAt;

  return (
    <section className="content-card content-card--chat p-6 text-white">
      <Clock3 className="h-9 w-9" />
      <h2 className="mt-4 font-display text-4xl leading-none">
        {waiting
          ? `A Resenha abre às ${formatSessionTime(session.chat_opens_at)}.`
          : ended
            ? "A Resenha encerrou por hoje."
            : "A Resenha está abrindo."}
      </h2>
      <p className="mt-3 text-sm font-semibold opacity-75">
        {waiting
          ? "Sua presença já está confirmada. Volte no horário e entre direto na conversa."
          : ended
            ? "As mensagens ficam fechadas até a próxima Sessão da Casa."
            : "Sua presença está confirmada. Atualize para entrar na conversa."}
      </p>
      {!waiting && !ended && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-mango px-5 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar Resenha
        </button>
      )}
    </section>
  );
}

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
