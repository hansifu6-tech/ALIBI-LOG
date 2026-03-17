import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Copy, Check, Lock, Unlock, ArrowRight } from 'lucide-react';

interface InvCode {
  id: string;
  code: string;
  is_used: boolean;
}

export function InvitePage() {
  const [codes, setCodes] = useState<InvCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('invitation_codes')
        .select('id, code, is_used')
        .order('created_at', { ascending: true });
      if (!error && data) {
        // 可用码排在前面，已使用的排在后面
        const sorted = [...data].sort((a, b) => {
          if (a.is_used === b.is_used) return 0;
          return a.is_used ? 1 : -1;
        });
        setCodes(sorted);
      }
      setLoading(false);
    })();
  }, []);

  const available = codes.filter(c => !c.is_used).length;
  const total = codes.length;

  const handleCopy = async (code: InvCode) => {
    await navigator.clipboard.writeText(code.code);
    setCopiedId(code.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0a0a1a 0%, #111827 50%, #0f172a 100%)', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '60px 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
            <img src="/logo.png" alt="ALIBI LOG" style={{ width: '68px', height: '68px', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.15em', color: '#ffffff', margin: '0 0 8px' }}>
            ALIBI LOG
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', letterSpacing: '0.3em', textTransform: 'uppercase', margin: '0 0 32px' }}>
            Invitation Only
          </p>
          
          {/* Quota Banner */}
          {!loading && (
            <div style={{
              display: 'inline-block',
              padding: '14px 28px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.08))',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <p style={{ fontSize: '15px', color: '#fbbf24', fontWeight: 700, margin: 0, lineHeight: 1.6 }}>
                当前剩余案卷额度：<span style={{ fontSize: '22px', color: '#f59e0b' }}>{available}</span>
                <span style={{ color: '#64748b', fontWeight: 400 }}> / {total}</span>
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0 0', fontStyle: 'italic' }}>
                请尽快认领你的不在场证明。
              </p>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(245,158,11,0.3)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Code List */}
        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {codes.map((code) => {
              const used = code.is_used;
              const justCopied = copiedId === code.id;

              return (
                <div
                  key={code.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    background: used ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${used ? 'rgba(255,255,255,0.04)' : 'rgba(245,158,11,0.15)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Code + strikethrough */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div style={{ color: used ? '#475569' : '#94a3b8', flexShrink: 0 }}>
                      {used ? <Lock size={18} /> : <Unlock size={18} />}
                    </div>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <span style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        letterSpacing: '0.12em',
                        color: used ? '#334155' : '#e2e8f0',
                        transition: 'color 0.2s',
                      }}>
                        {code.code}
                      </span>
                      {/* Hand-drawn Bordeaux-red strikethrough for used codes */}
                      {used && (
                        <svg
                          style={{ position: 'absolute', top: '45%', left: '-6px', width: 'calc(100% + 12px)', height: '14px', pointerEvents: 'none' }}
                          viewBox="0 0 200 14"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M2 8 C20 4, 40 11, 60 6 S100 10, 130 5 S170 9, 198 7"
                            fill="none"
                            stroke="#7f1d1d"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.85"
                          />
                          <path
                            d="M4 9 C25 5, 45 12, 65 7 S105 11, 135 6 S175 10, 196 8"
                            fill="none"
                            stroke="#991b1b"
                            strokeWidth="2"
                            strokeLinecap="round"
                            opacity="0.5"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Status + Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    {used ? (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#7f1d1d',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        background: 'rgba(127,29,29,0.15)',
                        border: '1px solid rgba(127,29,29,0.2)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        案卷已封存
                      </span>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#22c55e',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.2)',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                        }}>
                          可取用
                        </span>
                        <button
                          onClick={() => handleCopy(code)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: 'none',
                            background: justCopied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                            color: justCopied ? '#22c55e' : '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          title="复制邀请码"
                        >
                          {justCopied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer CTA */}
        <div style={{ textAlign: 'center', marginTop: '48px', paddingBottom: '40px' }}>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 8px 24px rgba(245,158,11,0.25)',
              transition: 'all 0.2s',
            }}
          >
            前往登录 / 注册
            <ArrowRight size={16} />
          </a>
          <p style={{ fontSize: '11px', color: '#475569', marginTop: '16px' }}>
            ALIBI LOG · 你的生活本就值得记录
          </p>
        </div>
      </div>
    </div>
  );
}
