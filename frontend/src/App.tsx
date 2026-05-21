import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MenuHome from "./pages/MenuHome";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import Main from "./pages/dashboard/Main";
import FeedPage from "./pages/dashboard/FeedPage";
import DirectoryPage from "./pages/dashboard/DirectoryPage";
import ProfilePage from "./pages/dashboard/ProfilePage";
import PostArticlePage from "./pages/dashboard/PostArticlePage";
import SettingsPage from "./pages/dashboard/SettingsPage";
import UserPublicProfilePage from "./pages/dashboard/UserPublicProfilePage";
import EmergingIssueFeedbacksPage from "./pages/dashboard/EmergingIssueFeedbacksPage";
import { getStoredUser, isAuthenticated } from "./lib/session";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard/feed" replace />;
  }
  return <>{children}</>;
}

const PUBLISHING_ROLES = new Set(["admin", "mp", "parliament", "constituency"]);

function AnalyticsAllowedOnly({ children }: { children: React.ReactNode }) {
  const role = (getStoredUser()?.role || "").trim().toLowerCase();
  if (!PUBLISHING_ROLES.has(role)) {
    return <Navigate to="/dashboard/feed" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnly>
              <MenuHome />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <MenuHome />
            </PublicOnly>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <MenuHome />
            </PublicOnly>
          }
        />
        <Route path="/shared-post/:postId" element={<PostArticlePage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard/feed" replace />} />
          <Route
            path="overview"
            element={
              <AnalyticsAllowedOnly>
                <Main />
              </AnalyticsAllowedOnly>
            }
          />
          <Route path="feed" element={<FeedPage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="posts/:postId" element={<PostArticlePage />} />
          <Route path="users/:userId" element={<UserPublicProfilePage />} />
          <Route path="emerging-issues/:issueId/feedbacks" element={<EmergingIssueFeedbacksPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
