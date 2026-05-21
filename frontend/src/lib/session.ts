import type { ApiUser } from "./api";

const SESSION_KEY = "ugvoice_current_user";
const SESSION_LAST_ACTIVITY_KEY = "ugvoice_last_activity_at";
const VIEWER_KEY = "ugvoice_viewer_key";
export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function getLastActivityAt() {
  const raw = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY);
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getStoredUser(): ApiUser | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw) as ApiUser;
    const lastActivityAt = getLastActivityAt();

    // Older sessions may not have an activity timestamp yet.
    if (lastActivityAt === null) {
      touchSessionActivity();
      return user;
    }

    if (Date.now() - lastActivityAt >= SESSION_INACTIVITY_TIMEOUT_MS) {
      clearStoredUser();
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
    return null;
  }
}

export function storeUser(user: ApiUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  touchSessionActivity();
}

export function clearStoredUser() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
}

export function touchSessionActivity() {
  if (!localStorage.getItem(SESSION_KEY)) {
    return;
  }
  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getSessionTimeRemainingMs() {
  if (!localStorage.getItem(SESSION_KEY)) {
    return 0;
  }

  const lastActivityAt = getLastActivityAt();
  if (lastActivityAt === null) {
    touchSessionActivity();
    return SESSION_INACTIVITY_TIMEOUT_MS;
  }

  return Math.max(
    0,
    SESSION_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt),
  );
}

export function isAuthenticated() {
  return getStoredUser() !== null;
}

export function getOrCreateViewerKey() {
  const existingKey = localStorage.getItem(VIEWER_KEY);
  if (existingKey) {
    return existingKey;
  }

  const nextKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  localStorage.setItem(VIEWER_KEY, nextKey);
  return nextKey;
}
