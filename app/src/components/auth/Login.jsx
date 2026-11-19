// Member sign-in. There is no sign-up: accounts come only from invite links.
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginMember, resetPassword } from '../../firebase/auth';
import { auth } from '../../firebase/config';
import AuthLayout, { inputClass, primaryButtonClass } from './AuthLayout';

const destination = (location) => {
  const from = location.state?.from;
  return from && from.startsWith('/admin/') ? from : '/admin/dashboard';
};

const friendlyError = (result) => {
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(result.code)) {
    return 'That email and password don\'t match. Try again, or use "Forgot password".';
  }
  if (result.code === 'auth/user-disabled') {
    return 'This account has been turned off. Ask a church admin if you need access again.';
  }
  if (result.code === 'auth/too-many-requests') {
    return 'Too many tries. Wait a few minutes, or reset your password.';
  }
  return result.error || 'Could not sign in. Please try again.';
};

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' });

  // Already signed in? Skip the form. Checked once on load so it never races the sign-in below.
  useEffect(() => {
    let cancelled = false;
    auth.authStateReady().then(() => {
      if (!cancelled && auth.currentUser) navigate(destination(location), { replace: true });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await loginMember(formData.email.trim(), formData.password);
    setLoading(false);
    if (result.success) {
      navigate(destination(location));
    } else {
      setError(friendlyError(result));
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    setResetLoading(true);
    const result = await resetPassword(resetEmail.trim());
    setResetLoading(false);
    // Same message either way, so the form doesn't reveal which emails have accounts
    if (result.success || result.error?.includes('user-not-found')) {
      setResetMessage({
        type: 'success',
        text: 'If that email has an account, a reset link is on its way. Check your inbox and spam folder.'
      });
      setResetEmail('');
    } else {
      setResetMessage({ type: 'error', text: 'Could not send the reset email. Please try again.' });
    }
  };

  if (showForgotPassword) {
    return (
      <AuthLayout title="Reset password" subtitle="We'll email you a link to choose a new password.">
        <form onSubmit={handleForgotPassword} className="space-y-5">
          <div>
            <label htmlFor="resetEmail" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              id="resetEmail"
              type="email"
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          {resetMessage.text && (
            <div className={`px-4 py-3 rounded-lg text-sm border ${resetMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {resetMessage.text}
            </div>
          )}
          <button type="submit" disabled={resetLoading} className={primaryButtonClass}>
            {resetLoading ? 'Sending...' : 'Send reset link'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForgotPassword(false); setResetMessage({ type: '', text: '' }); }}
            className="w-full text-sm text-church-navy hover:underline font-medium"
          >
            Back to sign in
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Member sign in" subtitle="For church admins. Accounts are by invitation only.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={formData.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <button
              type="button"
              onClick={() => { setShowForgotPassword(true); setResetEmail(formData.email); }}
              className="text-sm text-church-red-dark hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              className={`${inputClass} pr-16`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 px-4 text-sm text-church-muted hover:text-church-navy"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-sm text-church-muted">
        Need an account? Ask a church admin to send you an invite link.
      </p>
    </AuthLayout>
  );
};

export default Login;
