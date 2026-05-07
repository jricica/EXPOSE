import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../auth/AuthContext';
import { messageService, type Conversation, type Message } from './message.service';
import { profileService } from '../profile/profile.service';
import { motion } from 'framer-motion';
import { Send, Paperclip, Search, MoreVertical, Trash2 } from 'lucide-react';
import './Messages.css';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    }
  }, [selectedConvId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await messageService.listConversations();
      setConversations(data);
    } catch (err) {
      console.error('Error loading conversations', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      setLoadingMessages(true);
      const data = await messageService.getConversationMessages(convId);
      setMessages(data.messages.reverse()); // Assume API returns newest first
    } catch (err) {
      console.error('Error loading messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedConvId || (!newMessage.trim() && !selectedFile)) return;

    try {
      setSending(true);
      let mediaUrl: string | undefined;
      
      if (selectedFile) {
        // Reuse profile avatar upload for now or create a dedicated one
        const { url } = await profileService.uploadAvatar(selectedFile);
        mediaUrl = url;
      }

      const msg = await messageService.sendMessage(selectedConvId, newMessage, mediaUrl);
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      setSelectedFile(null);
      
      // Update preview in conversations list
      setConversations(prev => prev.map(c => 
        c.conversationId === selectedConvId 
        ? { ...c, lastMessagePreview: mediaUrl ? '📷 Archivo' : newMessage, updatedAt: new Date().toISOString() } 
        : c
      ));
    } catch (err) {
      console.error('Error sending message', err);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // const activeConversation = conversations.find(c => c.conversationId === selectedConvId);

  return (
    <Layout>
      <div className="messages-shell">
        <aside className="convos-sidebar">
          <div className="sidebar-header">
            <h2>Mensajes</h2>
            <div className="search-bar">
              <Search size={14} />
              <input type="text" placeholder="Buscar rastros..." />
            </div>
          </div>
          
          <div className="convos-list">
            {loading ? (
              <div className="convos-loading">Buscando señales...</div>
            ) : conversations.length === 0 ? (
              <div className="convos-empty">No hay conversaciones activas.</div>
            ) : (
              conversations.map((conv) => (
                <motion.div
                  key={conv.conversationId}
                  className={`convo-item ${selectedConvId === conv.conversationId ? 'active' : ''}`}
                  onClick={() => setSelectedConvId(conv.conversationId)}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="convo-avatar">∅</div>
                  <div className="convo-info">
                    <div className="convo-top">
                      <span className="convo-name">Anon #{conv.conversationId.split('#')[0].slice(-4)}</span>
                      <span className="convo-time">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="convo-preview">{conv.lastMessagePreview || 'Sin mensajes todavía'}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </aside>

        <main className="chat-area">
          {selectedConvId ? (
            <>
              <header className="chat-header">
                <div className="chat-user-info">
                  <div className="chat-avatar">∅</div>
                  <div>
                    <h3>Anónimo</h3>
                    <span>24H de rastro activo</span>
                  </div>
                </div>
                <div className="chat-actions">
                  <button><Trash2 size={18} /></button>
                  <button><MoreVertical size={18} /></button>
                </div>
              </header>

              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="messages-loading">Recuperando transmisión...</div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === user?.id;
                    return (
                      <motion.div
                        key={msg.messageId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`message-row ${isMine ? 'mine' : 'theirs'}`}
                      >
                        <div className="message-bubble">
                          {msg.mediaUrl && (
                            <div className="message-media">
                              <img src={msg.mediaUrl} alt="attachment" />
                            </div>
                          )}
                          {msg.content && <p>{msg.content}</p>}
                          <span className="message-time">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input-area" onSubmit={handleSend}>
                <div className="input-wrapper-inner">
                  {selectedFile && (
                    <div className="selected-file-tag">
                      <span>{selectedFile.name}</span>
                      <button type="button" onClick={() => setSelectedFile(null)}>×</button>
                    </div>
                  )}
                  <div className="input-row-inner">
                    <button type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip size={20} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      onChange={handleFileSelect} 
                      accept="image/*"
                    />
                    <input 
                      type="text" 
                      placeholder="Escribe un mensaje efímero..." 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      disabled={sending}
                    />
                  </div>
                </div>
                <button type="submit" className="send-btn" disabled={sending || (!newMessage.trim() && !selectedFile)}>
                  <Send size={20} />
                </button>
              </form>
            </>
          ) : (
            <div className="chat-placeholder">
              <div className="placeholder-icon">∅</div>
              <h2>Selecciona una transmisión</h2>
              <p>Los mensajes privados en EXPOSE son temporales y cifrados. No dejes rastros permanentes.</p>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
};

export default Messages;
