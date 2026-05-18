import { useState, useEffect, useCallback, useRef } from 'react';
import type { Conversation, Message, User } from '../types';
import type { ApiFetch } from './useApi';
import { useRealtime } from './useRealtime';

interface ConversationsResponse {
  conversations: Conversation[];
}

interface MessagesResponse {
  messages: Message[];
}

interface CreateConversationResponse {
  conversation: Conversation;
}

interface SendMessageResponse {
  message: Message;
}

interface LastSeenMap {
  [convId: string]: string;
}

interface UseMessagingOptions {
  enableRealtime?: boolean;
}

export const useMessaging = (
  currentUser: User | null,
  authResolved: boolean,
  apiFetch: ApiFetch,
  options: UseMessagingOptions = {}
) => {
  const { enableRealtime = true } = options;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [convMessages, setConvMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messagingSending, setMessagingSending] = useState(false);
  const [lastSeenMap, setLastSeenMap] = useState<LastSeenMap>(() => {
    try {
      const stored = localStorage.getItem('skyllswap_lastSeen');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const convPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const hasUnreadUpdateRef = useRef(false);

  const {
    isConnected,
    joinConversation,
    leaveConversation,
    onNewMessage,
    onConversationUpdated,
  } = useRealtime({
    userId: currentUser?.id ?? null,
    enabled: enableRealtime && authResolved && !!currentUser,
  });

  useEffect(() => {
    if (!authResolved) return;

    const loadConversations = async () => {
      if (!currentUser) {
        setConversations([]);
        setActiveConvId(null);
        setConvMessages([]);
        return;
      }

      try {
        const res = await apiFetch('/api/conversations');
        if (res.ok) {
          const data = (await res.json()) as ConversationsResponse;
          setConversations(data.conversations || []);
        }
      } catch {
        // no-op
      }
    };

    loadConversations();
  }, [apiFetch, authResolved, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages]);

  useEffect(() => {
    if (!activeConvId) return;
    joinConversation(activeConvId);
    return () => {
      leaveConversation(activeConvId);
    };
  }, [activeConvId, joinConversation, leaveConversation]);

  useEffect(() => {
    onNewMessage(data => {
      const { message, conversationId } = data as {
        message: Message;
        conversationId: number;
      };

      setConvMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (prev.length > 0 && lastMsg && lastMsg.id === message.id) {
          return prev;
        }
        return [...prev, message];
      });

      hasUnreadUpdateRef.current = conversationId !== activeConvId;
    });
  }, [onNewMessage, activeConvId]);

  useEffect(() => {
    onConversationUpdated(async () => {
      try {
        const res = await apiFetch('/api/conversations');
        if (res.ok) {
          const data = (await res.json()) as ConversationsResponse;
          setConversations(data.conversations || []);
        }
      } catch {
        // no-op
      }
    });
  }, [onConversationUpdated, apiFetch]);

  useEffect(() => {
    if (!authResolved || !currentUser || !activeConvId || isConnected) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      return;
    }

    const pollMessages = async () => {
      try {
        const res = await apiFetch(
          `/api/conversations/${activeConvId}/messages`
        );
        if (res.ok) {
          const data = (await res.json()) as MessagesResponse;
          setConvMessages(data.messages || []);
        }
      } catch {
        // no-op
      }
    };

    pollingIntervalRef.current = setInterval(pollMessages, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [activeConvId, currentUser, authResolved, apiFetch, isConnected]);

  useEffect(() => {
    if (!authResolved || !currentUser || isConnected) {
      if (convPollingIntervalRef.current) {
        clearInterval(convPollingIntervalRef.current);
      }
      return;
    }

    const pollConversations = async () => {
      try {
        const res = await apiFetch('/api/conversations');
        if (res.ok) {
          const data = (await res.json()) as ConversationsResponse;
          setConversations(data.conversations || []);
        }
      } catch {
        // no-op
      }
    };

    convPollingIntervalRef.current = setInterval(pollConversations, 15000);

    return () => {
      if (convPollingIntervalRef.current) {
        clearInterval(convPollingIntervalRef.current);
      }
    };
  }, [currentUser, authResolved, apiFetch, isConnected]);

  const markConvRead = useCallback((convId: number, updatedAt: string) => {
    setLastSeenMap(prev => {
      const next = { ...prev, [String(convId)]: updatedAt };
      localStorage.setItem('skyllswap_lastSeen', JSON.stringify(next));
      return next;
    });
  }, []);

  const isUnread = useCallback(
    (conv: Conversation): boolean => {
      if (conv.id === activeConvId) return false;
      const lastMsg = conv.messages?.[0];
      if (!lastMsg) return false;
      const lastSeen = lastSeenMap[String(conv.id)];
      if (!lastSeen) return true;
      return new Date(conv.updatedAt) > new Date(lastSeen);
    },
    [activeConvId, lastSeenMap]
  );

  const startConversation = useCallback(
    async (recipientId: number): Promise<void> => {
      if (!currentUser || !recipientId) return;

      try {
        const res = await apiFetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientId }),
        });

        if (res.ok) {
          const data = (await res.json()) as CreateConversationResponse;
          const conv = data.conversation;
          setConversations(prev => {
            const exists = prev.find(c => c.id === conv.id);
            return exists
              ? prev.map(c => (c.id === conv.id ? conv : c))
              : [conv, ...prev];
          });
          setActiveConvId(conv.id);
          setConvMessages(conv.messages || []);
        }
      } catch {
        // no-op
      }
    },
    [apiFetch, currentUser]
  );

  const loadMessages = useCallback(
    async (convId: number): Promise<void> => {
      try {
        const res = await apiFetch(`/api/conversations/${convId}/messages`);
        if (res.ok) {
          const data = (await res.json()) as MessagesResponse;
          setConvMessages(data.messages || []);
        }
      } catch {
        // no-op
      }
    },
    [apiFetch]
  );

  const sendMessage = useCallback(
    async (event: React.FormEvent): Promise<void> => {
      event.preventDefault();
      if (!newMessage.trim() || !activeConvId) return;

      setMessagingSending(true);
      try {
        const res = await apiFetch(
          `/api/conversations/${activeConvId}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newMessage.trim() }),
          }
        );

        if (res.ok) {
          const data = (await res.json()) as SendMessageResponse;
          setConvMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (prev.length > 0 && lastMsg && lastMsg.id === data.message.id) {
              return prev;
            }
            return [...prev, data.message];
          });
          setNewMessage('');
        }
      } catch {
        // no-op
      } finally {
        setMessagingSending(false);
      }
    },
    [apiFetch, activeConvId, newMessage]
  );

  const selectConversation = useCallback(
    (convId: number): void => {
      setActiveConvId(convId);
      loadMessages(convId);
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        markConvRead(convId, conv.updatedAt);
      }
    },
    [conversations, loadMessages, markConvRead]
  );

  const unreadCount = conversations.filter(isUnread).length;

  return {
    conversations,
    activeConvId,
    selectConversation,
    convMessages,
    newMessage,
    setNewMessage,
    sendMessage,
    startConversation,
    messagesEndRef,
    isUnread,
    unreadCount,
    messagingSending,
    isConnected,
  };
};
