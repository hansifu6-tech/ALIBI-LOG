import { useState } from 'react';
import { supabase } from '../supabase';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';
import { TermsModal } from './TermsModal';

export function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('请输入邮箱地址'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (err) throw err;
      setError('密码重置邮件已发送，请查收邮箱并按照指引重置密码。');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '发送重置邮件失败，请稍后重试';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        // ── Register: validate confirm password ──
        if (password !== confirmPassword) {
          setError('两次输入的密码不一致，请重新输入');
          setLoading(false);
          return;
        }

        // ── Register: validate invite code ──
        const trimmedCode = inviteCode.trim().toUpperCase();
        if (!trimmedCode) {
          setError('请输入案卷访问码');
          setLoading(false);
          return;
        }

        const { data: codeRow, error: lookupErr } = await supabase
          .from('invitation_codes')
          .select('id, is_used')
          .eq('code', trimmedCode)
          .maybeSingle();

        if (lookupErr) throw new Error('访问码校验失败，请稍后重试');
        if (!codeRow) throw new Error('访问码无效，请检查后重试');
        if (codeRow.is_used) throw new Error('该访问码已被使用');

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;

        await supabase
          .from('invitation_codes')
          .update({ is_used: true, used_by: signUpData.user?.id, used_at: new Date().toISOString() })
          .eq('id', codeRow.id);

        setError('注册成功！如需验证邮箱请查收邮件，然后返回登录。');
        setIsLogin(true);
        setLoading(false);
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败，请检查邮箱和密码';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = agreedToTerms && !loading;

  // ── Forgot password view ──
  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans" style={{ colorScheme: 'light' }}>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
          <div className="p-8 pb-6 flex flex-col items-center border-b border-gray-100">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <KeyRound size={28} className="text-amber-500" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: '#1f2937' }}>找回密码</h1>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>输入注册邮箱，我们将发送重置链接</p>
          </div>

          <form onSubmit={handleForgotPassword} className="p-8 space-y-6">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest block mb-2 px-1" style={{ color: '#9ca3af' }}>邮箱地址</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm"
                style={{ backgroundColor: '#f9fafb', color: '#374151' }}
                placeholder="example@email.com"
              />
            </div>

            {error && (
              <p className={`text-xs text-center px-2 ${error.includes('已发送') ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white shadow-xl bg-amber-500 hover:bg-amber-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <KeyRound size={18} />
              )}
              发送重置邮件
            </button>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsForgotPassword(false); setError(''); }}
                className="text-sm font-medium hover:text-blue-500 transition-colors"
                style={{ color: '#6b7280' }}
              >
                返回登录
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans" style={{ colorScheme: 'light' }}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300">
        <div className="p-8 pb-6 flex flex-col items-center border-b border-gray-100">
          <img src="/logo.png" alt="ALIBI LOG" className="w-28 h-28 object-contain mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 italic tracking-wider">ALIBI LOG</h1>
          <p className="text-gray-400 text-sm mt-1">你的生活本就值得记录</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">邮箱地址</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                style={{ backgroundColor: '#f9fafb', color: '#374151' }}
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">访问密码</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 text-sm"
                style={{ backgroundColor: '#f9fafb', color: '#374151' }}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            {!isLogin && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">确认密码</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full p-4 rounded-xl border focus:ring-2 outline-none transition-all placeholder:text-gray-400 text-sm ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-300 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  style={{ backgroundColor: '#f9fafb', color: '#374151' }}
                  placeholder="再次输入密码"
                  minLength={6}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-red-500 text-xs mt-1.5 px-1">两次输入的密码不一致</p>
                )}
              </div>
            )}
            {!isLogin && (
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2 px-1">🔑 案卷访问码</label>
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full p-4 rounded-xl border border-purple-200 focus:ring-2 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-400 text-sm uppercase tracking-wider"
                  style={{ backgroundColor: 'rgba(250, 245, 255, 0.3)', color: '#374151' }}
                  placeholder="请输入邀请码"
                />
              </div>
            )}
          </div>

          {error && (
            <p className={`text-xs text-center px-2 ${error.startsWith('注册成功') ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
              {error}
            </p>
          )}

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms-agree"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <label htmlFor="terms-agree" className="text-xs text-gray-500 leading-relaxed cursor-pointer select-none">
              我已阅读并同意
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                className="text-blue-500 hover:text-blue-700 font-bold underline underline-offset-2 transition-colors mx-0.5"
              >
                《ALIBI LOG 个人项目用户协议与隐私政策》
              </button>
            </label>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2
              ${canSubmit
                ? (isLogin ? 'bg-blue-600 shadow-blue-500/20 hover:bg-blue-700' : 'bg-purple-600 shadow-purple-500/20 hover:bg-purple-700')
                : 'bg-gray-300 shadow-none cursor-not-allowed'
              }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              canSubmit
                ? (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)
                : null
            )}
            {isLogin ? '由于热爱而登录' : '现在加入我们'}
          </button>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); }}
              className="text-sm font-medium text-gray-500 hover:text-blue-500 transition-colors"
            >
              {isLogin ? '还没有账号？立即注册' : '已有账号？返回登录'}
            </button>
            {isLogin && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => { setIsForgotPassword(true); setError(''); }}
                  className="text-sm font-medium text-gray-400 hover:text-amber-500 transition-colors"
                >
                  忘记密码？
                </button>
              </>
            )}
          </div>
        </form>

        <div className="px-8 py-4 bg-gray-50/50 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400">数据将安全加密存储于私有云空间 · Powered by Supabase</p>
        </div>
      </div>

      <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
