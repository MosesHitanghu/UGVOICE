import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import { api } from "../../lib/api";
import CenteredLoader from "../../components/CenteredLoader";
import ExperimentalFeedbackFields, {
  INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
} from "../../components/ExperimentalFeedbackFields";
import UserAvatar from "../../components/UserAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getStoredUser } from "../../lib/session";

type DirectoryUser = {
  id: number;
  username: string;
  email: string;
  fname?: string | null;
  lname?: string | null;
  type?: string | null;
  visibility?: string | null;
  role?: string | null;
  verification_status?: string | null;
  company_name?: string | null;
  company_country?: string | null;
  profile_picture?: string | null;
  description?: string | null;
};

type UserCardAction = "verify" | "label_mp" | "label_parliament" | "label_constituency";
type UserRoleAction = Exclude<UserCardAction, "verify">;

const USERS_PAGE_SIZE = 18;
const FEEDBACK_CATEGORIES = [
  "Service Quality",
  "Security",
  "Health",
  "Finance",
  "Education",
  "Transport",
  "Water and Sanitation",
  "Electricity",
  "Roads and Infrastructure",
  "Agriculture",
  "Environment",
  "Housing",
  "Employment",
  "Public Administration",
  "Corruption",
  "Emergency Response",
  "Community Welfare",
  "Other",
];

const USER_ROLE_ACTIONS: Array<{
  action: UserRoleAction;
  label: string;
  role: string;
}> = [
  { action: "label_mp", label: "Label as MP", role: "MP" },
  { action: "label_parliament", label: "Label as Parliament", role: "Parliament" },
  { action: "label_constituency", label: "Label as Constituency", role: "Constituency" },
];

const getProfileDisplayName = (user: DirectoryUser) => {
  const normalizedType = (user.type || "personal").trim().toLowerCase();
  if (normalizedType !== "personal" && normalizedType !== "individual" && user.company_name) {
    return user.company_name;
  }

  return [user.fname, user.lname].filter(Boolean).join(" ") || user.username;
};

