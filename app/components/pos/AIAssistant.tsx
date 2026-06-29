import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface AIAssistantProps {
  userRole: string;
  userId?: string;
}

interface HistoryEntry {
  role: 'user' | 'model';
  text: string;
}

interface ConfirmationData {
  action: 'RESTOCK' | 'REDUCE';
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  prompt: string;
  movementType?: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  // Clarification (ambiguous product matches)
  needClarification?: boolean;
  matches?: Array<{ id: string; name: string; stock: number; unit: string }>;
  pendingAction?: { action: 'RESTOCK' | 'REDUCE'; quantity: number; prompt: string };
  // Confirmation (stock mutation confirm)
  needConfirmation?: boolean;
  confirmationData?: ConfirmationData;
}

// ── Rate limiter (client-side guard: max 20 msgs per 60s) ────────────────────
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const sentTimestamps: number[] = [];
function isRateLimited(): boolean {
  const now = Date.now();
  while (sentTimestamps.length && sentTimestamps[0] < now - RATE_WINDOW_MS) {
    sentTimestamps.shift();
  }
  if (sentTimestamps.length >= RATE_LIMIT) return true;
  sentTimestamps.push(now);
  return false;
}

// ── Sanitize prompt (prevent injection attempts) ─────────────────────────────
function sanitizePrompt(input: string): string {
  return input
    .replace(/[<>{}[\]]/g, '') // strip brackets
    .replace(/\b(ignore previous|forget all|act as|you are now|system:|assistant:)/gi, '')
    .trim()
    .slice(0, 500); // max 500 chars
}

// ── Format bold markdown (*text*) ────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i}>{part.slice(1, -1)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const WELCOME_TEXT = `Halo, Owner! Saya *Velo*, asisten AI Warung Rafilah.

Saya memahami seluruh sistem POS ini. Yang bisa saya bantu:

🔄 *Kelola Stok*
✓ "tambah stok surya 10 slop"
✓ "indomilk rusak 3 karena expired"

📦 *Info Produk & Stok*
✓ "stok amaterasun berapa?"
✓ "produk apa yang hampir habis?"
✓ "barang konsinyasi apa saja?"
✓ "riwayat stok kopi kapal api"

📊 *Laporan Harian*
✓ "omset hari ini?"
✓ "profit hari ini berapa?"
✓ "berapa transaksi QRIS hari ini?"
✓ "produk terlaris hari ini?"

💰 *Hutang & Pelanggan*
✓ "siapa yang punya hutang?"
✓ "hutang si Andi berapa?"

