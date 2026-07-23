import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";

import CenteredLoader from "./components/CenteredLoader";
import MenuHome from "./pages/MenuHome";
import { getStoredUser, isAuthenticated } from "./lib/session";

const DashboardLayout = lazy(() => import("./pages/dashboard/DashboardLayout"));
const Main = lazy(() => import("./pages/dashboard/Main"));
const FeedPage = lazy(() => import("./pages/dashboard/FeedPage"));
const DirectoryPage = lazy(() => import("./pages/dashboard/DirectoryPage"));
const ProfilePage = lazy(() => import("./pages/dashboard/ProfilePage"));
const PostArticlePage = lazy(() => import("./pages/dashboard/PostArticlePage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const UserPublicProfilePage = lazy(
  () => import("./pages/dashboard/UserPublicProfilePage"),
);
const EmergingIssueFeedbacksPage = lazy(
  () => import("./pages/dashboard/EmergingIssueFeedbacksPage"),
);

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
const APP_FONT_FAMILY = '"Google Sans", "Segoe UI", sans-serif';
const appTheme = createTheme({
  typography: {
    fontFamily: APP_FONT_FAMILY,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          fontFamily: APP_FONT_FAMILY,
        },
        body: {
          fontFamily: APP_FONT_FAMILY,
        },
        "#root": {
          fontFamily: APP_FONT_FAMILY,
        },
        "button, input, textarea, select": {
          fontFamily: "inherit",
        },
      },
    },
  },
});

function AnalyticsAllowedOnly({ children }: { children: React.ReactNode }) {
  const role = (getStoredUser()?.role || "").trim().toLowerCase();
  if (!PUBLISHING_ROLES.has(role)) {
    return <Navigate to="/dashboard/feed" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<CenteredLoader minHeight="100vh" />}>
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
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