const getProfileTypeLabel = (userType?: string | null) => {
  const normalized = (userType || "personal").trim().toLowerCase();

  if (normalized === "individual") {
    return "Personal";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeAccessValue = (value?: string | null) => value?.trim().toLowerCase() || "";

const canUseRoleActionForUser = (user: DirectoryUser, action: UserRoleAction) => {
  const accountType = normalizeAccessValue(user.type || "personal");
  if (action === "label_mp") {
    return accountType === "personal" || accountType === "individual";
  }
  return accountType === "government organization";
};

const DirectoryPage = () => {
  const theme = useTheme();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [cardMenuAnchorEl, setCardMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedMenuUser, setSelectedMenuUser] = useState<DirectoryUser | null>(null);
  const [deleteDialogUser, setDeleteDialogUser] = useState<DirectoryUser | null>(null);
  const [actionLoadingUserId, setActionLoadingUserId] = useState<number | null>(null);
  const [success, setSuccess] = useState("");
  const [feedbackTargetUser, setFeedbackTargetUser] = useState<DirectoryUser | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({
    title: "",
    category: "",
    description: "",
    ...INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackFormError, setFeedbackFormError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const currentUserRole = normalizeAccessValue(currentUser?.role);
  const currentUserCountry = normalizeAccessValue(currentUser?.company_country);

  const userCardHoverSx = {
    p: 2.5,
    borderRadius: 2,
    cursor: "pointer",
    display: "block",
    width: "100%",
    height: "100%",
    textAlign: "left",
    transition: "transform 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[8],
    },
    "&:focus-visible": {
      outline: `3px solid ${theme.palette.primary.main}`,
      outlineOffset: 3,
    },
  };

  const canManageUserCard = (user: DirectoryUser) =>
    currentUserRole === "admin" ||
    (currentUserRole === "parliament" &&
      currentUserCountry.length > 0 &&
      currentUserCountry === normalizeAccessValue(user.company_country));

  const isRoleSelected = (user: DirectoryUser | null, role: string) =>
    normalizeAccessValue(user?.role) === normalizeAccessValue(role);

  const openCardMenu = (event: React.MouseEvent<HTMLElement>, user: DirectoryUser) => {
    event.preventDefault();
    event.stopPropagation();
    setCardMenuAnchorEl(event.currentTarget);
    setSelectedMenuUser(user);
  };

  const closeCardMenu = () => {
    setCardMenuAnchorEl(null);
    setSelectedMenuUser(null);
  };

  const applyUserAction = async (action: UserCardAction) => {
    if (!currentUserId || !selectedMenuUser) {
      return;
    }

    const targetUserId = selectedMenuUser.id;
    setActionLoadingUserId(targetUserId);
    try {
      setError("");
      setSuccess("");
      const response = await api.post<DirectoryUser>(
        `/users/${targetUserId}/moderation-action`,
        { action },
        { params: { actor_user_id: currentUserId } },
      );
      setUsers((current) =>
        current.map((user) =>
          user.id === targetUserId ? { ...user, ...response.data } : user,
        ),
      );
      closeCardMenu();
    } catch (caughtError: unknown) {
      const detail =
        typeof caughtError === "object" && caughtError !== null && "response" in caughtError
          ? (caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(detail || "Unable to apply that user action.");
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const deleteSelectedUser = async () => {
    if (!currentUserId || !deleteDialogUser || currentUserRole !== "admin") {
      return;
    }

    const targetUser = deleteDialogUser;

    setActionLoadingUserId(targetUser.id);
    try {
      setError("");
      setSuccess("");
      await api.delete(`/users/${targetUser.id}`, {
        params: { actor_user_id: currentUserId },
      });
      setUsers((current) => current.filter((user) => user.id !== targetUser.id));
      setDeleteDialogUser(null);
      setSuccess(`${getProfileDisplayName(targetUser)} was deleted.`);
    } catch (caughtError: unknown) {
      const detail =
        typeof caughtError === "object" && caughtError !== null && "response" in caughtError
          ? (caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setDeleteDialogUser(null);
      setError(detail || "Unable to delete this user.");
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const openFeedbackDialog = (user: DirectoryUser) => {
    setFeedbackTargetUser(user);
    setFeedbackDraft({
      title: "",
      category: "",
      description: "",
      ...INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
    });
    setFeedbackSubmitted(false);
    setFeedbackFormError("");
    setSuccess("");
    setFeedbackDialogOpen(true);
  };

  const getFeedbackTitleError = () => {
    if (!feedbackDraft.title.trim()) {
      return "Feedback title is required.";
    }
    return "";
  };

  const getFeedbackCategoryError = () => {
    if (!feedbackDraft.category.trim()) {
      return "Feedback category is required.";
    }
    return "";
  };

  const getFeedbackDescriptionError = () => {
    if (!feedbackDraft.description.trim()) {
      return "Feedback message is required.";
    }
    if (feedbackDraft.description.trim().length < 10) {
      return "Write at least 10 characters.";
    }
    return "";
  };

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitted(true);
    if (
      !currentUserId ||
      !feedbackTargetUser ||
      getFeedbackTitleError() ||
      getFeedbackCategoryError() ||
      getFeedbackDescriptionError()
    ) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      setFeedbackFormError("");
      setError("");
      await api.post(`/users/${feedbackTargetUser.id}/feedbacks`, {
        author_user_id: currentUserId,
        target_user_id: feedbackTargetUser.id,
        title: feedbackDraft.title.trim(),
        category: feedbackDraft.category.trim() || null,
        description: feedbackDraft.description.trim(),
      });
      setFeedbackDraft({
        title: "",
        category: "",
        description: "",
        ...INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
      });
      setFeedbackDialogOpen(false);
      setSuccess(`Your feedback for ${getProfileDisplayName(feedbackTargetUser)} has been sent.`);
    } catch {
      setFeedbackFormError("Unable to send feedback right now.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const loadUsers = async ({ reset = false }: { reset?: boolean } = {}) => {
    if (!currentUserId) {
      return;
    }

    const nextOffset = reset ? 0 : offset;
    if (reset) {
      if (users.length) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    } else {
      setLoadingMore(true);
    }

    try {
      setError("");
      const response = await api.get<DirectoryUser[]>(
        deferredSearch ? "/search/users" : "/users",
        {
          params: {
            q: deferredSearch || undefined,
            viewer_user_id: currentUserId,
            limit: USERS_PAGE_SIZE,
            offset: nextOffset,
          },
        },
      );
      const nextUsers = response.data.filter((user) => user.id !== currentUser.id);
      setUsers((current) => {
        if (reset) {
          return nextUsers;
        }

        const existingIds = new Set(current.map((user) => user.id));
        return [...current, ...nextUsers.filter((user) => !existingIds.has(user.id))];
      });
      setOffset(nextOffset + response.data.length);
      setHasMore(response.data.length === USERS_PAGE_SIZE);
    } catch {
      setError(reset ? "Unable to load users." : "Unable to load more users.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    void loadUsers({ reset: true });
  }, [currentUserId, deferredSearch]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loading || refreshing || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadUsers();
        }
      },
      { rootMargin: "280px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loading, refreshing, loadingMore, offset, currentUserId, deferredSearch]);

  return (
      <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Search people
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              Discover users across the system and explore their visible posts.
            </Typography>
          </Box>
          <TextField
            label="Search users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: { xs: "100%", md: 320 } }}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {refreshing ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : null}
      </Paper>

      {loading && !users.length ? (
        <CenteredLoader minHeight={260} />
      ) : (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        {users.map((user) => (
          <Paper
            key={user.id}
            elevation={2}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/users/${user.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/dashboard/users/${user.id}`);
              }
            }}
            sx={userCardHoverSx}
          >
            <Stack spacing={1.5} sx={{ height: "100%" }}>
              <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <UserAvatar
                    username={user.username}
                    fname={user.fname}
                    lname={user.lname}
                    profile_picture={user.profile_picture}
                    sx={{ width: 42, height: 42 }}
                  />
                  <Box>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        maxWidth: "100%",
                      }}
                    >
                      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getProfileDisplayName(user)}
                      </Box>
                      <VerifiedBadge verificationStatus={user.verification_status} sx={{ fontSize: 18 }} />
                    </Typography>
                    <Typography color="text.secondary">@{user.username}</Typography>
                  </Box>
                </Box>
                {canManageUserCard(user) ? (
                  <Tooltip title="Manage user">
                    <IconButton
                      size="small"
                      aria-label={`Manage ${getProfileDisplayName(user)}`}
                      onClick={(event) => openCardMenu(event, user)}
                      sx={{ alignSelf: "flex-start", mt: -0.5, mr: -0.5 }}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>

              <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
                {user.description || user.company_name || "No profile summary added yet."}
              </Typography>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%", mt: "auto" }}
              >
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={getProfileTypeLabel(user.type)}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                  />
                  {user.role && normalizeAccessValue(user.role) !== "standard" ? (
                    <Chip label={user.role} size="small" color="primary" variant="outlined" />
                  ) : null}
                </Stack>
                <Button
                  variant="contained"
                  size="small"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openFeedbackDialog(user);
                  }}
                  sx={{ ml: "auto", flexShrink: 0, borderRadius: "999px", textTransform: "none" }}
                >
                  Give Feedback
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Box>
      )}
      {!loading && hasMore ? (
        <>
          <Box ref={loadMoreRef} sx={{ height: 1 }} />
          {loadingMore ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="center"
            sx={{ alignSelf: "center", py: 1 }}
          >
            <CircularProgress size={20} />
          </Stack>
          ) : null}
        </>
      ) : null}
      {!loading && !users.length ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No users match your current search.
        </Typography>
      ) : null}
      <Menu
        anchorEl={cardMenuAnchorEl}
        open={Boolean(cardMenuAnchorEl)}
        onClose={closeCardMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {selectedMenuUser && canManageUserCard(selectedMenuUser) ? (
          <MenuItem
            disabled={actionLoadingUserId === selectedMenuUser.id}
            onClick={() => void applyUserAction("verify")}
          >
            Verify account
          </MenuItem>
        ) : null}
        {selectedMenuUser && canManageUserCard(selectedMenuUser)
          ? USER_ROLE_ACTIONS.filter((item) =>
              canUseRoleActionForUser(selectedMenuUser, item.action),
            ).map((item) => (
              <ToggleButton
                key={item.action}
                value={item.action}
                selected={isRoleSelected(selectedMenuUser, item.role)}
                disabled={actionLoadingUserId === selectedMenuUser.id}
                onClick={() => void applyUserAction(item.action)}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  border: 0,
                  borderRadius: "0 !important",
                  px: 2,
                  py: 0.9,
                  textTransform: "none",
                  fontWeight: 500,
                  "&.Mui-selected": {
                    bgcolor: "transparent",
                    color: "primary.main",
                    fontWeight: 700,
                  },
                }}
              >
                {isRoleSelected(selectedMenuUser, item.role) ? (
                  <CheckRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                ) : (
                  <Box component="span" sx={{ width: 20, mr: 1 }} />
                )}
                {item.label}
              </ToggleButton>
            ))
          : null}
        {selectedMenuUser && currentUserRole === "admin" ? (
          <MenuItem
            disabled={actionLoadingUserId === selectedMenuUser.id}
            onClick={() => {
              setDeleteDialogUser(selectedMenuUser);
              closeCardMenu();
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            Delete user
          </MenuItem>
        ) : null}
      </Menu>
      <Dialog
        open={Boolean(deleteDialogUser)}
        onClose={() => {
          if (actionLoadingUserId === null) {
            setDeleteDialogUser(null);
          }
        }}
        aria-labelledby="delete-directory-user-title"
        aria-describedby="delete-directory-user-description"
      >
        <DialogTitle id="delete-directory-user-title">Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-directory-user-description">
            {deleteDialogUser
              ? `Delete ${getProfileDisplayName(deleteDialogUser)}? This permanently removes the account and its related posts, feedback, and activity.`
              : "This permanently removes the account and its related data."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogUser(null)}
            disabled={actionLoadingUserId !== null}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void deleteSelectedUser()}
            color="error"
            variant="contained"
            disabled={actionLoadingUserId !== null}
            autoFocus
          >
            {actionLoadingUserId !== null ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Delete user"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={feedbackDialogOpen}
        onClose={() => {
          if (!feedbackSubmitting) {
            setFeedbackDialogOpen(false);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Give Feedback to {feedbackTargetUser ? getProfileDisplayName(feedbackTargetUser) : "this user"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {feedbackFormError ? <Alert severity="error">{feedbackFormError}</Alert> : null}
            <ExperimentalFeedbackFields
              value={feedbackDraft}
              onChange={(value) =>
                setFeedbackDraft((current) => ({
                  ...current,
                  ...value,
                }))
              }
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(0, 1fr)" },
                gap: 1.5,
              }}
            >
              <TextField
                label="Feedback title"
                value={feedbackDraft.title}
                onChange={(event) =>
                  setFeedbackDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                size="small"
                error={Boolean(feedbackSubmitted && getFeedbackTitleError())}
                helperText={feedbackSubmitted ? getFeedbackTitleError() : ""}
                fullWidth
              />
              <Autocomplete
                freeSolo
                options={FEEDBACK_CATEGORIES}
                value={feedbackDraft.category || null}
                inputValue={feedbackDraft.category}
                onChange={(_, value) =>
                  setFeedbackDraft((current) => ({
                    ...current,
                    category: value || "",
                  }))
                }
                onInputChange={(_, value) =>
                  setFeedbackDraft((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Category"
                    size="small"
                    error={Boolean(feedbackSubmitted && getFeedbackCategoryError())}
                    helperText={feedbackSubmitted ? getFeedbackCategoryError() : ""}
                    fullWidth
                  />
                )}
              />
            </Box>
            <TextField
              label="Section B: Your Feedback"
              value={feedbackDraft.description}
              onChange={(event) =>
                setFeedbackDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              multiline
              minRows={5}
              placeholder="Please share your feedback, concern, or suggestion about a public service or government policy in your area. MPs may record feedback received from constituents."
              error={Boolean(feedbackSubmitted && getFeedbackDescriptionError())}
              helperText={feedbackSubmitted ? getFeedbackDescriptionError() : ""}
              fullWidth
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                onClick={() => void handleSubmitFeedback()}
                disabled={
                  feedbackSubmitting ||
                  !feedbackDraft.title.trim() ||
                  !feedbackDraft.category.trim() ||
                  !feedbackDraft.description.trim()
                }
                sx={{ borderRadius: "999px" }}
              >
                {feedbackSubmitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Send feedback"
                )}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default DirectoryPage;
