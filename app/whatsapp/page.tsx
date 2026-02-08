"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { Search, MessageCircle, User, Phone } from "lucide-react";

interface Conversation {
    id: string;
    phone_number: string;
    customer_name: string | null;
    status: string;
    updated_at: string;
    last_message?: string;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

export default function WhatsAppPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [msgLoading, setMsgLoading] = useState(false);

    useEffect(() => {
        fetchConversations();

        // Subscribe to changes
        const channel = supabase
            .channel('whatsapp_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, () => {
                fetchConversations();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
                if (selectedConv && payload.new && (payload.new as any).conversation_id === selectedConv) {
                    fetchMessages(selectedConv);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedConv]);

    const fetchConversations = async () => {
        const { data, error } = await supabase
            .from('whatsapp_conversations')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
        } else {
            setConversations(data || []);
        }
        setIsLoading(false);
    };

    const fetchMessages = async (convId: string) => {
        setMsgLoading(true);
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            setMessages(data || []);
        }
        setMsgLoading(false);
    };

    const handleSelectConversation = (id: string) => {
        setSelectedConv(id);
        fetchMessages(id);
    };

    const selectedConversation = conversations.find(c => c.id === selectedConv);

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6">
            {/* Conversations List */}
            <div className="w-1/3 bg-[#1c1c1c] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-white mb-4">Conversations</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-lime-500/50"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-gray-500">Loading...</div>
                    ) : (
                        conversations.map((conv) => (
                            <div
                                key={conv.id}
                                onClick={() => handleSelectConversation(conv.id)}
                                className={`p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${selectedConv === conv.id ? 'bg-white/10' : ''
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-white">
                                        {conv.customer_name || conv.phone_number}
                                    </h3>
                                    <span className="text-xs text-gray-500">
                                        {format(new Date(conv.updated_at), 'HH:mm')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    {conv.status === 'escalated' && (
                                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded uppercase font-bold">Escalated</span>
                                    )}
                                    <span className="truncate">{conv.status}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat View */}
            <div className="flex-1 bg-[#1c1c1c] rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                {selectedConv ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-lime-400 to-emerald-500 flex items-center justify-center text-black font-bold">
                                    {(selectedConversation?.customer_name?.[0] || 'U')}
                                </div>
                                <div>
                                    <h2 className="font-bold text-white">{selectedConversation?.customer_name || 'Unknown User'}</h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Phone size={14} />
                                        <span>{selectedConversation?.phone_number}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {selectedConversation?.status === 'escalated' && (
                                    <button className="px-3 py-1.5 bg-lime-500 text-black text-sm font-bold rounded-lg hover:bg-lime-400 transition-colors">
                                        Mark Resolved
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {msgLoading ? (
                                <div className="text-center text-gray-500 mt-10">Loading chat...</div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] p-4 rounded-2xl ${msg.role === 'user'
                                                    ? 'bg-white/10 text-white rounded-tl-none'
                                                    : 'bg-lime-500 text-black rounded-tr-none'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            <p className={`text-[10px] mt-2 ${msg.role === 'user' ? 'text-gray-400' : 'text-black/60'}`}>
                                                {format(new Date(msg.created_at), 'HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input (Read only for now) */}
                        <div className="p-4 border-t border-white/5 bg-[#181818] text-center text-gray-500 text-sm">
                            This is a read-only view of the WhatsApp conversation.
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <MessageCircle size={48} className="mb-4 opacity-20" />
                        <p>Select a conversation to view history</p>
                    </div>
                )}
            </div>
        </div>
    );
}
