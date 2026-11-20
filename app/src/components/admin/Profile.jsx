// Profile: change the name shown on public pages, and change password.
import { useState } from 'react';
import { apiUpdateProfile, apiChangePassword } from '../../api/client';
import { useMemberAuth } from '../../context/MemberAuthContext';
import AdminNav from './AdminNav';

const inputClass = 'w-full px-3 py-2 border border-church-border rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent outline-none bg-white';

const Message = ({ message }) => message.text ? (
  <p className={`text-sm rounded-lg px-3 py-2 border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
    {message.text}
  </p>
) : null;

const Profile = () => {
  const { memberProfile, isOwner } = useMemberAuth();
  const [name, setName] = useState(memberProfile?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState({ type: '', text: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameMessage({ type: 'error', text: 'Please enter your name.' });
      return;
    }
    setSavingName(true);
    try {
      const updated = await apiUpdateProfile(trimmed);
      setNameMessage({ type: 'success', text: 'Saved.' });
      if (updated?.name) setName(updated.name);
    } catch (err) {
      console.error('Error saving name:', err);
      setNameMessage({ type: 'error', text: 'Could not save. Please try again.' });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.next.length < 8) {
      setPasswordMessage({ type: 'error', text: 'The new password must be at least 8 characters.' });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordMessage({ type: 'error', text: 'The new passwords don\'t match.' });
      return;
    }
    setSavingPassword(true);
    try {
      const result = await apiChangePassword(passwords.current, passwords.next);
      if (result?.error === 'wrong-current-password') {
        setPasswordMessage({ type: 'error', text: 'Your current password is not right.' });
        return;
      }
      if (result?.error) { setPasswordMessage({ type: 'error', text: 'Could not change the password. Please try again.' }); return; }
      setPasswords({ current: '', next: '', confirm: '' });
      setPasswordMessage({ type: 'success', text: 'Password changed.' });
    } catch (err) {
      console.error('Error changing password:', err);
      const wrong = ['auth/invalid-credential', 'auth/wrong-password'].includes(err.code);
      setPasswordMessage({ type: 'error', text: wrong ? 'Your current password is not right.' : 'Could not change the password. Please try again.' });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-church-paper font-sans text-church-ink">
      <AdminNav />

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-2xl space-y-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-church-navy">Profile</h1>
          <p className="text-church-muted mt-1">
            {memberProfile?.email} · {isOwner ? 'Owner' : 'Admin'}
          </p>
        </div>

        <form onSubmit={handleSaveName} className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-church-navy text-lg">Your name</h2>
          <div>
            <label htmlFor="profileName" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input id="profileName" type="text" maxLength={100} value={name} onChange={(e) => { setName(e.target.value); setNameMessage({ type: '', text: '' }); }} className={inputClass} />
            <p className="text-xs text-church-muted mt-1">Shown to the other admins (for example, on calendar events you add).</p>
          </div>
          <Message message={nameMessage} />
          <button type="submit" disabled={savingName} className="px-6 py-2.5 bg-church-navy hover:bg-church-navy-deep disabled:opacity-60 text-white font-semibold rounded-lg transition">
            {savingName ? 'Saving...' : 'Save name'}
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-church-navy text-lg">Change password</h2>
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input id="currentPassword" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} className={inputClass} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input id="newPassword" type="password" autoComplete="new-password" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input id="confirmNewPassword" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className={inputClass} />
            </div>
          </div>
          <Message message={passwordMessage} />
          <button type="submit" disabled={savingPassword} className="px-6 py-2.5 bg-church-navy hover:bg-church-navy-deep disabled:opacity-60 text-white font-semibold rounded-lg transition">
            {savingPassword ? 'Changing...' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
