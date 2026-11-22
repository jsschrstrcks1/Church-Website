// Routes for the church app. The plain-HTML home page (public/index.html) is separate;
// firebase.json sends only these paths to this app.
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MemberAuthProvider } from './context/MemberAuthContext';
import ProtectedMemberRoute from './components/ProtectedMemberRoute';

const Login = React.lazy(() => import('./components/auth/Login'));
const InviteSetup = React.lazy(() => import('./components/auth/InviteSetup'));
const DashboardWrapper = React.lazy(() => import('./components/admin/DashboardWrapper'));
const EventsManager = React.lazy(() => import('./components/admin/EventsManager'));
const MembersManager = React.lazy(() => import('./components/admin/MembersManager'));
const Profile = React.lazy(() => import('./components/admin/Profile'));
const NewsletterManager = React.lazy(() => import('./components/admin/NewsletterManager'));
const NewsletterEditorWrapper = React.lazy(() => import('./components/admin/NewsletterEditorWrapper'));
const FormResponses = React.lazy(() => import('./components/admin/FormResponses'));
const PrayerAdmin = React.lazy(() => import('./components/admin/PrayerAdmin'));
const SermonAdmin = React.lazy(() => import('./components/admin/SermonAdmin'));
const ReelsAdmin = React.lazy(() => import('./components/admin/ReelsAdmin'));
const LiveStudio = React.lazy(() => import('./components/admin/LiveStudio'));
const SharePage = React.lazy(() => import('./components/share/SharePage'));
const NewsletterPublicView = React.lazy(() => import('./components/newsletter/NewsletterPublicView'));
const NewsletterArchive = React.lazy(() => import('./components/newsletter/NewsletterArchive'));

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-church-paper">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-church-navy"></div>
  </div>
);

// Mobile PWA (public): watch / calendar / pray — installable under /app/
const MobileLayout = React.lazy(() => import('./components/mobile/MobileLayout'));
const WatchScreen = React.lazy(() => import('./components/mobile/WatchScreen'));
const CalendarScreen = React.lazy(() => import('./components/mobile/CalendarScreen'));
const PrayerScreen = React.lazy(() => import('./components/mobile/PrayerScreen'));
const SermonScreen = React.lazy(() => import('./components/mobile/SermonScreen'));

// The app is deployed under /app/ (vite base); route paths are relative to that.
const routerBase = import.meta.env.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, '') : undefined;

// Every /admin page: the shared sign-in state plus the members-only guard
const member = (element, options = {}) => (
  <ProtectedMemberRoute ownerOnly={options.ownerOnly}>{element}</ProtectedMemberRoute>
);

function App() {
  return (
    <BrowserRouter basename={routerBase}>
      <MemberAuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Mobile PWA home (public, no sign-in) — the installable app */}
            <Route path="/" element={<MobileLayout />}>
              <Route index element={<Navigate to="/watch" replace />} />
              <Route path="watch" element={<WatchScreen />} />
              <Route path="sermons" element={<SermonScreen />} />
              <Route path="sermons/:id" element={<SermonScreen />} />
              <Route path="calendar" element={<CalendarScreen />} />
              <Route path="pray" element={<PrayerScreen />} />
            </Route>

            {/* Sign in and accept an invite */}
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:inviteToken" element={<InviteSetup />} />

            {/* Members area */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={member(<DashboardWrapper />)} />
            <Route path="/admin/events" element={member(<EventsManager />)} />
            <Route path="/admin/newsletter" element={member(<NewsletterManager />)} />
            <Route path="/admin/newsletter/:newsletterId" element={member(<NewsletterEditorWrapper />)} />
            <Route path="/admin/form-responses" element={member(<FormResponses />)} />
            <Route path="/admin/prayer" element={member(<PrayerAdmin />)} />
            <Route path="/admin/sermons" element={member(<SermonAdmin />)} />
            <Route path="/admin/reels" element={member(<ReelsAdmin />)} />
            <Route path="/admin/live" element={member(<LiveStudio />)} />
            <Route path="/admin/profile" element={member(<Profile />)} />
            <Route path="/admin/members" element={member(<MembersManager />, { ownerOnly: true })} />

            {/* Public pages anyone can open */}
            <Route path="/share" element={<SharePage />} />
            {/* Older personal links (/share/<account id>) all go to the one church page */}
            <Route path="/share/*" element={<Navigate to="/share" replace />} />
            <Route path="/newsletter/:memberId" element={<NewsletterPublicView />} />
            <Route path="/newsletter/:memberId/archive" element={<NewsletterArchive />} />
            <Route path="/newsletter/:memberId/archive/:archiveId" element={<NewsletterPublicView />} />
            <Route path="/newsletter/:memberId/:newsletterId" element={<NewsletterPublicView />} />
            <Route path="/newsletter/:memberId/:newsletterId/archive" element={<NewsletterArchive />} />
            <Route path="/newsletter/:memberId/:newsletterId/archive/:archiveId" element={<NewsletterPublicView />} />

            {/* Anything else in the app goes to the church home page */}
            <Route path="*" element={<GoHome />} />
          </Routes>
        </Suspense>
      </MemberAuthProvider>
    </BrowserRouter>
  );
}

// Leave the app for the plain-HTML home page (a full page load, not an in-app route).
// The dev server has no separate home page (it would reload this app forever), so go to sign-in there.
const GoHome = () => {
  if (import.meta.env.DEV) return <Navigate to="/login" replace />;
  window.location.replace('/');
  return null;
};

export default App;
