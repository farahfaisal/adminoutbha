import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import {
  MessageSquare,
  Send,
  Search,
  CheckCheck,
  Clock,
  User,
  Phone,
  ChevronRight,
  Inbox,
  RefreshCw
} from 'lucide-react';

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function CustomerMessages() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_conversations')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      const sorted = data || [];
      setConversations(sorted);

      const unread = sorted.filter(c => c.status === 'open').length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('فشل في تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      setMessagesLoading(true);
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark customer messages as read
      const unreadCustomerMessages = (data || []).filter(
        m => m.sender_type === 'customer' && !m.read_at
      );
      if (unreadCustomerMessages.length > 0) {
        const now = new Date().toISOString();
        await supabase
          .from('support_messages')
          .update({ read_at: now })
          .in('id', unreadCustomerMessages.map(m => m.id));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('فشل في تحميل الرسائل');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    try {
      setSending(true);
      const { data, error } = await supabase
        .from('support_messages')
        .insert([{
          conversation_id: selectedConversation.id,
          sender_type: 'admin',
          body: replyText.trim(),
          read_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      setReplyText('');

      // Update conversation last_message_at
      await supabase
        .from('support_conversations')
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      // Move conversation to top
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === selectedConversation.id
            ? { ...c, last_message_at: new Date().toISOString() }
            : c
        );
        return updated.sort((a, b) =>
          new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)
        );
      });
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('فشل في إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleCloseConversation = async (conversation) => {
    try {
      const { error } = await supabase
        .from('support_conversations')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', conversation.id);

      if (error) throw error;

      toast.success('تم إغلاق المحادثة');
      fetchConversations();
    } catch (error) {
      console.error('Error closing conversation:', error);
      toast.error('فشل في إغلاق المحادثة');
    }
  };

  useEffect(() => {
    fetchConversations();

    // Realtime subscription for new messages
    const channel = supabase
      .channel('customer-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages'
      }, (payload) => {
        const newMessage = payload.new;
        if (newMessage.sender_type === 'customer') {
          if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
            setMessages(prev => [...prev, newMessage]);
            // Mark as read
            supabase
              .from('support_messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', newMessage.id);
          } else {
            toast.info('رسالة جديدة من زبون', {
              position: 'top-center',
              autoClose: 4000
            });
          }
          fetchConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, selectedConversation]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `قبل ${diffMin} دقيقة`;
    if (diffHr < 24) return `قبل ${diffHr} ساعة`;
    if (diffDay < 7) return `قبل ${diffDay} يوم`;
    return date.toLocaleDateString('ar');
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">رسائل الزبائن</h2>
          <p className="text-gray-500 mt-1">محادثات الدعم من الزبائن</p>
        </div>
        <button
          onClick={fetchConversations}
          className="p-2 rounded-lg bg-white shadow hover:bg-gray-50 transition-colors"
          title="تحديث"
        >
          <RefreshCw size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        <div className="flex h-full">
          {/* Conversations List */}
          <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-l border-gray-200 bg-gray-50`}>
            <div className="p-3 border-b border-gray-200 bg-white">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن زبون..."
                  className="w-full pr-10 pl-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <Inbox size={40} className="mb-2" />
                  <p className="text-sm">لا توجد محادثات</p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`w-full text-right p-3 border-b border-gray-100 hover:bg-white transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-white border-r-4 border-r-red-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <User className="text-red-600" size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-800 text-sm truncate">
                            {conv.customer_name || 'زبون غير معروف'}
                          </h3>
                          <span className="text-xs text-gray-400 flex-shrink-0 mr-2">
                            {formatTime(conv.last_message_at || conv.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <Phone size={12} />
                          {conv.customer_phone || '—'}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            conv.status === 'open'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {conv.status === 'open' ? 'مفتوحة' : 'مغلقة'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages Panel */}
          {selectedConversation ? (
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden p-1 rounded hover:bg-gray-100"
                  >
                    <ChevronRight className="text-gray-600" size={24} />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <User className="text-red-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {selectedConversation.customer_name || 'زبون غير معروف'}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={12} />
                      {selectedConversation.customer_phone || '—'}
                    </p>
                  </div>
                </div>
                {selectedConversation.status === 'open' && (
                  <button
                    onClick={() => handleCloseConversation(selectedConversation)}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1 rounded-lg hover:bg-red-50"
                  >
                    إغلاق المحادثة
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messagesLoading ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageSquare size={40} className="mb-2" />
                    <p className="text-sm">لا توجد رسائل</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.sender_type === 'admin'
                            ? 'bg-red-600 text-white rounded-bl-sm'
                            : 'bg-white text-gray-800 shadow-sm rounded-br-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                        <div className={`flex items-center gap-1 mt-1 ${
                          msg.sender_type === 'admin' ? 'text-red-200' : 'text-gray-400'
                        }`}>
                          <span className="text-xs">{formatTime(msg.created_at)}</span>
                          {msg.sender_type === 'admin' && msg.read_at && (
                            <CheckCheck size={14} />
                          )}
                          {msg.sender_type === 'admin' && !msg.read_at && (
                            <Clock size={14} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Input */}
              {selectedConversation.status === 'open' && (
                <form onSubmit={handleSendReply} className="p-3 border-t border-gray-200 bg-white">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="اكتب ردك..."
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={sending}
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="p-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
              <div className="text-center text-gray-400">
                <MessageSquare size={60} className="mx-auto mb-3" />
                <p className="text-lg font-medium">اختر محادثة لعرض الرسائل</p>
                <p className="text-sm mt-1">يمكنك الرد على رسائل الزبائن من هنا</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
