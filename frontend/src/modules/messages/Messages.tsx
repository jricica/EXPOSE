import { FormEvent, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import {
  messageService,
  type Conversation,
  type MessageItem,
  type PublicUser,
} from './message.service';
import './Messages.css';

const partnerName = (user?: PublicUser) => user?.display_name || user?.username || `Usuario #${user?.id ?? '?'}`;

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [userResults, setUserResults] = useState<PublicUser[]>([]);
  const [userMap, setUserMap] = useState<Record<number, PublicUser>>({});
  const [sending, setSending] = useState(false);
  const myUserId = user?.id;

  const enrichUsers = async (items: Conversation[]) => {
    if (!myUserId) return;
    const partnerIds = Array.from(
      new Set(
        items
          .map((conv) => conv.participantIds.find((id) => id !== myUserId))
          .filter((id): id is number => Boolean(id)),
      ),
    );

    if (partnerIds.length === 0) return;

    const loaded = await Promise.all(
      partnerIds.map(async (id) => {
        try {
          return await messageService.getUserById(id);
        } catch {
          return null;
        }
      }),
    );

    const nextMap: Record<number, PublicUser> = {};
    for (const item of loaded) {
      if (item) nextMap[item.id] = item;
    }
    if (Object.keys(nextMap).length > 0) {
      setUserMap((prev) => ({ ...prev, ...nextMap }));
    }
  };

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      setError(null);
      const items = await messageService.listConversations();
      setConversations(items);
      if (items.length > 0 && !selectedConversationId) {
        setSelectedConversationId(items[0].conversationId);
      }
      await enrichUsers(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las conversaciones.');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      setError(null);
      const response = await messageService.listConversationMessages(conversationId, 100);
      setMessages((response.messages || []).slice().reverse());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los mensajes.');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.conversationId === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  const activePartnerId = useMemo(() => {
    if (!activeConversation || !myUserId) return undefined;
    return activeConversation.participantIds.find((id) => id !== myUserId);
  }, [activeConversation, myUserId]);

  const handleUserSearch = async () => {
    const term = search.trim();
    if (!term) {
      setUserResults([]);
      return;
    }
    try {
      const results = await messageService.searchUsers(term);
      const filtered = results.filter((candidate) => candidate.id !== myUserId);
      setUserResults(filtered);
      setUserMap((prev) => {
        const merged = { ...prev };
        filtered.forEach((item) => {
          merged[item.id] = item;
        });
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar usuarios.');
    }
  };

  const handleOpenDirect = async (targetUserId: number) => {
    try {
      const conversation = await messageService.createOrGetDirectConversation(targetUserId);
      setUserResults([]);
      setSearch('');
      await loadConversations();
      setSelectedConversationId(conversation.conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el chat directo.');
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId || !draft.trim()) return;

    try {
      setSending(true);
      const sent = await messageService.sendConversationMessage(selectedConversationId, draft.trim());
      setDraft('');
      setMessages((prev) => [...prev, sent]);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <section className="messages-shell">
        <div className="messages-header">
          <h2>Mensajes directos</h2>
          <p>Inicia conversaciones y revisa tus chats privados.</p>
        </div>

        <div className="messages-start-box">
          <input
            type="text"
            placeholder="Buscar usuario por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button onClick={() => void handleUserSearch()}>Buscar</button>
        </div>

        {userResults.length > 0 ? (
          <div className="messages-user-results">
            {userResults.map((candidate) => (
              <button key={candidate.id} onClick={() => void handleOpenDirect(candidate.id)}>
                Abrir chat con {partnerName(candidate)}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="messages-error">{error}</p> : null}

        <div className="messages-grid">
          <aside className="messages-list">
            {loadingConversations ? <p>Cargando conversaciones...</p> : null}
            {!loadingConversations && conversations.length === 0 ? <p>Aún no tienes conversaciones.</p> : null}
            {conversations.map((conversation) => {
              const partnerId = myUserId
                ? conversation.participantIds.find((id) => id !== myUserId)
                : undefined;
              const partner = partnerId ? userMap[partnerId] : undefined;
              return (
                <button
                  key={conversation.conversationId}
                  className={conversation.conversationId === selectedConversationId ? 'active' : ''}
                  onClick={() => setSelectedConversationId(conversation.conversationId)}
                >
                  <strong>{partnerName(partner)}</strong>
                  <span>{conversation.lastMessagePreview || 'Sin mensajes aún'}</span>
                </button>
              );
            })}
          </aside>

          <div className="messages-chat">
            {!selectedConversationId ? <p>Selecciona una conversación para ver mensajes.</p> : null}
            {selectedConversationId && loadingMessages ? <p>Cargando mensajes...</p> : null}
            {selectedConversationId && !loadingMessages && messages.length === 0 ? (
              <p>Envía el primer mensaje de esta conversación.</p>
            ) : null}

            {selectedConversationId ? (
              <>
                <div className="messages-thread">
                  {messages.map((message) => {
                    const mine = myUserId === message.senderId;
                    return (
                      <div key={message.messageId} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                        <span>{message.content}</span>
                        <small>
                          {mine ? 'Tú' : partnerName(activePartnerId ? userMap[activePartnerId] : undefined)} ·{' '}
                          {new Date(message.createdAt).toLocaleString()}
                        </small>
                      </div>
                    );
                  })}
                </div>

                <form className="messages-compose" onSubmit={handleSend}>
                  <input
                    type="text"
                    placeholder="Escribe un mensaje..."
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button type="submit" disabled={sending || !draft.trim()}>
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Messages;
