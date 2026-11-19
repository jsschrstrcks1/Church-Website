// Signed-in member state, shared by every admin page.
// memberProfile is the members/{uid} document: { uid, name, email, role: 'owner' | 'admin', accountStatus, ... }
// Owners can also invite and remove members; everything else is open to every member.
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getMemberProfile } from '../firebase/auth';

const MemberAuthContext = createContext();

export const useMemberAuth = () => {
  const context = useContext(MemberAuthContext);
  if (!context) {
    throw new Error('useMemberAuth must be used within MemberAuthProvider');
  }
  return context;
};

export const MemberAuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [memberProfile, setMemberProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile = null;

    const listenToProfile = (uid) => {
      unsubscribeProfile = onSnapshot(doc(db, 'members', uid), (docSnap) => {
        if (docSnap.exists() && docSnap.data().accountStatus !== 'removed') {
          setMemberProfile({ id: docSnap.id, ...docSnap.data() });
        } else if (docSnap.metadata.fromCache) {
          // Offline, so the browser only knows it has no saved copy. That isn't the server
          // saying the account is gone: keep waiting rather than signing the person out.
        } else {
          // Removed by an owner while signed in
          setMemberProfile(null);
          signOut(auth);
        }
      }, (error) => {
        console.error('Error listening to member profile:', error);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        // Retry a few times so a brief network hiccup doesn't sign the person out
        let result = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          result = await getMemberProfile(user.uid);
          if (result.success || result.notFound) break;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
        }

        if (result.notFound || result.profile?.accountStatus === 'removed') {
          await signOut(auth);
          setMemberProfile(null);
        } else {
          if (result.success) setMemberProfile(result.profile);
          listenToProfile(user.uid);
        }
      } else {
        setMemberProfile(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    currentUser,
    memberProfile,
    loading,
    isAuthenticated: !!currentUser && !!memberProfile,
    isOwner: memberProfile?.role === 'owner'
  };

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
};
