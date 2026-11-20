// Signed-in member state, shared by every admin page — backed by our Worker API.
// memberProfile is the members row: { id, name, email, role: 'owner'|'admin', accountStatus }.
import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, apiMe, apiLogout } from '../api/client';

const MemberAuthContext = createContext();

export const useMemberAuth = () => {
  const context = useContext(MemberAuthContext);
  if (!context) throw new Error('useMemberAuth must be used within MemberAuthProvider');
  return context;
};

export const MemberAuthProvider = ({ children }) => {
  const [memberProfile, setMemberProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getToken()) { setLoading(false); return; }
      setLoading(true);
      try {
        const profile = await apiMe();
        if (!cancelled) {
          if (profile && profile.accountStatus !== 'removed') setMemberProfile(profile);
          else await apiLogout();
        }
      } catch {
        if (!cancelled) await apiLogout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const value = {
    currentUser: memberProfile ? { uid: memberProfile.id, email: memberProfile.email, name: memberProfile.name } : null,
    memberProfile,
    loading,
    isAuthenticated: !!memberProfile,
    isOwner: memberProfile?.role === 'owner'
  };

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
};