🤝 *Agen & Keuangan*
✓ "saldo float agen berapa?"
✓ "sesi kasir sekarang siapa?"`;

export default function AIAssistant({ userRole, userId }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', sender: 'ai', text: WELCOME_TEXT, timestamp: new Date() },
  ]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen, scrollToBottom]);

  if (userRole !== 'owner') return null;

  // ── Core API call ────────────────────────────────────────────────────────
  const callAPI = async (body: object) => {
    const res = await fetch('/api/ai/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'owner',
        'x-user-id': userId || 'owner',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Gagal menghubungi server.');
    return data;
  };

  // ── Handle send ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    if (isRateLimited()) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: '⚠️ Terlalu banyak permintaan. Tunggu sebentar sebelum mengirim lagi.',
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const rawText = prompt.trim();
    const safeText = sanitizePrompt(rawText);
    setPrompt('');

    const userMsgId = Math.random().toString();
    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: rawText, timestamp: new Date() }]);
    setLoading(true);

    try {
      const data = await callAPI({ prompt: safeText, history: history.slice(-6) });

      const aiMsgId = Math.random().toString();

      if (data.need_clarification) {
        // Ambiguous product — ask user to pick
        const isReduce = /\b(kurang|hilang|rusak|expired|buang|potong)\b/i.test(rawText);
        const qtyMatch = rawText.match(/\b(\d+)\b/);
        const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        setMessages(prev => [
          ...prev,
          {
            id: aiMsgId,
            sender: 'ai',
            text: data.message,
            timestamp: new Date(),
            needClarification: true,
            matches: data.matches,
            pendingAction: { action: isReduce ? 'REDUCE' : 'RESTOCK', quantity, prompt: safeText },
          },
        ]);
      } else if (data.need_confirmation) {
        // Stock mutation — ask owner to confirm before executing
        setMessages(prev => [
          ...prev,
          {
            id: aiMsgId,
            sender: 'ai',
            text: data.message,
            timestamp: new Date(),
            needConfirmation: true,
            confirmationData: data.confirmation_data,
          },
        ]);
      } else {
        // Normal response
        const aiText = data.message || 'Perintah tidak dipahami.';
        setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: aiText, timestamp: new Date() }]);
        // Update conversation history (keep last 3 exchanges = 6 entries)
        setHistory(prev => [
          ...prev,
          { role: 'user' as const, text: safeText },
          { role: 'model' as const, text: aiText },
        ].slice(-6));
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: Math.random().toString(), sender: 'ai', text: `⚠️ ${err.message}`, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm stock mutation ────────────────────────────────────────────────
  const handleConfirm = async (msgId: string, confirmed: boolean) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, needConfirmation: false } : m));
    if (!confirmed) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: 'Perintah dibatalkan.',
        timestamp: new Date(),
      }]);
      return;
    }

    const msg = messages.find(m => m.id === msgId);
    if (!msg?.confirmationData) return;
    const cd = msg.confirmationData;
    setLoading(true);
    try {
      const data = await callAPI({
        prompt: cd.prompt,
        productId: cd.productId,
        action: cd.action,
        quantity: cd.quantity,
        confirmed: true,
      });
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: data.message || 'Stok berhasil diperbarui.',
        timestamp: new Date(),
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: `⚠️ ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Clarification select ──────────────────────────────────────────────────
  const handleSelectClarification = async (
    productId: string,
    productName: string,
    action: 'RESTOCK' | 'REDUCE',
    quantity: number,
    originalPrompt: string,
    messageId: string
  ) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, needClarification: false } : m));
    setLoading(true);
    try {
      const data = await callAPI({ prompt: originalPrompt, productId, action, quantity });
      if (data.need_confirmation) {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'ai',
          text: data.message,
          timestamp: new Date(),
          needConfirmation: true,
          confirmationData: data.confirmation_data,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'ai',
          text: data.message || `Stok ${productName} diperbarui.`,
          timestamp: new Date(),
        }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: `⚠️ ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-16 left-6 z-50 flex flex-col items-start">
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-surface-container rounded-2xl border border-outline-variant shadow-2xl w-80 md:w-96 h-[480px] flex flex-col mb-4 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-primary text-on-primary px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="animate-pulse" />
              <span className="font-bold text-sm tracking-wide">Velo — Asisten AI</span>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                // Clear active session messages and history context
                setMessages([{ id: 'welcome', sender: 'ai', text: WELCOME_TEXT, timestamp: new Date() }]);
                setHistory([]);
              }}
              className="text-on-primary/80 hover:text-on-primary transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scrollbar-thin bg-surface-dim">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[88%] ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <div
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-secondary text-on-secondary rounded-tr-none font-medium'
                      : 'bg-surface-container-highest text-on-surface rounded-tl-none border border-outline-variant/30'
                  }`}
                >
                  {renderMarkdown(msg.text)}
                </div>

                {/* Clarification buttons */}
                {msg.needClarification && msg.matches && msg.pendingAction && (
                  <div className="flex flex-col gap-1.5 mt-2 w-full">
                    {msg.matches.map(match => (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() =>
                          handleSelectClarification(
                            match.id, match.name,
                            msg.pendingAction!.action,
                            msg.pendingAction!.quantity,
                            msg.pendingAction!.prompt,
                            msg.id
                          )
                        }
                        className="w-full text-left bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container border border-outline-variant text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                      >
                        🎯 {match.name} — Stok: {match.stock} {match.unit}
                      </button>
                    ))}
                  </div>
                )}

                {/* Confirmation buttons */}
                {msg.needConfirmation && msg.confirmationData && (
                  <div className="flex gap-2 mt-2 w-full">
                    <button
                      type="button"
                      onClick={() => handleConfirm(msg.id, true)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-on-primary text-[11px] font-bold py-2 px-3 rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 shadow-sm"
                    >
                      <CheckCircle2 size={13} />
                      Ya, Lanjutkan
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirm(msg.id, false)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-error-container text-on-error-container text-[11px] font-bold py-2 px-3 rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 shadow-sm"
                    >
                      <XCircle size={13} />
                      Batal
                    </button>
                  </div>
                )}

                <span className="text-[9px] text-on-surface-variant/50 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {loading && (
              <div className="self-start flex items-center gap-2 bg-surface-container-highest text-on-surface border border-outline-variant/30 rounded-xl rounded-tl-none px-3 py-2 text-xs font-semibold">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span>Berpikir...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-outline-variant p-2 flex gap-2 bg-surface-container flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Tulis perintah..."
              maxLength={500}
              className="flex-1 bg-surface-dim border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface focus:border-primary outline-none transition-colors"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="p-2 bg-primary text-on-primary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-12 h-12 bg-primary hover:bg-primary/95 text-on-primary rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
          title="Asisten AI"
        >
          <Sparkles size={20} className="animate-pulse" />
        </button>
      )}
    </div>
  );
}
