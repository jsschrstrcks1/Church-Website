// Members (owners only): invite people, see pending invites, change roles, remove access.
// Invites are links. The owner copies the link or opens it in their own email app; there is
// no automatic invite email, so nothing depends on an email-sending account.
import { useEffect, useState } from 'react';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, SITE_URL, CHURCH_NAME, CHURCH_SHORT_NAME } from '../../firebase/config';
import { useMemberAuth } from '../../context/MemberAuthContext';
import AdminNav from './AdminNav';

const INVITE_DAYS = 14;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

// 32 random hex characters: the invite link's secret
const newToken = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

// Invites open on the site that is in use (the live site, or localhost while developing)
const inviteLink = (token) => `${import.meta.env.DEV ? window.location.origin : SITE_URL}/invite/${token}`;

const inviteEmailHref = (invite, fromName) => {
  const subject = `Your invitation to the ${CHURCH_SHORT_NAME} members area`;
  const body = [
    `Hi ${invite.name.split(' ')[0]},`,
    '',
    `You're invited to help manage the ${CHURCH_NAME} website: the calendar, newsletters, and share pages.`,
    '',
    'Open this link to choose your password and set up your account:',
    inviteLink(invite.id),
    '',
    `The link works once and expires on ${new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`,
    '',
    fromName
  ].join('\n');
  return `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const inputClass = 'w-full px-3 py-2 border border-church-border rounded-lg focus:ring-2 focus:ring-church-navy focus:border-transparent outline-none bg-white';

const MembersManager = () => {
  const { memberProfile } = useMemberAuth();
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, (err) => {
      console.error('Error loading members:', err);
      setMembers([]);
    });
    const unsubInvites = onSnapshot(collection(db, 'invites'), (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    }, (err) => {
      console.error('Error loading invites:', err);
      setInvites([]);
    });
    return () => { unsubMembers(); unsubInvites(); };
  }, []);

  const activeMembers = (members || []).filter((m) => m.accountStatus !== 'removed');
  const removedMembers = (members || []).filter((m) => m.accountStatus === 'removed');

  const handleInvite = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    if (!name) {
      setFormError('Please enter their name.');
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (activeMembers.some((m) => (m.email || '').toLowerCase() === email)) {
      setFormError('Someone with that email already has an account.');
      return;
    }

    setCreating(true);
    setFormError('');
    try {
      const token = newToken();
      const invite = {
        name,
        email,
        role: form.role,
        invitedBy: memberProfile.uid,
        invitedByName: memberProfile.name,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      };
      await setDoc(doc(db, 'invites', token), invite);
      setNewInvite({ id: token, ...invite });
      setForm({ name: '', email: '', role: 'admin' });
    } catch (err) {
      console.error('Error creating invite:', err);
      setFormError('Could not create the invite. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (invite) => {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.id));
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy this invite link:', inviteLink(invite.id));
    }
  };

  const cancelInvite = async (invite) => {
    if (!window.confirm(`Cancel the invite for ${invite.name}? The link will stop working.`)) return;
    try {
      await deleteDoc(doc(db, 'invites', invite.id));
      if (newInvite?.id === invite.id) setNewInvite(null);
    } catch (err) {
      console.error('Error canceling invite:', err);
      alert('Could not cancel the invite. Please try again.');
    }
  };

  const changeRole = async (member, role) => {
    const verb = role === 'owner' ? 'make' : 'change';
    if (!window.confirm(`${verb === 'make' ? 'Make' : 'Change'} ${member.name} ${role === 'owner' ? 'an owner? Owners can invite and remove members.' : 'to a regular admin? They will no longer be able to invite or remove members.'}`)) return;
    setBusyId(member.id);
    try {
      await updateDoc(doc(db, 'members', member.id), { role, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Error changing role:', err);
      alert('Could not change the role. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const setAccess = async (member, restore) => {
    const message = restore
      ? `Give ${member.name} access again?`
      : `Remove ${member.name}'s access? They'll be signed out and can't sign in again. Newsletters they published stay online.`;
    if (!window.confirm(message)) return;
    setBusyId(member.id);
    try {
      await httpsCallable(functions, 'removeMember')({ memberId: member.id, restore });
    } catch (err) {
      console.error('Error changing access:', err);
      alert(err.message || 'Could not update access. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const ownerCount = activeMembers.filter((m) => m.role === 'owner').length;
  const isExpired = (invite) => invite.expiresAt && new Date(invite.expiresAt) < new Date();

  return (
    <div className="min-h-screen bg-church-paper font-sans text-church-ink">
      <AdminNav />

      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl space-y-8">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-church-navy">Members</h1>
          <p className="text-church-muted mt-1">Accounts are by invitation only. Everyone here can manage the calendar and make newsletters; owners can also invite and remove members.</p>
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6 space-y-4">
          <h2 className="font-semibold text-church-navy text-lg">Invite someone</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="inviteName" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input id="inviteName" type="text" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="First and last name" />
            </div>
            <div>
              <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="inviteEmail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} placeholder="They'll sign in with this" />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={form.role === 'owner'}
              onChange={(e) => setForm({ ...form, role: e.target.checked ? 'owner' : 'admin' })}
              className="mt-0.5 w-4 h-4 rounded"
            />
            <span>Make them an owner <span className="text-church-muted">(can invite and remove members)</span></span>
          </label>
          {formError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
          <button type="submit" disabled={creating} className="px-6 py-2.5 bg-church-red hover:bg-church-red-dark disabled:opacity-60 text-white font-semibold rounded-lg transition">
            {creating ? 'Creating...' : 'Create invite link'}
          </button>

          {newInvite && (
            <div className="p-4 bg-church-cream/60 border border-church-border rounded-lg space-y-3">
              <p className="text-sm text-gray-800">
                Invite ready for <strong>{newInvite.name}</strong>. Send them this link; it works once and expires in {INVITE_DAYS} days.
              </p>
              <code className="block text-xs bg-white px-3 py-2 rounded border border-church-border break-all">{inviteLink(newInvite.id)}</code>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copyLink(newInvite)} className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition ${copiedId === newInvite.id ? 'bg-green-600' : 'bg-church-navy hover:bg-church-navy-deep'}`}>
                  {copiedId === newInvite.id ? '✓ Copied' : 'Copy link'}
                </button>
                <a href={inviteEmailHref(newInvite, memberProfile.name)} className="px-4 py-2 bg-white border border-church-border text-church-navy text-sm font-semibold rounded-lg hover:bg-church-cream transition">
                  Email it
                </a>
              </div>
            </div>
          )}
        </form>

        {/* Pending invites */}
        <div className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6">
          <h2 className="font-semibold text-church-navy text-lg mb-2">Pending invites</h2>
          {invites === null ? (
            <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-church-navy"></div></div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-church-muted">No pending invites.</p>
          ) : (
            <ul className="divide-y divide-church-border">
              {invites.map((invite) => (
                <li key={invite.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[12rem]">
                    <p className="text-gray-900 font-medium">{invite.name} {invite.role === 'owner' && <span className="text-xs text-church-navy bg-church-navy/10 px-2 py-0.5 rounded-full ml-1">Owner</span>}</p>
                    <p className="text-xs text-church-muted break-all">{invite.email}</p>
                    <p className={`text-xs ${isExpired(invite) ? 'text-church-red-dark' : 'text-church-muted'}`}>
                      {isExpired(invite) ? 'Expired' : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!isExpired(invite) && (
                      <>
                        <button type="button" onClick={() => copyLink(invite)} className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium">
                          {copiedId === invite.id ? '✓ Copied' : 'Copy link'}
                        </button>
                        <a href={inviteEmailHref(invite, memberProfile.name)} className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium">Email</a>
                      </>
                    )}
                    <button type="button" onClick={() => cancelInvite(invite)} className="px-3 py-1.5 text-sm text-church-red-dark hover:bg-red-50 rounded-lg font-medium">
                      {isExpired(invite) ? 'Delete' : 'Cancel'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl shadow-sm border border-church-border p-5 sm:p-6">
          <h2 className="font-semibold text-church-navy text-lg mb-2">Members</h2>
          {members === null ? (
            <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-church-navy"></div></div>
          ) : (
            <ul className="divide-y divide-church-border">
              {activeMembers.map((member) => {
                const isMe = member.id === memberProfile.uid;
                const lastOwner = member.role === 'owner' && ownerCount <= 1;
                return (
                  <li key={member.id} className="py-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[12rem]">
                      <p className="text-gray-900 font-medium">
                        {member.name}{isMe && <span className="text-church-muted font-normal"> (you)</span>}
                        {member.role === 'owner' && <span className="text-xs text-church-navy bg-church-navy/10 px-2 py-0.5 rounded-full ml-2">Owner</span>}
                      </p>
                      <p className="text-xs text-church-muted break-all">{member.email}</p>
                    </div>
                    {!isMe && (
                      <div className="flex gap-1">
                        {member.role === 'owner' ? (
                          <button type="button" disabled={busyId === member.id || lastOwner} onClick={() => changeRole(member, 'admin')} className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium disabled:opacity-40">
                            Make admin
                          </button>
                        ) : (
                          <button type="button" disabled={busyId === member.id} onClick={() => changeRole(member, 'owner')} className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium disabled:opacity-40">
                            Make owner
                          </button>
                        )}
                        <button type="button" disabled={busyId === member.id} onClick={() => setAccess(member, false)} className="px-3 py-1.5 text-sm text-church-red-dark hover:bg-red-50 rounded-lg font-medium disabled:opacity-40">
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {removedMembers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-church-border">
              <h3 className="text-sm font-semibold text-church-muted mb-1">Removed</h3>
              <ul className="divide-y divide-church-border">
                {removedMembers.map((member) => (
                  <li key={member.id} className="py-2 flex flex-wrap items-center gap-3 opacity-75">
                    <div className="flex-1 min-w-[12rem]">
                      <p className="text-gray-700">{member.name}</p>
                      <p className="text-xs text-church-muted break-all">{member.email}</p>
                    </div>
                    <button type="button" disabled={busyId === member.id} onClick={() => setAccess(member, true)} className="px-3 py-1.5 text-sm text-church-navy hover:bg-church-cream rounded-lg font-medium disabled:opacity-40">
                      Restore access
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MembersManager;
