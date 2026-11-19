// Guards the /admin pages: only signed-in church members get through.
// ownerOnly pages (Members) send everyone else back to the dashboard.
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMemberAuth } from '../context/MemberAuthContext';

const ProtectedMemberRoute = ({ children, ownerOnly = false }) => {
  const { isAuthenticated, loading, memberProfile, currentUser, isOwner } = useMemberAuth();
  const { pathname } = useLocation();

  // Signed in but the profile hasn't loaded yet (slow connection): keep waiting, offer Retry
  const waitingForProfile = !!currentUser && !memberProfile;
  const [slowToLoad, setSlowToLoad] = useState(false);
  useEffect(() => {
    if (!waitingForProfile) {
      setSlowToLoad(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlowToLoad(true), 8000);
    return () => clearTimeout(timer);
  }, [waitingForProfile]);

  if (loading || waitingForProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-church-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-church-navy mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          {slowToLoad && (
            <div className="mt-6 max-w-xs mx-auto">
              <p className="text-gray-700">Having trouble connecting. Check your connection and try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-church-navy text-white px-5 py-2 rounded-lg font-semibold hover:bg-church-navy-deep transition"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: pathname }} />;
  }

  if (ownerOnly && !isOwner) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default ProtectedMemberRoute;
