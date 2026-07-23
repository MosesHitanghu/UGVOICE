import { useDeferredValue, useEffect, useRef, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import SyncAltRoundedIcon from "@mui/icons-material/SyncAltRounded";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityIcon from "@mui/icons-material/Visibility";

import { api } from "../../lib/api";
import CenteredLoader from "../../components/CenteredLoader";
import ExperimentalFeedbackFields, {
  INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
} from "../../components/ExperimentalFeedbackFields";
import PostThumbnail from "../../components/PostThumbnail";
import PostCategoryAutocomplete from "../../components/PostCategoryAutocomplete";
import PostReviewDialog from "../../components/PostReviewDialog";
import ReviewSourceFields from "../../components/ReviewSourceFields";
import SharePostDialog from "../../components/SharePostDialog";
import UserAvatar from "../../components/UserAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getStoredUser, storeUser } from "../../lib/session";
import {
  formatPostAge,
  formatReviewCount,
  formatViewCount,
} from "../../lib/postDisplay";

type PublicUser = {
  id: number;
  parent_user_id?: number | null;
  username: string;
  email: string;
  role?: string | null;
  fname?: string | null;
  lname?: string | null;
  type?: string | null;
  company_name?: string | null;
  company_country?: string | null;
  company_city?: string | null;
  type_of_business?: string | null;
  description?: string | null;
  gender?: string | null;
  profile_picture?: string | null;
  verification_status?: string | null;
};

type ChildAccount = {
  id: number;
  username: string;
  company_name?: string | null;
  type?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  fname?: string | null;
  lname?: string | null;
};

type ParentSwitchForm = {
  email_or_mobile_number: string;
  password: string;
};

type UserProfileAction = "verify" | "label_mp" | "label_parliament" | "label_constituency";
type UserRoleAction = Exclude<UserProfileAction, "verify">;

type UserPost = {
  id: number;
  title?: string | null;
  content: string;
  category?: string | null;
  visibility: string;
  thumbnail?: string | null;
  attachment?: string | null;
  share_url?: string | null;
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
  view_count?: number;
  date_added?: string | null;
  time_added?: string | null;
  author: {
    id: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    profile_picture?: string | null;
    verification_status?: string | null;
  };
  review_count: number;
  viewer_reaction?: string | null;
  viewer_has_reviewed?: boolean;
  reaction_summary: {
    total: number;
    counts: Record<string, number>;
  };
};

type PostReview = {
  id: number;
  content: string;
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
  author: {
    id?: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    profile_picture?: string | null;
  };
};

type PostDetail = UserPost & {
  analytics: {
    total_reviews: number;
    total_reactions: number;
    reactions: Record<string, number>;
    sentiment_breakdown: Record<string, number>;
  };
};

const POSTS_PAGE_SIZE = 9;
const POST_VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  constituency: "My constituency",
  private: "Private",
};
const getPostVisibilityLabel = (visibility?: string | null) =>
  POST_VISIBILITY_LABELS[visibility || "public"] || "Public";
