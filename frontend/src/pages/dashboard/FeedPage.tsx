import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BarChart } from "@mui/x-charts/BarChart";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormHelperText,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";

import { api } from "../../lib/api";
import CenteredLoader from "../../components/CenteredLoader";
import PostThumbnail from "../../components/PostThumbnail";
import PostReviewDialog from "../../components/PostReviewDialog";
import ReviewSourceFields from "../../components/ReviewSourceFields";
import SharePostDialog from "../../components/SharePostDialog";
import PostCategoryAutocomplete from "../../components/PostCategoryAutocomplete";
import UserAvatar from "../../components/UserAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getStoredUser } from "../../lib/session";
import {
  formatPostAge,
  formatReviewCount,
  formatViewCount,
} from "../../lib/postDisplay";

type PostRecord = {
  id: number;
  title?: string | null;
  content: string;
  category?: string | null;
  visibility: string;
  thumbnail?: string | null;
  share_url?: string | null;
  attachment?: string | null;
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

type PostDetail = PostRecord & {
  analytics: {
    total_reviews: number;
    total_reactions: number;
    reactions: Record<string, number>;
    sentiment_breakdown: Record<string, number>;
  };
};

const POSTS_PAGE_SIZE = 12;
const POST_CREATOR_ROLES = new Set(["admin", "mp", "parliament", "constituency"]);
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf"];
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

const getUserDisplayName = (user: {
  username: string;
  fname?: string | null;
  lname?: string | null;
}) => [user.fname, user.lname].filter(Boolean).join(" ") || user.username;

const getPostAuthorLabel = (
  author: {
    id: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    verification_status?: string | null;
  },
  currentUserId?: number | null,
) => (author.id === currentUserId ? "By you" : getUserDisplayName(author));

const FeedPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const currentUserRole = (currentUser?.role || "").trim().toLowerCase();
  const canCreatePosts = POST_CREATOR_ROLES.has(currentUserRole);
  const defaultSource = {
    district_id: currentUser?.district_id ?? null,
    constituency_id: currentUser?.constituency_id ?? null,
    subcounty_id: currentUser?.subcounty_id ?? null,
    parish_id: currentUser?.parish_id ?? null,
  };
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [postsTab, setPostsTab] = useState<
    "public" | "featured" | "latest" | "own"
  >("public");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activePost, setActivePost] = useState<PostDetail | null>(null);
  const [reviewDialogPost, setReviewDialogPost] = useState<PostRecord | null>(
    null,
  );
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
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [postFormError, setPostFormError] = useState("");
  const [postFormSuccess, setPostFormSuccess] = useState("");
  const [postFormSubmitted, setPostFormSubmitted] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    category: "",
    visibility: "public",
    district_id: defaultSource.district_id,
    constituency_id: defaultSource.constituency_id,
    subcounty_id: defaultSource.subcounty_id,
    parish_id: defaultSource.parish_id,
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [thumbnailError, setThumbnailError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [isThumbnailDragActive, setIsThumbnailDragActive] = useState(false);
  const [isAttachmentDragActive, setIsAttachmentDragActive] = useState(false);
  const [postMenuAnchorEl, setPostMenuAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const [selectedPost, setSelectedPost] = useState<PostRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPostDraft, setEditPostDraft] = useState({
    id: 0,
    title: "",
    content: "",
    category: "",
    visibility: "public",
    district_id: null as number | null,
    constituency_id: null as number | null,
    subcounty_id: null as number | null,
    parish_id: null as number | null,
  });
  const [editPostSubmitted, setEditPostSubmitted] = useState(false);
  const [editPostError, setEditPostError] = useState("");
  const [postActionLoading, setPostActionLoading] = useState(false);
  const [shareDialogPost, setShareDialogPost] = useState<PostRecord | null>(
    null,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const params = useMemo(() => {
    const scope = postsTab === "own" ? "own" : "visible";
    const sort =
      postsTab === "featured"
        ? "featured"
        : postsTab === "latest"
          ? "latest"
          : "default";

    return {
      viewer_user_id: currentUserId,
      q: deferredSearch || undefined,
      scope,
      sort,
    };
  }, [currentUserId, deferredSearch, postsTab]);

  const loadPosts = async ({ reset = false }: { reset?: boolean } = {}) => {
    if (!currentUser) {
      return;
    }

    const nextOffset = reset ? 0 : offset;
    if (reset) {
      if (posts.length) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await api.get<PostRecord[]>("/posts", {
        params: {
          ...params,
          limit: POSTS_PAGE_SIZE,
          offset: nextOffset,
        },
      });
      setPosts((current) =>
        reset ? response.data : [...current, ...response.data],
      );
      setOffset(nextOffset + response.data.length);
      setHasMore(response.data.length === POSTS_PAGE_SIZE);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!currentUserId) {
        return;
      }
      try {
        setError("");
        setOffset(0);
        await loadPosts({ reset: true });
      } catch {
        setError("Unable to load the feed right now.");
      }
    };

    void load();
  }, [currentUserId, deferredSearch, postsTab]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loading || refreshing || loadingMore) {
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
  }, [hasMore, loading, refreshing, loadingMore, offset, currentUserId, deferredSearch, postsTab]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [thumbnailFile]);

  const openPost = async (postId: number) => {
    if (!currentUser) {
      return;
    }
    setDetailLoading(true);
    try {
      const response = await api.get<PostDetail>(`/posts/${postId}`, {
        params: {
          viewer_user_id: currentUser.id,
        },
      });
      setActivePost(response.data);
    } catch {
      setError("Unable to load post details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreatePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      return;
    }
    if (!canCreatePosts) {
      setPostFormError("Only MPs, Parliament, Constituency, and Admin accounts can create posts.");
      return;
    }
    setPostFormSubmitted(true);
    if (
      getPostTitleError() ||
      getPostContentError() ||
      thumbnailError ||
      attachmentError
    ) {
      return;
    }

    try {
      setPostFormError("");
      setPostFormSuccess("");
      setSubmittingPost(true);
      const formData = new FormData();
      formData.append("author_user_id", String(currentUser.id));
      formData.append("title", newPost.title.trim());
      formData.append("content", newPost.content);
      formData.append("category", newPost.category.trim());
      formData.append("visibility", newPost.visibility);
      if (newPost.district_id) {
        formData.append("district_id", String(newPost.district_id));
      }
      if (newPost.constituency_id) {
        formData.append("constituency_id", String(newPost.constituency_id));
      }
      if (newPost.subcounty_id) {
        formData.append("subcounty_id", String(newPost.subcounty_id));
      }
      if (newPost.parish_id) {
        formData.append("parish_id", String(newPost.parish_id));
      }
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
      }
      if (attachmentFile) {
        formData.append("attachment", attachmentFile);
      }

      await api.post("/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setNewPost({
        title: "",
        content: "",
        category: "",
        visibility: "public",
        district_id: currentUser?.district_id ?? null,
        constituency_id: currentUser?.constituency_id ?? null,
        subcounty_id: currentUser?.subcounty_id ?? null,
        parish_id: currentUser?.parish_id ?? null,
      });
      setThumbnailFile(null);
      setAttachmentFile(null);
      setThumbnailError("");
      setAttachmentError("");
      setPostFormSubmitted(false);
      setPostFormSuccess("Post published successfully.");
      setOffset(0);
      await loadPosts({ reset: true });
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      if (
        typeof detail === "string" &&
        detail.toLowerCase().includes("unsupported file type")
      ) {
        setAttachmentError("Only PDF files are allowed as post attachments.");
      }
      setPostFormError(
        typeof detail === "string" ? detail : "Unable to publish this post.",
      );
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleReaction = async (postId: number, reactionType: string) => {
    if (!currentUser) {
      return;
    }

    await recordInteractionView(postId);
    await api.post(`/posts/${postId}/reactions`, {
      user_id: currentUser.id,
      reaction_type: reactionType,
    });
    setOffset(0);
    await loadPosts({ reset: true });
    if (activePost?.id === postId) {
      await openPost(postId);
    }
  };

  const recordInteractionView = async (postId: number) => {
    if (!currentUser) {
      return;
    }

    try {
      const response = await api.post<{ view_count: number; counted: boolean }>(
        `/posts/${postId}/interaction-view`,
        null,
        {
          params: {
            viewer_user_id: currentUser.id,
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

  const handleOpenReviewDialog = (post: PostRecord) => {
    void recordInteractionView(post.id);
    setReviewDialogPost(post);
    setReviewDraft("");
    setReviewSource({
      district_id: currentUser?.district_id ?? null,
      constituency_id: currentUser?.constituency_id ?? null,
      subcounty_id: currentUser?.subcounty_id ?? null,
      parish_id: currentUser?.parish_id ?? null,
    });
    setReviewError("");
    setReviewSuccess("");
  };

  const handleReview = async () => {
    const sourcePost = reviewDialogPost;
    if (sourcePost?.viewer_has_reviewed) {
      setReviewSuccess("");
      setReviewError("You can only review once on a post.");
      return;
    }
    if (!currentUser || !sourcePost || !reviewDraft.trim()) {
      setReviewSuccess("");
      setReviewError("Review is required.");
      return;
    }

    setReviewSubmitting(true);
    try {
      setReviewError("");
      setReviewSuccess("");
      await api.post(`/posts/${sourcePost.id}/reviews`, {
        author_user_id: currentUser.id,
        content: reviewDraft.trim(),
        district_id: reviewSource.district_id,
        constituency_id: reviewSource.constituency_id,
        subcounty_id: reviewSource.subcounty_id,
        parish_id: reviewSource.parish_id,
      });
      setReviewDraft(reviewDraft.trim());
      setReviewDialogPost({ ...sourcePost, viewer_has_reviewed: true });
      setReviewSuccess("Your review has been submitted successfully.");
      setPosts((current) =>
        current.map((post) =>
          post.id === sourcePost.id
            ? {
                ...post,
                review_count: post.review_count + 1,
                viewer_has_reviewed: true,
              }
            : post,
        ),
      );
      if (activePost?.id === sourcePost.id) {
        await openPost(sourcePost.id);
      }
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setReviewSuccess("");
      setReviewError(
        typeof detail === "string" ? detail : "Unable to add review.",
      );
    } finally {
      setReviewSubmitting(false);
    }
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

  const handleNewPostSourceChange = (source: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => {
    setNewPost((current) => ({
      ...current,
      district_id: source.district_id ?? null,
      constituency_id: source.constituency_id ?? null,
      subcounty_id: source.subcounty_id ?? null,
      parish_id: source.parish_id ?? null,
    }));
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

  const reactionToggleSx = (
    reactionType: "like" | "dislike",
    active: boolean,
  ) => {
    const paletteColor =
      reactionType === "like"
        ? theme.palette.success.main
        : theme.palette.error.main;

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

  const postCardHoverSx = {
    p: 2.5,
    borderRadius: 2,
    height: "fit-content",
    transition: "transform 180ms ease, box-shadow 180ms ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[8],
    },
  };

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

  const handleSharePost = (post: PostRecord) => {
    void recordInteractionView(post.id);
    setShareDialogPost(post);
  };

  const closePostMenu = () => {
    setPostMenuAnchorEl(null);
    setSelectedPost(null);
  };

  const openPostMenu = (
    event: React.MouseEvent<HTMLElement>,
    post: PostRecord,
  ) => {
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

  const refreshPostCollection = async () => {
    setOffset(0);
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
      district_id: selectedPost.district_id ?? null,
      constituency_id: selectedPost.constituency_id ?? null,
      subcounty_id: selectedPost.subcounty_id ?? null,
      parish_id: selectedPost.parish_id ?? null,
    });
    setEditPostError("");
    setEditPostSubmitted(false);
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
      await refreshPostCollection();
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
      if (activePost?.id === postId && postsTab !== "own") {
        setActivePost(null);
      }
      await refreshPostCollection();
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Unable to hide this post.",
      );
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
      await refreshPostCollection();
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
    if (
      !currentUserId ||
      !activePost ||
      activePost.author.id !== currentUserId
    ) {
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
      setPosts((current) => {
        if (nextVisibility === "private" && postsTab !== "own") {
          return current.filter((post) => post.id !== activePostId);
        }

        return current.map((post) =>
          post.id === activePostId
            ? {
                ...post,
                visibility: nextVisibility,
              }
            : post,
        );
      });
      if (nextVisibility === "private" && postsTab !== "own") {
        setActivePost(null);
      }
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

  const handleThumbnailChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setThumbnailFile(null);
      setThumbnailError("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setThumbnailError("Only image files are allowed for the post thumbnail.");
      event.target.value = "";
      return;
    }

    setThumbnailError("");
    setThumbnailFile(file);
  };

  const handleThumbnailDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsThumbnailDragActive(false);

    const file = event.dataTransfer.files?.[0] || null;
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setThumbnailError("Only image files are allowed for the post thumbnail.");
      return;
    }

    setThumbnailError("");
    setThumbnailFile(file);
  };

  const handleAttachmentChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setAttachmentFile(null);
      setAttachmentError("");
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_ATTACHMENT_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!isAllowed) {
      setAttachmentError("Only PDF files are allowed as post attachments.");
      event.target.value = "";
      return;
    }

    setAttachmentError("");
    setAttachmentFile(file);
  };

  const handleAttachmentDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsAttachmentDragActive(false);

    const file = event.dataTransfer.files?.[0] || null;
    if (!file) {
      return;
    }

    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_ATTACHMENT_EXTENSIONS.some((extension) =>
      lowerName.endsWith(extension),
    );

    if (!isAllowed) {
      setAttachmentError("Only PDF files are allowed as post attachments.");
      return;
    }

    setAttachmentError("");
    setAttachmentFile(file);
  };

  const getPostTitleError = () => {
    if (!newPost.title.trim()) {
      return "Post title is required.";
    }
    if (newPost.title.trim().length > 120) {
      return "Keep the title under 120 characters.";
    }
    return "";
  };

  const getPostContentError = () => {
    if (!newPost.content.trim()) {
      return "Post content is required.";
    }
    if (newPost.content.trim().length < 10) {
      return "Write at least 10 characters.";
    }
    return "";
  };

  const renderPostComposer = () => (
    <Box component="form" onSubmit={handleCreatePost}>
      <Stack spacing={2}>
        {postFormError ? <Alert severity="error">{postFormError}</Alert> : null}
        {postFormSuccess ? (
          <Alert severity="success">{postFormSuccess}</Alert>
        ) : null}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 1.6fr) minmax(220px, 0.8fr)",
            },
            gap: 2,
          }}
        >
          <TextField
            label="Post title"
            value={newPost.title}
            onChange={(event) =>
              setNewPost((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            required
            error={Boolean(postFormSubmitted && getPostTitleError())}
            helperText={postFormSubmitted ? getPostTitleError() : ""}
          />
          <TextField
            select
            label="Visibility"
            value={newPost.visibility}
            onChange={(event) =>
              setNewPost((current) => ({
                ...current,
                visibility: event.target.value,
              }))
            }
            fullWidth
          >
            <MenuItem value="public">Public</MenuItem>
            <MenuItem value="constituency">My constituency</MenuItem>
            <MenuItem value="private">Private via share link</MenuItem>
          </TextField>
        </Box>
        <PostCategoryAutocomplete
          value={newPost.category}
          onChange={(value) =>
            setNewPost((current) => ({
              ...current,
              category: value,
            }))
          }
        />
        <TextField
          label="What would you like to share?"
          value={newPost.content}
          onChange={(event) =>
            setNewPost((current) => ({
              ...current,
              content: event.target.value,
            }))
          }
          required
          multiline
          minRows={4}
          error={Boolean(postFormSubmitted && getPostContentError())}
          helperText={postFormSubmitted ? getPostContentError() : ""}
        />
        <ReviewSourceFields
          value={newPost}
          onChange={handleNewPostSourceChange}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(2, minmax(0, 1fr))",
            },
            gap: 2,
            alignItems: "start",
          }}
        >
          <Stack spacing={0.75}>
            <Box
              component="label"
              onDragOver={(event: React.DragEvent<HTMLLabelElement>) => {
                event.preventDefault();
                setIsThumbnailDragActive(true);
              }}
              onDragLeave={() => setIsThumbnailDragActive(false)}
              onDrop={handleThumbnailDrop}
              sx={{
                display: "block",
                border: `1px dashed ${
                  isThumbnailDragActive
                    ? theme.palette.primary.main
                    : alpha(theme.palette.text.primary, 0.18)
                }`,
                borderRadius: 2.5,
                p: 1.5,
                minHeight: 176,
                cursor: "pointer",
                bgcolor: isThumbnailDragActive
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.02),
                transition:
                  "background-color 160ms ease, border-color 160ms ease",
              }}
            >
              <input
                ref={thumbnailInputRef}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleThumbnailChange}
              />
              <Stack spacing={1.5} alignItems="center" textAlign="center">
                {thumbnailPreviewUrl ? (
                  <Box
                    component="img"
                    src={thumbnailPreviewUrl}
                    alt="Thumbnail preview"
                    sx={{
                      width: "100%",
                      maxWidth: 180,
                      height: 104,
                      objectFit: "cover",
                      borderRadius: 2,
                      boxShadow: theme.shadows[2],
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: "primary.main",
                    }}
                  >
                    <CloudUploadRoundedIcon />
                  </Box>
                )}
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {thumbnailFile ? "Change thumbnail" : "Drop thumbnail here"}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem" }}
                  >
                    {thumbnailFile
                      ? thumbnailFile.name
                      : "Drag and drop an image, or click to browse"}
                  </Typography>
                </Stack>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={<ImageRoundedIcon />}
                  onClick={(event) => {
                    event.preventDefault();
                    if (thumbnailInputRef.current) {
                      thumbnailInputRef.current.value = "";
                      thumbnailInputRef.current.click();
                    }
                  }}
                  sx={{ borderRadius: "999px" }}
                >
                  Choose image
                </Button>
              </Stack>
            </Box>
            {postFormSubmitted && thumbnailError ? (
              <FormHelperText error sx={{ mt: 0, mx: 0 }}>
                {thumbnailError}
              </FormHelperText>
            ) : null}
          </Stack>
          <Stack spacing={0.75}>
            <Box
              component="label"
              onDragOver={(event: React.DragEvent<HTMLLabelElement>) => {
                event.preventDefault();
                setIsAttachmentDragActive(true);
              }}
              onDragLeave={() => setIsAttachmentDragActive(false)}
              onDrop={handleAttachmentDrop}
              sx={{
                display: "block",
                border: `1px dashed ${
                  isAttachmentDragActive
                    ? theme.palette.primary.main
                    : alpha(theme.palette.text.primary, 0.18)
                }`,
                borderRadius: 2.5,
                p: 1.5,
                minHeight: 176,
                cursor: "pointer",
                bgcolor: isAttachmentDragActive
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.primary.main, 0.02),
                transition:
                  "background-color 160ms ease, border-color 160ms ease",
              }}
            >
              <input
                ref={attachmentInputRef}
                hidden
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleAttachmentChange}
              />
              <Stack spacing={1.5} alignItems="center" textAlign="center">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: "primary.main",
                  }}
                >
                  <AttachFileRoundedIcon />
                </Box>
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {attachmentFile
                      ? "Change attachment"
                      : "Drop attachment here"}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontSize: "0.85rem" }}
                  >
                    {attachmentFile
                      ? attachmentFile.name
                      : "Drag a PDF file here, or click to browse"}
                  </Typography>
                </Stack>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  startIcon={<AttachFileRoundedIcon />}
                  onClick={(event) => {
                    event.preventDefault();
                    if (attachmentInputRef.current) {
                      attachmentInputRef.current.value = "";
                      attachmentInputRef.current.click();
                    }
                  }}
                  sx={{ borderRadius: "999px" }}
                >
                  Choose file
                </Button>
              </Stack>
            </Box>
            {postFormSubmitted && attachmentError ? (
              <FormHelperText error sx={{ mt: 0, mx: 0 }}>
                {attachmentError}
              </FormHelperText>
            ) : null}
          </Stack>
        </Box>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Typography color="text.secondary" sx={{ fontSize: "0.9rem" }}>
            Add a thumbnail and an optional PDF to give your post more context.
          </Typography>
          <Button
            type="submit"
            variant="contained"
            sx={{
              px: 3,
              minWidth: 180,
              alignSelf: { xs: "stretch", md: "auto" },
            }}
            disabled={submittingPost}
          >
            {submittingPost ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Publish"
            )}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );

  return (
    <Stack spacing={3}>
      {error ? <Alert severity="error">{error}</Alert> : null}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Posts for review
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {postsTab === "public"
                ? "Review public posts shared across the system."
                : postsTab === "featured"
                  ? "Review the most engaged public posts."
                  : postsTab === "latest"
                    ? "Review the newest public posts."
                    : "Review the posts you have published."}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            {canCreatePosts ? (
              <Button
                variant="outlined"
                startIcon={<AddRoundedIcon />}
                onClick={() => {
                  setPostFormError("");
                  setPostFormSuccess("");
                  setPostFormSubmitted(false);
                  setThumbnailError("");
                  setAttachmentError("");
                  setPostDrawerOpen(true);
                }}
                sx={{ borderRadius: "999px", whiteSpace: "nowrap" }}
              >
                Create Post
              </Button>
            ) : null}
            <TextField
              label="Search by title, description, or author"
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
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Tabs
          value={postsTab}
          onChange={(_, value: "public" | "featured" | "latest" | "own") => {
            setPostsTab(value);
            setOffset(0);
          }}
          sx={{ mb: 2 }}
        >
          <Tab label="All" value="public" />
          <Tab label="Featured" value="featured" />
          <Tab label="Latest" value="latest" />
          <Tab label="By you" value="own" />
        </Tabs>

        {refreshing ? (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : null}

        {loading && !posts.length ? (
          <CenteredLoader minHeight={260} />
        ) : (
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, 1fr)",
                  xl: "repeat(3, 1fr)",
                },
                gap: 2,
                alignItems: "start",
              }}
            >
              {posts.map((post) => (
                <Paper key={post.id} elevation={2} sx={postCardHoverSx}>
                  <Stack spacing={1.5}>
                    <PostThumbnail
                      postId={post.id}
                      thumbnail={post.thumbnail}
                      postTitle={post.title}
                      sx={{ height: 188 }}
                    />
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      spacing={1.5}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        <ButtonBase
                          onClick={() =>
                            navigate(`/dashboard/users/${post.author.id}`)
                          }
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
                            onClick={() =>
                              navigate(`/dashboard/users/${post.author.id}`)
                            }
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
                          sx={{
                            alignSelf: { xs: "flex-end", md: "flex-start" },
                          }}
                        >
                          <MoreVertRoundedIcon fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Stack>

                    <Typography
                      sx={{
                        color: "text.secondary",
                        lineHeight: 1.7,
                        textAlign: "justify",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {post.content}
                    </Typography>

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
                      <Box component="span">
                        {formatViewCount(post.view_count)}
                      </Box>
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
                          backgroundColor: alpha(
                            theme.palette.text.primary,
                            0.18,
                          ),
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
                          sx={reactionToggleSx(
                            "like",
                            post.viewer_reaction === "like",
                          )}
                        >
                          <ThumbUpAltRoundedIcon fontSize="small" />
                          {post.reaction_summary.counts.like || 0}
                        </ToggleButton>
                        <ToggleButton
                          value="dislike"
                          onClick={() =>
                            void handleReaction(post.id, "dislike")
                          }
                          sx={reactionToggleSx(
                            "dislike",
                            post.viewer_reaction === "dislike",
                          )}
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
                        onClick={() => handleOpenReviewDialog(post)}
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
            {hasMore ? (
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
            {!posts.length ? (
              <Typography
                color="text.secondary"
                sx={{ textAlign: "center", py: 4 }}
              >
                No posts match your current search.
              </Typography>
            ) : null}
          </Stack>
        )}
      </Paper>

      <Dialog
        open={Boolean(activePost)}
        onClose={() => {
          setActivePost(null);
        }}
        maxWidth="md"
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
                      postActionLoading ||
                      activePost.author.id !== currentUserId
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
                        !["insightful", "support", "love"].includes(key),
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

      <Dialog
        open={editDialogOpen}
        onClose={() => {
          if (!postActionLoading) {
            setEditDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
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
            {editPostError ? (
              <Alert severity="error">{editPostError}</Alert>
            ) : null}
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
          `${shareDialogPost ? getUserDisplayName(shareDialogPost.author) : "Shared"}'s post`
        }
        content={shareDialogPost?.content}
        shareUrl={
          shareDialogPost
            ? `${window.location.origin}${
                shareDialogPost.visibility === "private" &&
                shareDialogPost.share_url
                  ? shareDialogPost.share_url
                  : `/shared-post/${shareDialogPost.id}`
              }`
            : null
        }
      />

      <Drawer
        anchor="right"
        open={postDrawerOpen}
        onClose={() => {
          if (!submittingPost) {
            setPostDrawerOpen(false);
          }
        }}
        sx={{
          zIndex: theme.zIndex.drawer + 10,
        }}
        ModalProps={{
          keepMounted: true,
          sx: {
            zIndex: theme.zIndex.drawer + 10,
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 520, lg: 580 },
            p: 3,
            zIndex: theme.zIndex.drawer + 10,
          },
        }}
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Publish Post for Review
            </Typography>
          </Box>
          <Divider />
          {renderPostComposer()}
        </Stack>
      </Drawer>
    </Stack>
  );
};

export default FeedPage;
