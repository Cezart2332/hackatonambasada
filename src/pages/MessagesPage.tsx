import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Inbox,
  Loader2,
  MessageCircle,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlatformRegisteredBadge } from "@/components/PlatformRegisteredBadge";
import { api } from "@/lib/api";
import { messageFromUnknownError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { ConversationSummary, DirectMessage } from "@/lib/types";

type MessagesPageProps = {
  isVenue: boolean;
  isActive: boolean;
  pendingCounterpartId: string | null;
  onPendingCounterpartHandled: () => void;
  onUnreadCountChange: (count: number) => void;
};

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function conversationTitle(conversation: ConversationSummary) {
  return conversation.counterpartBusinessName || conversation.counterpartName;
}

export function MessagesPage({
  isVenue,
  isActive,
  pendingCounterpartId,
  onPendingCounterpartHandled,
  onUnreadCountChange,
}: MessagesPageProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null;

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { unreadCount } = await api.getUnreadMessageCount();
      onUnreadCountChange(unreadCount);
    } catch {
      // badge optional
    }
  }, [onUnreadCountChange]);

  const loadConversations = useCallback(async () => {
    try {
      const { conversations: next } = await api.listConversations();
      setConversations(next);
      await refreshUnreadCount();
    } catch (loadError) {
      setError(messageFromUnknownError(loadError, "Nu am putut încărca conversațiile."));
    } finally {
      setLoadingConversations(false);
    }
  }, [refreshUnreadCount]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { messages: next } = await api.getConversationMessages(conversationId);
      setMessages(next);
      await api.markConversationRead(conversationId);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId ? { ...item, unreadCount: 0 } : item,
        ),
      );
      await refreshUnreadCount();
    } catch (loadError) {
      setError(messageFromUnknownError(loadError, "Nu am putut încărca mesajele."));
    } finally {
      setLoadingMessages(false);
    }
  }, [refreshUnreadCount]);

  const openConversationWithCounterpart = useCallback(
    async (counterpartUserId: string) => {
      setError(null);
      try {
        const { conversation } = await api.openConversation(counterpartUserId);
        setConversations((current) => {
          const existing = current.find((item) => item.id === conversation.id);
          if (existing) {
            return current.map((item) => (item.id === conversation.id ? conversation : item));
          }
          return [conversation, ...current];
        });
        setActiveConversationId(conversation.id);
        setMobileThreadOpen(true);
        await loadMessages(conversation.id);
      } catch (openError) {
        setError(messageFromUnknownError(openError, "Nu am putut deschide conversația."));
      }
    },
    [loadMessages],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!pendingCounterpartId) return;
    void openConversationWithCounterpart(pendingCounterpartId).finally(() => {
      onPendingCounterpartHandled();
    });
  }, [pendingCounterpartId, openConversationWithCounterpart, onPendingCounterpartHandled]);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => {
      void loadConversations();
      if (activeConversationId) {
        void loadMessages(activeConversationId);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [isActive, activeConversationId, loadConversations, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loadingMessages]);

  async function handleSelectConversation(conversationId: string) {
    setActiveConversationId(conversationId);
    setMobileThreadOpen(true);
    await loadMessages(conversationId);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeConversationId || sending) return;

    setSending(true);
    setError(null);
    try {
      const { message } = await api.sendDirectMessage(activeConversationId, body);
      setMessages((current) => [...current, message]);
      setDraft("");
      setConversations((current) =>
        current
          .map((item) =>
            item.id === activeConversationId
              ? {
                  ...item,
                  lastMessage: {
                    body: message.body,
                    createdAt: message.createdAt,
                    senderUserId: message.senderUserId,
                  },
                  updatedAt: message.createdAt,
                }
              : item,
          )
          .sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
      );
      await refreshUnreadCount();
    } catch (sendError) {
      setError(messageFromUnknownError(sendError, "Nu am putut trimite mesajul."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside
        className={cn(
          "flex min-h-0 w-full flex-col border-r border-[#d7ccb3] bg-[#fbf7ed] md:w-[320px] lg:w-[360px]",
          mobileThreadOpen ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[#d7ccb3] px-4 py-3">
          <Inbox className="h-5 w-5 text-[#4d6638]" />
          <div>
            <p className="text-sm font-extrabold text-[#263421]">Mesaje</p>
            <p className="text-xs text-muted-foreground">
              {isVenue ? "Producători înregistrați" : "Localuri înregistrate"}
            </p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loadingConversations ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Se încarcă conversațiile...
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-[#b8c4a8]" />
              <p className="text-sm font-bold text-[#33412c]">Nicio conversație încă</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Deschide o conversație din Director, la „Scrie mesaj” pe un partener înregistrat.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eadfca]">
              {conversations.map((conversation) => {
                const active = conversation.id === activeConversationId;
                const title = conversationTitle(conversation);

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void handleSelectConversation(conversation.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#f3ecdd]",
                      active && "bg-[#e9f0dc]",
                    )}
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9f0dc] text-[#4d6638]">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-extrabold text-[#263421]">{title}</p>
                        {conversation.lastMessage ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatMessageTime(conversation.lastMessage.createdAt)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {conversation.lastMessage?.body ?? "Conversație nouă"}
                      </p>
                    </div>
                    {conversation.unreadCount > 0 ? (
                      <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </aside>

      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-[#f7f3e8]",
          !mobileThreadOpen && !activeConversation ? "hidden md:flex" : "flex",
        )}
      >
        {activeConversation ? (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-[#d7ccb3] bg-[#fbf7ed] px-4 py-3">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="md:hidden"
                onClick={() => setMobileThreadOpen(false)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-extrabold text-[#263421]">
                    {conversationTitle(activeConversation)}
                  </p>
                  <PlatformRegisteredBadge />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {activeConversation.counterpartName}
                </p>
              </div>
            </div>

            <ScrollArea className="chat-pattern min-h-0 flex-1">
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se încarcă mesajele...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d7ccb3] bg-[#fffaf0] px-4 py-8 text-center text-sm text-muted-foreground">
                    Spune salut și începe conversația.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.isMine ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                          message.isMine
                            ? "bg-[#4d6638] text-white"
                            : "border border-[#d7ccb3] bg-white text-[#2b3725]",
                        )}
                      >
                        <p>{message.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            message.isMine ? "text-white/70" : "text-muted-foreground",
                          )}
                        >
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {error ? (
              <div className="shrink-0 border-t border-rose-200 bg-rose-50 px-4 py-2 text-center text-xs text-rose-700">
                {error}
              </div>
            ) : null}

            <form
              onSubmit={(event) => void handleSend(event)}
              className="flex shrink-0 items-center gap-2 border-t border-[#d7ccb3] bg-[#f8f4ea]/95 px-4 py-3"
            >
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Scrie un mesaj..."
                disabled={sending}
                className="bg-white/90"
              />
              <Button type="submit" size="icon" variant="honey" disabled={!draft.trim() || sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Trimite</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <MessageCircle className="mb-4 h-12 w-12 text-[#b8c4a8]" />
            <p className="text-base font-extrabold text-[#263421]">Alege o conversație</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Conversațiile noi se deschid din Director, la un partener înregistrat.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