const getNextPostVisibility = (visibility?: string | null) => {
  if (visibility === "public") {
    return "constituency";
  }
  if (visibility === "constituency") {
    return "private";
  }
  return "public";
};
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
const getProfileDisplayName = (user: PublicUser) => {
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

const canUseRoleActionForUser = (user: PublicUser, action: UserRoleAction) => {
  const accountType = normalizeAccessValue(user.type || "personal");
  if (action === "label_mp") {
    return accountType === "personal" || accountType === "individual";
  }
  return accountType === "government organization";
};

const getPostAuthorLabel = (
  author: {
    id: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
  },
  currentUserId?: number | null,
) =>
  author.id === currentUserId
    ? "By you"
    : [author.fname, author.lname].filter(Boolean).join(" ") || author.username;

const getReviewSource = (review: PostReview) => ({
  district_id: review.district_id || null,
  constituency_id: review.constituency_id || null,
  subcounty_id: review.subcounty_id || null,
  parish_id: review.parish_id || null,
});

const UserPublicProfilePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { userId } = useParams();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const currentUserRole = normalizeAccessValue(currentUser?.role);
  const currentUserCountry = normalizeAccessValue(currentUser?.company_country);
  const defaultSource = {
    district_id: currentUser?.district_id ?? null,
    constituency_id: currentUser?.constituency_id ?? null,
    subcounty_id: currentUser?.subcounty_id ?? null,
    parish_id: currentUser?.parish_id ?? null,
  };

  const [user, setUser] = useState<PublicUser | null>(null);
  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
  const [parentAccount, setParentAccount] = useState<ChildAccount | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState({
    title: "",
    category: "",
    description: "",
    ...INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackFormError, setFeedbackFormError] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [profileActionMenuAnchorEl, setProfileActionMenuAnchorEl] =
    useState<HTMLElement | null>(null);
  const [profileActionLoading, setProfileActionLoading] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [switchMenuAnchorEl, setSwitchMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [parentSwitchDrawerOpen, setParentSwitchDrawerOpen] = useState(false);
  const [parentSwitchTarget, setParentSwitchTarget] = useState<ChildAccount | null>(null);
  const [parentSwitchForm, setParentSwitchForm] = useState<ParentSwitchForm>({
    email_or_mobile_number: "",
    password: "",
  });
  const [parentSwitchShowPassword, setParentSwitchShowPassword] = useState(false);
  const [parentSwitchSubmitted, setParentSwitchSubmitted] = useState(false);
  const [parentSwitchError, setParentSwitchError] = useState("");
  const [activePost, setActivePost] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewDialogPost, setReviewDialogPost] = useState<UserPost | null>(null);
  const [submittedReviewsByPostId, setSubmittedReviewsByPostId] = useState<
    Record<number, PostReview>
  >({});
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewSource, setReviewSource] = useState({
    district_id: defaultSource.district_id,
    constituency_id: defaultSource.constituency_id,
    subcounty_id: defaultSource.subcounty_id,
    parish_id: defaultSource.parish_id,
  });
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [postsOffset, setPostsOffset] = useState(0);
  const [postMenuAnchorEl, setPostMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedPost, setSelectedPost] = useState<UserPost | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPostDraft, setEditPostDraft] = useState({
    id: 0,
    title: "",
    content: "",
    category: "",
    visibility: "public",
    district_id: defaultSource.district_id,
    constituency_id: defaultSource.constituency_id,
    subcounty_id: defaultSource.subcounty_id,
    parish_id: defaultSource.parish_id,
  });
  const [editPostSubmitted, setEditPostSubmitted] = useState(false);
  const [editPostError, setEditPostError] = useState("");
  const [postActionLoading, setPostActionLoading] = useState(false);
  const [shareDialogPost, setShareDialogPost] = useState<UserPost | null>(null);
  const loadMorePostsRef = useRef<HTMLDivElement | null>(null);
  const isOwnProfile = Boolean(currentUserId && user && currentUserId === user.id);
  const canGiveFeedback = Boolean(currentUserId && user && currentUserId !== user.id);
  const canSwitchAccounts = isOwnProfile && (childAccounts.length > 0 || Boolean(parentAccount));

  const canManageProfile = (profileUser: PublicUser) =>
    !isOwnProfile &&
    (currentUserRole === "admin" ||
      (currentUserRole === "parliament" &&
        currentUserCountry.length > 0 &&
        currentUserCountry === normalizeAccessValue(profileUser.company_country)));

  const isRoleSelected = (profileUser: PublicUser | null, role: string) =>
    normalizeAccessValue(profileUser?.role) === normalizeAccessValue(role);

  const loadPosts = async ({ reset = false }: { reset?: boolean } = {}) => {
    if (!userId || !currentUserId) {
      return;
    }

    const nextOffset = reset ? 0 : postsOffset;
    if (reset && posts.length) {
      setPostsRefreshing(true);
    } else if (!reset) {
      setPostsLoading(true);
    }

    try {
      const response = await api.get<UserPost[]>(`/users/${userId}/posts`, {
        params: {
          viewer_user_id: currentUserId,
          q: deferredSearch || undefined,
          limit: POSTS_PAGE_SIZE,
          offset: nextOffset,
        },
      });
      setPosts((current) => (reset ? response.data : [...current, ...response.data]));
      setPostsOffset(nextOffset + response.data.length);
      setHasMorePosts(response.data.length === POSTS_PAGE_SIZE);
    } finally {
      setPostsLoading(false);
      setPostsRefreshing(false);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId || !currentUserId) {
        setLoading(false);
        return;
      }

      try {
        setError("");
        const response = await api.get<PublicUser>(`/users/${userId}`, {
          params: {
            viewer_user_id: currentUserId,
          },
        });
        setUser(response.data);
        setPostsOffset(0);
        await loadPosts({ reset: true });
      } catch {
        setError("Unable to load this profile right now.");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [userId, currentUserId, deferredSearch]);

  useEffect(() => {
    const sentinel = loadMorePostsRef.current;
    if (!sentinel || !hasMorePosts || postsLoading || postsRefreshing || loading) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          void loadPosts();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMorePosts, postsLoading, postsRefreshing, loading, postsOffset, userId, currentUserId, deferredSearch]);

  useEffect(() => {
    const loadChildAccounts = async () => {
      if (!userId || !currentUserId || Number(userId) !== currentUserId) {
        setChildAccounts([]);
        setParentAccount(null);
        return;
      }

      try {
        if (currentUser?.parent_user_id) {
          const response = await api.get<ChildAccount>(
            `/users/${currentUser.parent_user_id}`,
            {
              params: {
                viewer_user_id: currentUserId,
              },
            },
          );
          setParentAccount(response.data);
          setChildAccounts([]);
          return;
        }

        const response = await api.get<ChildAccount[]>(
          `/users/${userId}/child-accounts`,
          {
            params: {
              viewer_user_id: currentUserId,
            },
          },
        );
        setChildAccounts(response.data);
        setParentAccount(null);
      } catch {
        setChildAccounts([]);
        setParentAccount(null);
      }
    };

    void loadChildAccounts();
  }, [userId, currentUserId, currentUser?.parent_user_id]);

  const openPost = async (postId: number) => {
    if (!currentUserId) {
      return;
    }

    setDetailLoading(true);
    try {
      const response = await api.get<PostDetail>(`/posts/${postId}`, {
        params: {
          viewer_user_id: currentUserId,
        },
      });
      setActivePost(response.data);
    } catch {
      setError("Unable to load post details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReaction = async (postId: number, reactionType: string) => {
    if (!currentUserId) {
      return;
    }

    try {
      await recordInteractionView(postId);
      await api.post(`/posts/${postId}/reactions`, {
        user_id: currentUserId,
        reaction_type: reactionType,
      });
      await loadPosts({ reset: true });
      if (activePost?.id === postId) {
        await openPost(postId);
      }
    } catch {
      setError("Unable to update reaction.");
    }
  };

  const recordInteractionView = async (postId: number) => {
    if (!currentUserId) {
      return;
    }

    try {
      const response = await api.post<{ view_count: number; counted: boolean }>(
        `/posts/${postId}/interaction-view`,
        null,
        {
          params: {
            viewer_user_id: currentUserId,
          },
        },
      );
      if (!response.data.counted) {
        return;
      }
      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? { ...post, view_count: response.data.view_count }
            : post,
        ),
      );
    } catch {
      // Keep the action usable even if the interaction view counter fails.
    }
  };

  const handleOpenReviewDialog = async (post: UserPost) => {
    void recordInteractionView(post.id);
    const cachedReview = submittedReviewsByPostId[post.id];
    setReviewDialogPost(post);
    setReviewDraft(cachedReview?.content || "");
    setReviewSource(
      cachedReview
        ? getReviewSource(cachedReview)
        : {
            district_id: defaultSource.district_id,
            constituency_id: defaultSource.constituency_id,
            subcounty_id: defaultSource.subcounty_id,
            parish_id: defaultSource.parish_id,
          },
    );
    setReviewError("");
    setReviewSuccess("");

    if ((!post.viewer_has_reviewed && !cachedReview) || !currentUserId) {
      return;
    }

    try {
      const response = await api.get<PostReview[]>(`/posts/${post.id}/reviews`, {
        params: {
          viewer_user_id: currentUserId,
        },
      });
      const viewerReview = response.data.find(
        (review) => review.author.id === currentUserId,
      );
      if (!viewerReview) {
        return;
      }
      setSubmittedReviewsByPostId((current) => ({
        ...current,
        [post.id]: viewerReview,
      }));
      setReviewDraft(viewerReview.content);
      setReviewSource(getReviewSource(viewerReview));
    } catch {
      setReviewSuccess("");
      setReviewError("Unable to load your submitted review.");
    }
  };

  const handleReview = async () => {
    const sourcePost = reviewDialogPost;
    if (sourcePost?.viewer_has_reviewed) {
      setReviewSuccess("");
      setReviewError("You can only review once on a post.");
      return;
    }
    if (!currentUserId || !sourcePost || !reviewDraft.trim()) {
      setReviewSuccess("");
      setReviewError("Review is required.");
      return;
    }

    setReviewSubmitting(true);
    try {
      setReviewError("");
      setReviewSuccess("");
      const response = await api.post<PostReview>(`/posts/${sourcePost.id}/reviews`, {
        author_user_id: currentUserId,
        content: reviewDraft.trim(),
        district_id: reviewSource.district_id,
        constituency_id: reviewSource.constituency_id,
        subcounty_id: reviewSource.subcounty_id,
        parish_id: reviewSource.parish_id,
      });
      setReviewDraft(response.data.content);
      setReviewSource(getReviewSource(response.data));
      setReviewDialogPost({ ...sourcePost, viewer_has_reviewed: true });
      setSubmittedReviewsByPostId((current) => ({
        ...current,
        [sourcePost.id]: response.data,
      }));
      setPosts((current) =>
        current.map((post) =>
          post.id === sourcePost.id
            ? { ...post, review_count: post.review_count + 1, viewer_has_reviewed: true }
            : post,
        ),
      );
      if (activePost?.id === sourcePost.id) {
        await openPost(sourcePost.id);
      }
      setReviewSuccess("Your review has been submitted successfully.");
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setReviewSuccess("");
      setReviewError(typeof detail === "string" ? detail : "Unable to add review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSharePost = (post: UserPost) => {
    void recordInteractionView(post.id);
    setShareDialogPost(post);
  };

  const handleReviewSourceChange = (source: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setReviewSource({
      district_id: source.district_id ?? null,
      constituency_id: source.constituency_id ?? null,
      subcounty_id: source.subcounty_id ?? null,
      parish_id: source.parish_id ?? null,
    });
  };

  const closePostMenu = () => {
    setPostMenuAnchorEl(null);
    setSelectedPost(null);
  };

  const openPostMenu = (event: React.MouseEvent<HTMLElement>, post: UserPost) => {
    setPostMenuAnchorEl(event.currentTarget);
    setSelectedPost(post);
  };

  const getEditPostTitleError = () => {
    if (!editPostDraft.title.trim()) {
      return "Post title is required.";
    }
    if (editPostDraft.title.trim().length > 120) {
      return "Keep the title under 120 characters.";
    }
    return "";
  };

  const getEditPostContentError = () => {
    if (!editPostDraft.content.trim()) {
      return "Post content is required.";
    }
    if (editPostDraft.content.trim().length < 10) {
      return "Write at least 10 characters.";
    }
    return "";
  };

  const refreshPosts = async () => {
    setPostsOffset(0);
    await loadPosts({ reset: true });
  };

  const handleOpenEditDialog = () => {
    if (!selectedPost) {
      return;
    }

    setEditPostDraft({
      id: selectedPost.id,
      title: selectedPost.title || "",
      content: selectedPost.content,
      category: selectedPost.category || "",
      visibility: selectedPost.visibility,
      district_id: selectedPost.district_id ?? defaultSource.district_id,
      constituency_id:
        selectedPost.constituency_id ?? defaultSource.constituency_id,
      subcounty_id: selectedPost.subcounty_id ?? defaultSource.subcounty_id,
      parish_id: selectedPost.parish_id ?? defaultSource.parish_id,
    });
    setEditPostSubmitted(false);
    setEditPostError("");
    setEditDialogOpen(true);
    closePostMenu();
  };

  const handleEditPost = async () => {
    if (!currentUserId) {
      return;
    }

    setEditPostSubmitted(true);
    if (getEditPostTitleError() || getEditPostContentError()) {
      return;
    }

    try {
      setPostActionLoading(true);
      setEditPostError("");
      await api.put(
        `/posts/${editPostDraft.id}`,
        {
          title: editPostDraft.title.trim(),
          content: editPostDraft.content.trim(),
          category: editPostDraft.category.trim() || null,
          visibility: editPostDraft.visibility,
          district_id: editPostDraft.district_id,
          constituency_id: editPostDraft.constituency_id,
          subcounty_id: editPostDraft.subcounty_id,
          parish_id: editPostDraft.parish_id,
        },
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      await refreshPosts();
      if (activePost?.id === editPostDraft.id) {
        await openPost(editPostDraft.id);
      }
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setEditPostError(
        typeof detail === "string" ? detail : "Unable to update this post.",
      );
    } finally {
      setPostActionLoading(false);
    }
  };

  const handleEditPostSourceChange = (source: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setEditPostDraft((current) => ({
      ...current,
      district_id: source.district_id ?? null,
      constituency_id: source.constituency_id ?? null,
      subcounty_id: source.subcounty_id ?? null,
      parish_id: source.parish_id ?? null,
    }));
  };

  const handleHidePost = async () => {
    if (!currentUserId || !selectedPost) {
      return;
    }

    const postId = selectedPost.id;
    closePostMenu();

    try {
      setPostActionLoading(true);
      await api.put(
        `/posts/${postId}`,
        { visibility: "private" },
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      if (activePost?.id === postId) {
        setActivePost(null);
      }
      await refreshPosts();
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Unable to hide this post.");
    } finally {
      setPostActionLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUserId || !selectedPost) {
      return;
    }

    const postId = selectedPost.id;
    const confirmed = window.confirm("Delete this post?");
    closePostMenu();
    if (!confirmed) {
      return;
    }

    try {
      setPostActionLoading(true);
      await api.delete(`/posts/${postId}`, {
        params: {
          actor_user_id: currentUserId,
        },
      });
      if (activePost?.id === postId) {
        setActivePost(null);
      }
      await refreshPosts();
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Unable to delete this post.",
      );
    } finally {
      setPostActionLoading(false);
    }
  };

  const handleToggleActivePostVisibility = async () => {
    if (!currentUserId || !activePost || activePost.author.id !== currentUserId) {
      return;
    }

    const activePostId = activePost.id;
    const nextVisibility = getNextPostVisibility(activePost.visibility);

    try {
      setPostActionLoading(true);
      await api.put(
        `/posts/${activePost.id}`,
        { visibility: nextVisibility },
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      setActivePost((current) =>
        current ? { ...current, visibility: nextVisibility } : current,
      );
      setPosts((current) =>
        current.map((post) =>
          post.id === activePostId
            ? {
                ...post,
                visibility: nextVisibility,
              }
            : post,
        ),
      );
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to update post visibility right now.",
      );
    } finally {
      setPostActionLoading(false);
    }
  };

  const handleSwitchAccountById = async (targetUserId: number) => {
    if (!currentUserId) {
      return;
    }

    try {
      setSwitchingAccount(true);
      const response = await api.post<{ message: string; user: PublicUser }>(
        `/users/${targetUserId}/switch-account`,
        null,
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      storeUser(response.data.user);
      navigate(`/dashboard/users/${targetUserId}`, { replace: true });
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Unable to switch to this account right now.",
      );
    } finally {
      setSwitchingAccount(false);
      setSwitchMenuAnchorEl(null);
    }
  };

  const openParentSwitchDrawer = (account: ChildAccount) => {
    setSwitchMenuAnchorEl(null);
    setParentSwitchTarget(account);
    setParentSwitchForm({
      email_or_mobile_number: account.email || "",
      password: "",
    });
    setParentSwitchShowPassword(false);
    setParentSwitchSubmitted(false);
    setParentSwitchError("");
    setParentSwitchDrawerOpen(true);
  };

  const getParentSwitchIdentifierError = () => {
    const value = parentSwitchForm.email_or_mobile_number.trim();
    if (!value) {
      return "Parent email or mobile number is required.";
    }
    if (value.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Enter a valid email address.";
    }
    if (!value.includes("@") && !/^[+\d][\d\s-]{6,}$/.test(value)) {
      return "Enter a valid mobile number.";
    }
    return "";
  };

  const getParentSwitchPasswordError = () => {
    if (!parentSwitchForm.password.trim()) {
      return "Password is required.";
    }
    return "";
  };

  const handleParentSwitchSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setParentSwitchSubmitted(true);
    if (
      !currentUserId ||
      !parentSwitchTarget ||
      getParentSwitchIdentifierError() ||
      getParentSwitchPasswordError()
    ) {
      return;
    }

    try {
      setSwitchingAccount(true);
      setParentSwitchError("");
      const response = await api.post<{ message: string; user: PublicUser }>(
        `/users/${parentSwitchTarget.id}/switch-account-with-login`,
        parentSwitchForm,
        {
          params: {
            actor_user_id: currentUserId,
          },
        },
      );
      storeUser(response.data.user);
      setParentSwitchDrawerOpen(false);
      navigate(`/dashboard/users/${parentSwitchTarget.id}`, { replace: true });
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to switch to the parent account."
          : "Unable to switch to the parent account.";
      setParentSwitchError(message);
    } finally {
      setSwitchingAccount(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitted(true);
    if (
      !currentUserId ||
      !user ||
      getFeedbackTitleError() ||
      getFeedbackCategoryError() ||
      getFeedbackDescriptionError()
    ) {
      return;
    }

    setFeedbackSubmitting(true);
    try {
      setFeedbackFormError("");
      await api.post(`/users/${user.id}/feedbacks`, {
        author_user_id: currentUserId,
        target_user_id: user.id,
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
      setFeedbackSuccess(`Your feedback for ${getProfileDisplayName(user)} has been sent.`);
    } catch {
      setFeedbackFormError("Unable to send feedback right now.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const openFeedbackDialog = () => {
    setFeedbackSuccess("");
    setFeedbackFormError("");
    setFeedbackSubmitted(false);
    setFeedbackDraft({
      title: "",
      category: "",
      description: "",
      ...INITIAL_EXPERIMENTAL_FEEDBACK_DRAFT,
    });
    setFeedbackDialogOpen(true);
  };

  const applyUserAction = async (action: UserProfileAction) => {
    if (!currentUserId || !user) {
      return;
    }

    setProfileActionLoading(true);
    try {
      setError("");
      setFeedbackSuccess("");
      const response = await api.post<PublicUser>(
        `/users/${user.id}/moderation-action`,
        { action },
        { params: { actor_user_id: currentUserId } },
      );
      setUser((current) =>
        current ? { ...current, ...response.data } : response.data,
      );
      setProfileActionMenuAnchorEl(null);
    } catch (caughtError: unknown) {
      const detail =
        typeof caughtError === "object" && caughtError !== null && "response" in caughtError
          ? (caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setError(detail || "Unable to apply that user action.");
    } finally {
      setProfileActionLoading(false);
    }
  };

  const deleteProfileUser = async () => {
    if (!currentUserId || !user || currentUserRole !== "admin" || isOwnProfile) {
      return;
    }

    setProfileActionLoading(true);
    try {
      setError("");
      await api.delete(`/users/${user.id}`, {
        params: { actor_user_id: currentUserId },
      });
      setDeleteUserDialogOpen(false);
      setProfileActionMenuAnchorEl(null);
      navigate("/dashboard/directory", { replace: true });
    } catch (caughtError: unknown) {
      const detail =
        typeof caughtError === "object" && caughtError !== null && "response" in caughtError
          ? (caughtError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      setDeleteUserDialogOpen(false);
      setError(detail || "Unable to delete this user.");
    } finally {
      setProfileActionLoading(false);
    }
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

  const reactionToggleSx = (reactionType: "like" | "dislike", active: boolean) => {
    const paletteColor =
      reactionType === "like" ? theme.palette.success.main : theme.palette.error.main;

    return {
      minWidth: 52,
      px: 0.75,
      py: 0.75,
      fontSize: "0.78rem",
      lineHeight: 1.1,
      justifyContent: "center",
      whiteSpace: "nowrap",
      gap: 0.5,
      border: "0 !important",
      borderRadius: "999px !important",
      color: active ? theme.palette.common.white : paletteColor,
      bgcolor: active ? paletteColor : alpha(paletteColor, 0.08),
      "& svg": {
        fontSize: "1rem",
      },
      "&:hover": {
        bgcolor: active ? paletteColor : alpha(paletteColor, 0.14),
      },
    };
  };

  const reactionGroupSx = {
    display: "inline-flex",
    borderRadius: "999px",
    overflow: "hidden",
    bgcolor: alpha(theme.palette.text.primary, 0.04),
    "& .MuiToggleButtonGroup-grouped": {
      border: "0 !important",
      borderRadius: "999px !important",
      mx: 0,
    },
    "& .MuiToggleButtonGroup-grouped:not(:first-of-type)": {
      ml: 0,
    },
  };

  const secondaryActionButtonSx = {
    minWidth: 0,
    px: 0.75,
    py: 0.75,
    fontSize: "0.78rem",
    lineHeight: 1.1,
    justifyContent: "center",
    whiteSpace: "nowrap",
    borderRadius: "999px",
    "& .MuiButton-startIcon": {
      marginRight: 0.5,
      marginLeft: 0,
    },
  };

  const postCardActionButtonSx = (color: string) => ({
    ...secondaryActionButtonSx,
    color,
    bgcolor: alpha(color, 0.08),
    "&:hover": {
      bgcolor: alpha(color, 0.14),
    },
  });

  const analyticsMetricButtonSx = (color: string) => ({
    textTransform: "none",
    fontWeight: 600,
    px: 1.25,
    py: 0.65,
    color,
    bgcolor: alpha(color, 0.08),
    whiteSpace: "nowrap",
    border: "0 !important",
    "&:hover": {
      bgcolor: alpha(color, 0.14),
    },
    "& .MuiButton-startIcon": {
      mr: 0.6,
      ml: 0,
    },
  });

  const analyticsMetricGroupSx = {
    display: "inline-flex",
    flexWrap: "wrap",
    gap: 1,
    "& .MuiButtonGroup-grouped": {
      border: "0 !important",
      borderRadius: "999px !important",
      mr: 0,
    },
    "& .MuiButtonGroup-grouped:not(:first-of-type)": {
      ml: 0,
    },
  };

  const profileCardHoverSx = {
    transition: "transform 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[8],
    },
  };

  const postCardHoverSx = {
    p: 2.25,
    height: "fit-content",
    transition: "transform 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[6],
    },
  };

  const getReactionMetricConfig = (key: string) => {
    if (key === "like") {
      return {
        icon: <ThumbUpAltRoundedIcon fontSize="small" />,
        color: theme.palette.success.main,
        label: "Likes",
      };
    }
    if (key === "dislike") {
      return {
        icon: <ThumbDownAltRoundedIcon fontSize="small" />,
        color: theme.palette.warning.main,
        label: "Dislikes",
      };
    }
    return {
      icon: <InsightsRoundedIcon fontSize="small" />,
      color: theme.palette.primary.main,
      label: key.charAt(0).toUpperCase() + key.slice(1),
    };
  };

  const getSentimentSeries = (sentimentBreakdown: Record<string, number>) => {
    const values = [
      sentimentBreakdown.positive || 0,
      sentimentBreakdown.neutral || 0,
      sentimentBreakdown.negative || 0,
    ];

    return {
      values,
      hasSentiments: values.some((value) => value > 0),
    };
  };

  const renderSentimentChart = (sentimentBreakdown: Record<string, number>) => {
    const sentimentSeries = getSentimentSeries(sentimentBreakdown);

    if (!sentimentSeries.hasSentiments) {
      return (
        <Box
          sx={{
            height: 340,
            display: "grid",
            placeItems: "center",
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
            No Sentiments
          </Typography>
        </Box>
      );
    }

    return (
      <BarChart
        height={340}
        xAxis={[
          {
            scaleType: "band",
            data: ["Positive", "Neutral", "Negative"],
            colorMap: {
              type: "ordinal",
              values: ["Positive", "Neutral", "Negative"],
              colors: [
                theme.palette.success.main,
                theme.palette.primary.main,
                theme.palette.warning.main,
              ],
            },
          },
        ]}
        series={[
          {
            data: sentimentSeries.values,
          },
        ]}
        borderRadius={6}
        grid={{ horizontal: true }}
        margin={{ top: 16, right: 16, bottom: 28, left: 36 }}
      />
    );
  };

  if (loading) {
    return <CenteredLoader minHeight={320} />;
  }

  if (error || !user) {
    return <Alert severity="error">{error || "Unable to load this profile."}</Alert>;
  }

  const publicInfo = [
    { label: getProfileTypeLabel(user.type) },
    user.role && normalizeAccessValue(user.role) !== "standard" ? { label: user.role } : null,
    user.type_of_business ? { label: user.type_of_business } : null,
    user.company_city ? { label: user.company_city } : null,
    user.company_country ? { label: user.company_country } : null,
    user.gender ? { label: user.gender } : null,
  ].filter(Boolean) as Array<{ label: string }>;

  return (
    <Stack spacing={3}>
      {feedbackSuccess ? <Alert severity="success">{feedbackSuccess}</Alert> : null}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate("/dashboard/directory")}
        >
          Back to people
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper
          elevation={4}
          sx={{ p: { xs: 2.5, md: 3 }, height: "100%", ...profileCardHoverSx }}
        >
          <Stack spacing={2.5} sx={{ height: "100%" }}>
            {canSwitchAccounts || canManageProfile(user) ? (
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                {canManageProfile(user) ? (
                  <Tooltip title="Manage user">
                    <IconButton
                      size="small"
                      aria-label={`Manage ${getProfileDisplayName(user)}`}
                      onClick={(event) => setProfileActionMenuAnchorEl(event.currentTarget)}
                    >
                      <MoreVertRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
                {canSwitchAccounts ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SyncAltRoundedIcon />}
                    onClick={(event) => setSwitchMenuAnchorEl(event.currentTarget)}
                    disabled={switchingAccount}
                    sx={{ borderRadius: "999px" }}
                  >
                    Switch Account
                  </Button>
                ) : null}
              </Box>
            ) : null}
            <Stack
              direction="row"
              spacing={2}
              alignItems="stretch"
              sx={{ width: "100%" }}
            >
              <UserAvatar
                username={user.username}
                fname={user.fname}
                lname={user.lname}
                profile_picture={user.profile_picture}
                sx={{
                  width: 76,
                  height: 76,
                  fontSize: "1.4rem",
                  alignSelf: "stretch",
                }}
              />
              <Stack justifyContent="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
                    >
                      <Box component="span">{getProfileDisplayName(user)}</Box>
                      <VerifiedBadge verificationStatus={user.verification_status} sx={{ fontSize: 24 }} />
                    </Box>
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    @{user.username}
                  </Typography>
                </Box>
              </Stack>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: "100%", mt: "auto" }}
            >
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {publicInfo.map((item) => (
                    <Chip
                      key={item.label}
                      label={item.label}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 700 }}
                    />
                  ))}
              </Stack>
              {canGiveFeedback ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<RateReviewRoundedIcon />}
                  onClick={openFeedbackDialog}
                  sx={{ ml: "auto", flexShrink: 0, borderRadius: "999px", textTransform: "none" }}
                >
                  Give Feedback
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      <Menu
        anchorEl={profileActionMenuAnchorEl}
        open={Boolean(profileActionMenuAnchorEl)}
        onClose={() => setProfileActionMenuAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {canManageProfile(user) ? (
          <MenuItem
            disabled={profileActionLoading}
            onClick={() => void applyUserAction("verify")}
          >
            Verify account
          </MenuItem>
        ) : null}
        {canManageProfile(user)
          ? USER_ROLE_ACTIONS.filter((item) =>
              canUseRoleActionForUser(user, item.action),
            ).map((item) => (
              <ToggleButton
                key={item.action}
                value={item.action}
                selected={isRoleSelected(user, item.role)}
                disabled={profileActionLoading}
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
                {isRoleSelected(user, item.role) ? (
                  <CheckRoundedIcon fontSize="small" sx={{ mr: 1 }} />
                ) : (
                  <Box component="span" sx={{ width: 20, mr: 1 }} />
                )}
                {item.label}
              </ToggleButton>
            ))
          : null}
        {currentUserRole === "admin" && !isOwnProfile ? (
          <MenuItem
            disabled={profileActionLoading}
            onClick={() => {
              setProfileActionMenuAnchorEl(null);
              setDeleteUserDialogOpen(true);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
            Delete user
          </MenuItem>
        ) : null}
      </Menu>
      <Dialog
        open={deleteUserDialogOpen}
        onClose={() => {
          if (!profileActionLoading) {
            setDeleteUserDialogOpen(false);
          }
        }}
        aria-labelledby="delete-profile-user-title"
        aria-describedby="delete-profile-user-description"
      >
        <DialogTitle id="delete-profile-user-title">Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-profile-user-description">
            Delete {getProfileDisplayName(user)}? This permanently removes the account and
            its related posts, feedback, and activity.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteUserDialogOpen(false)}
            disabled={profileActionLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void deleteProfileUser()}
            color="error"
            variant="contained"
            disabled={profileActionLoading}
            autoFocus
          >
            {profileActionLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Delete user"
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={switchMenuAnchorEl}
        open={Boolean(switchMenuAnchorEl)}
        onClose={() => setSwitchMenuAnchorEl(null)}
      >
        {parentAccount ? (
          <MenuItem
            onClick={() => openParentSwitchDrawer(parentAccount)}
            disabled={switchingAccount}
          >
            {parentAccount.company_name ||
              [parentAccount.fname, parentAccount.lname].filter(Boolean).join(" ") ||
              parentAccount.username}
          </MenuItem>
        ) : null}
        {childAccounts.map((account) => (
          <MenuItem
            key={account.id}
            onClick={() => void handleSwitchAccountById(account.id)}
            disabled={switchingAccount}
            >
              {account.company_name || account.username}
            </MenuItem>
          ))}
        </Menu>

        <Paper elevation={3} sx={{ p: 3, height: "100%", ...profileCardHoverSx }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
            Profile Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1.25}>
            <Typography color="text.secondary">
              {user.description || "This user has not added a public bio yet."}
            </Typography>
            {!["personal", "individual"].includes((user.type || "personal").trim().toLowerCase()) && user.company_name ? (
              <Typography color="text.secondary">
                Organization: {user.company_name}
              </Typography>
            ) : null}
            {user.company_city || user.company_country ? (
              <Typography color="text.secondary">
                Location: {[user.company_city, user.company_country].filter(Boolean).join(", ")}
              </Typography>
            ) : null}
            {user.type_of_business ? (
              <Typography color="text.secondary">
                Sector: {user.type_of_business}
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      </Box>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Posts by {getProfileDisplayName(user)}
          </Typography>
          <TextField
            label="Search posts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            sx={{ minWidth: { xs: "100%", md: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
        {postsRefreshing ? (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <CircularProgress size={22} />
          </Box>
        ) : null}
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              },
              gap: 2,
              alignItems: "start",
            }}
          >
            {posts.map((post) => (
              <Paper key={post.id} elevation={1} sx={postCardHoverSx}>
                <Stack spacing={1.5}>
                  <PostThumbnail
                    postId={post.id}
                    thumbnail={post.thumbnail}
                    postTitle={post.title}
                    sx={{ height: 188 }}
                  />
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      <ButtonBase
                        onClick={() => navigate(`/dashboard/users/${post.author.id}`)}
                        sx={{ borderRadius: "50%", p: 0.25 }}
                      >
                        <UserAvatar
                          username={post.author.username}
                          fname={post.author.fname}
                          lname={post.author.lname}
                          profile_picture={post.author.profile_picture}
                          sx={{ width: 42, height: 42 }}
                        />
                      </ButtonBase>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {post.title || `${post.author.username}'s update`}
                        </Typography>
                        <ButtonBase
                          onClick={() => navigate(`/dashboard/users/${post.author.id}`)}
                          sx={{
                            borderRadius: 2,
                            justifyContent: "flex-start",
                            textAlign: "left",
                            mt: 0.25,
                            px: 0.25,
                          }}
                        >
                          <Typography
                            color="text.secondary"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Box component="span">
                              {getPostAuthorLabel(post.author, currentUserId)}
                            </Box>
                            <VerifiedBadge
                              verificationStatus={post.author.verification_status}
                              sx={{ fontSize: 16 }}
                            />
                          </Typography>
                        </ButtonBase>
                      </Box>
                    </Stack>
                    {post.author.id === currentUserId ? (
                      <IconButton
                        size="small"
                        onClick={(event) => openPostMenu(event, post)}
                        disabled={postActionLoading}
                      >
                        <MoreVertRoundedIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Stack>

                  <Typography color="text.secondary">{post.content}</Typography>

                  {post.category ? (
                    <Chip
                      label={post.category}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                  ) : null}

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}
                  >
                    <Box component="span">{formatViewCount(post.view_count)}</Box>
                    <Box component="span">•</Box>
                    <Box component="span">
                      {formatReviewCount(post.review_count)}
                    </Box>
                    <Box component="span">•</Box>
                    <Box component="span">
                      {formatPostAge(post.date_added, post.time_added)}
                    </Box>
                  </Typography>

                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.75,
                      alignItems: "center",
                      justifyContent: "flex-start",
                      flexWrap: "nowrap",
                      overflowX: "auto",
                      pb: 0.25,
                      scrollbarWidth: "thin",
                      "&::-webkit-scrollbar": {
                        height: 6,
                      },
                      "&::-webkit-scrollbar-thumb": {
                        backgroundColor: alpha(theme.palette.text.primary, 0.18),
                        borderRadius: 999,
                      },
                    }}
                  >
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={post.viewer_reaction || null}
                      sx={reactionGroupSx}
                    >
                      <ToggleButton
                        value="like"
                        onClick={() => void handleReaction(post.id, "like")}
                        sx={reactionToggleSx("like", post.viewer_reaction === "like")}
                      >
                        <ThumbUpAltRoundedIcon fontSize="small" />
                        {post.reaction_summary.counts.like || 0}
                      </ToggleButton>
                      <ToggleButton
                        value="dislike"
                        onClick={() => void handleReaction(post.id, "dislike")}
                        sx={reactionToggleSx("dislike", post.viewer_reaction === "dislike")}
                      >
                        <ThumbDownAltRoundedIcon fontSize="small" />
                        {post.reaction_summary.counts.dislike || 0}
                      </ToggleButton>
                    </ToggleButtonGroup>
                    <Button
                      size="small"
                      startIcon={<InsightsRoundedIcon />}
                      onClick={() => void openPost(post.id)}
                      sx={postCardActionButtonSx(theme.palette.primary.main)}
                      aria-label="Analytics"
                    >
                      {null}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<ShareRoundedIcon />}
                      onClick={() => void handleSharePost(post)}
                      sx={postCardActionButtonSx(theme.palette.secondary.main)}
                      aria-label="Share"
                    >
                      {null}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<RateReviewRoundedIcon />}
                      onClick={() => void handleOpenReviewDialog(post)}
                      sx={postCardActionButtonSx(theme.palette.warning.main)}
                    >
                      Review
                    </Button>
                    <Button
                      size="small"
                      startIcon={<OpenInNewRoundedIcon />}
                      onClick={() => navigate(`/dashboard/posts/${post.id}`)}
                      sx={postCardActionButtonSx(theme.palette.text.primary)}
                    >
                      Read More
                    </Button>
                  </Box>

                </Stack>
              </Paper>
            ))}
          </Box>

          {!posts.length ? (
            <Typography color="text.secondary">
              This user has no visible posts yet.
            </Typography>
          ) : null}

          {hasMorePosts ? (
            <>
              <Box ref={loadMorePostsRef} sx={{ height: 1 }} />
              {postsLoading ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="center"
                  sx={{ py: 1 }}
                >
                  <CircularProgress size={20} />
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Paper>

      <Dialog
        open={Boolean(activePost)}
        onClose={() => setActivePost(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <InsightsRoundedIcon fontSize="small" />
            <Box component="span">
              {activePost?.title
                ? `${activePost.title} Sentiments`
                : "Post sentiments"}
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <CenteredLoader minHeight={220} />
          ) : activePost ? (
            <Stack spacing={3} sx={{ pt: 1 }}>
              <Divider />
              <Box>
                {renderSentimentChart(activePost.analytics.sentiment_breakdown)}
              </Box>
              <Divider />

              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1.5,
                  flexWrap: "wrap",
                }}
              >
                <ButtonGroup
                  size="small"
                  aria-label="post analytics summary"
                  sx={analyticsMetricGroupSx}
                >
                  <Button
                    startIcon={
                      activePost.visibility === "private" ? (
                        <VisibilityOffRoundedIcon />
                      ) : activePost.visibility === "constituency" ? (
                        <LocationOnRoundedIcon />
                      ) : (
                        <PublicRoundedIcon />
                      )
                    }
                    sx={analyticsMetricButtonSx(theme.palette.text.secondary)}
                    onClick={() => void handleToggleActivePostVisibility()}
                    disabled={
                      postActionLoading || activePost.author.id !== currentUserId
                    }
                  >
                    {getPostVisibilityLabel(activePost.visibility)}
                  </Button>
                  <Button
                    startIcon={<RateReviewRoundedIcon />}
                    sx={analyticsMetricButtonSx(theme.palette.primary.main)}
                  >
                    Reviews {activePost.analytics.total_reviews}
                  </Button>
                  {Object.entries(activePost.analytics.reactions)
                  .filter(
                    ([key, value]) =>
                      (["like", "dislike"].includes(key) || value > 0) &&
                      !["insightful", "support", "love", "celebrate"].includes(key),
                  )
                    .sort(([leftKey], [rightKey]) => {
                      const order = ["like", "dislike"];
                      const leftIndex = order.indexOf(leftKey);
                      const rightIndex = order.indexOf(rightKey);
                      if (leftIndex === -1 && rightIndex === -1) {
                        return leftKey.localeCompare(rightKey);
                      }
                      if (leftIndex === -1) {
                        return 1;
                      }
                      if (rightIndex === -1) {
                        return -1;
                      }
                      return leftIndex - rightIndex;
                    })
                    .map(([key, value]) => {
                      const config = getReactionMetricConfig(key);
                      return (
                        <Button
                          key={key}
                          startIcon={config.icon}
                          sx={analyticsMetricButtonSx(config.color)}
                        >
                          {config.label} {value}
                        </Button>
                      );
                    })}
                </ButtonGroup>
                <Button
                  color="warning"
                  variant="outlined"
                  onClick={() => setActivePost(null)}
                  sx={{ borderRadius: "999px", minWidth: 120, ml: "auto" }}
                >
                  Close
                </Button>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      <Menu
        anchorEl={postMenuAnchorEl}
        open={Boolean(postMenuAnchorEl)}
        onClose={closePostMenu}
      >
        <MenuItem onClick={handleOpenEditDialog}>
          <EditRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => void handleHidePost()}>
          <VisibilityOffRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          Hide
        </MenuItem>
        <MenuItem onClick={() => void handleDeletePost()}>
          <DeleteOutlineRoundedIcon fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      <Drawer
        anchor="right"
        open={parentSwitchDrawerOpen}
        onClose={() => setParentSwitchDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 460 },
            p: 3,
          },
        }}
      >
        <Stack spacing={2.5} sx={{ height: "100%", overflowY: "auto", pr: 0.5 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Switch Account
            </Typography>
            <IconButton onClick={() => setParentSwitchDrawerOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Stack>
          <Typography color="text.secondary">
            Enter the parent account credentials to switch back to that account.
          </Typography>
          <Divider />
          <Box component="form" onSubmit={handleParentSwitchSubmit}>
            <Stack spacing={2}>
              {parentSwitchError ? <Alert severity="error">{parentSwitchError}</Alert> : null}
              <TextField
                label="Parent email or mobile number"
                size="small"
                value={parentSwitchForm.email_or_mobile_number}
                onChange={(event) =>
                  setParentSwitchForm((current) => ({
                    ...current,
                    email_or_mobile_number: event.target.value,
                  }))
                }
                error={Boolean(parentSwitchSubmitted && getParentSwitchIdentifierError())}
                helperText={
                  parentSwitchSubmitted ? getParentSwitchIdentifierError() : ""
                }
                fullWidth
              />
              <TextField
                label="Password"
                size="small"
                type={parentSwitchShowPassword ? "text" : "password"}
                value={parentSwitchForm.password}
                onChange={(event) =>
                  setParentSwitchForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                error={Boolean(parentSwitchSubmitted && getParentSwitchPasswordError())}
                helperText={
                  parentSwitchSubmitted ? getParentSwitchPasswordError() : ""
                }
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() =>
                          setParentSwitchShowPassword((current) => !current)
                        }
                        edge="end"
                      >
                        {parentSwitchShowPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Divider sx={{ mt: 1, mb: 0.5 }} />
              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button onClick={() => setParentSwitchDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={switchingAccount}
                >
                  {switchingAccount ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    "Switch account"
                  )}
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Drawer>

      <PostReviewDialog
        open={Boolean(reviewDialogPost)}
        postTitle={reviewDialogPost?.title}
        value={reviewDraft}
        onChange={(value) => {
          setReviewDraft(value);
          if (reviewError) {
            setReviewError("");
          }
          if (reviewSuccess) {
            setReviewSuccess("");
          }
        }}
        onClose={() => {
          setReviewDialogPost(null);
          setReviewSource({
            district_id: defaultSource.district_id,
            constituency_id: defaultSource.constituency_id,
            subcounty_id: defaultSource.subcounty_id,
            parish_id: defaultSource.parish_id,
          });
          setReviewError("");
          setReviewSuccess("");
        }}
        onSubmit={handleReview}
        loading={reviewSubmitting}
        hasReviewed={reviewDialogPost?.viewer_has_reviewed}
        error={reviewError}
        success={reviewSuccess}
        source={reviewSource}
        onSourceChange={handleReviewSourceChange}
      />
      <SharePostDialog
        open={Boolean(shareDialogPost)}
        onClose={() => setShareDialogPost(null)}
        title={
          shareDialogPost?.title ||
          `${user ? getProfileDisplayName(user) : "Shared"}'s post`
        }
        content={shareDialogPost?.content}
        shareUrl={
          shareDialogPost
            ? `${window.location.origin}${
                shareDialogPost.visibility === "private" && shareDialogPost.share_url
                  ? shareDialogPost.share_url
                  : `/shared-post/${shareDialogPost.id}`
              }`
            : null
        }
      />

      <Dialog
        open={editDialogOpen}
        onClose={() => {
          if (!postActionLoading) {
            setEditDialogOpen(false);
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
        >
          Edit post
          <IconButton
            onClick={() => setEditDialogOpen(false)}
            disabled={postActionLoading}
            size="small"
            aria-label="Close edit post dialog"
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editPostError ? <Alert severity="error">{editPostError}</Alert> : null}
            <TextField
              label="Post title"
              value={editPostDraft.title}
              onChange={(event) =>
                setEditPostDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              size="small"
              error={Boolean(editPostSubmitted && getEditPostTitleError())}
              helperText={editPostSubmitted ? getEditPostTitleError() : ""}
              fullWidth
            />
            <TextField
              label="Post content"
              value={editPostDraft.content}
              onChange={(event) =>
                setEditPostDraft((current) => ({
                  ...current,
                  content: event.target.value,
                }))
              }
              multiline
              minRows={4}
              error={Boolean(editPostSubmitted && getEditPostContentError())}
              helperText={editPostSubmitted ? getEditPostContentError() : ""}
              fullWidth
            />
            <PostCategoryAutocomplete
              value={editPostDraft.category}
              size="small"
              onChange={(value) =>
                setEditPostDraft((current) => ({
                  ...current,
                  category: value,
                }))
              }
            />
            <TextField
              select
              label="Visibility"
              value={editPostDraft.visibility}
              onChange={(event) =>
                setEditPostDraft((current) => ({
                  ...current,
                  visibility: event.target.value,
                }))
              }
              size="small"
              fullWidth
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="constituency">My constituency</MenuItem>
              <MenuItem value="private">Private via share link</MenuItem>
            </TextField>
            <ReviewSourceFields
              value={editPostDraft}
              onChange={handleEditPostSourceChange}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
              <Button
                onClick={() => setEditDialogOpen(false)}
                disabled={postActionLoading}
                sx={{ borderRadius: "999px" }}
              >
                Close
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleEditPost()}
                disabled={postActionLoading}
                sx={{ borderRadius: "999px" }}
              >
                {postActionLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  "Save changes"
                )}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
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
          Give Feedback to {getProfileDisplayName(user)}
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

export default UserPublicProfilePage;
