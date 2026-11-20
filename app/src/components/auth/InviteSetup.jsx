// Invite link page (/invite/:inviteToken): the invitee picks a password and their account is created.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiInviteLookup, apiAcceptInvite } from '../../api/client';
import { CHURCH_SHORT_NAME } from '../../firebase/config';
import AuthLayout, { inputClass, primaryButtonClass } from './AuthLayout';

const InviteSetup = () => {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadInvite = async () => {
      try {
        const data = await apiInviteLookup(inviteToken);
        if (data?.error === 'invite-not-found') setLoadError('This invite link is invalid or has already been used.');
        else if (data?.error === 'invite-expired') setLoadError('This invite link has expired. Ask a church admin for a new one.');
        else setInvite(data);
      } catch (err) {
        console.error('Error loading invite:', err);
        setLoadError('Could not load this invite. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    loadInvite();
  }, [inviteToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords don\'t match.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await apiAcceptInvite(inviteToken, invite.email, password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError(err.message || 'Could not create your account. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Loading invite...">
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-church-navy"></div>
        </div>
      </AuthLayout>
    );
  }

  if (loadError) {
    return (
      <AuthLayout title="Invite not available" subtitle={loadError}>
        <a href="/login" className="inline-block text-church-red-dark hover:underline font-semibold">
          Go to member sign in
        </a>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Welcome, ${invite.name.split(' ')[0]}`}
      subtitle={`${invite.invitedByName || 'A church admin'} invited you to the ${CHURCH_SHORT_NAME} members area. Choose a password to finish setting up your account.`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <p className="px-4 py-3 bg-church-cream/60 border border-church-border rounded-lg text-gray-700 break-all">{invite.email}</p>
          <p className="text-xs text-church-muted mt-1">You'll use this email to sign in.</p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className={`${inputClass} pr-16`}
              placeholder="At least 8 characters"
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
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm password</label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
            className={inputClass}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Creating your account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default InviteSetup;
