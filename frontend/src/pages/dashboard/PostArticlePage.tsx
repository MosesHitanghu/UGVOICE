import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import RateReviewRoundedIcon from "@mui/icons-material/RateReviewRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ThumbDownAltRoundedIcon from "@mui/icons-material/ThumbDownAltRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import WestRoundedIcon from "@mui/icons-material/WestRounded";

import { api } from "../../lib/api";
import PdfViewerDialog from "../../components/PdfViewerDialog";
import PostReviewDialog from "../../components/PostReviewDialog";
import PostThumbnail from "../../components/PostThumbnail";
import SharePostDialog from "../../components/SharePostDialog";
import SharedPostLoginDialog from "../../components/SharedPostLoginDialog";
import UserAvatar from "../../components/UserAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getOrCreateViewerKey, getStoredUser, storeUser } from "../../lib/session";
import {
  formatPostAge,
  formatReviewCount,
  formatViewCount,
} from "../../lib/postDisplay";

type PostReview = {
  id: number;
  content: string;
  date_added?: string | null;
  time_added?: string | null;
  district_id?: number | null;
  constituency_id?: number | null;
  subcounty_id?: number | null;
  parish_id?: number | null;
  is_edited?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  author: {
    id?: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    profile_picture?: string | null;
    verification_status?: string | null;
  };
};

type PostArticle = {
  id: number;
  title?: string | null;
  content: string;
  category?: string | null;
  visibility: string;
  thumbnail?: string | null;
  attachment?: string | null;
  share_url?: string | null;
  date_added?: string | null;
  time_added?: string | null;
  view_count?: number;
  review_count: number;
  viewer_has_reviewed?: boolean;
  viewer_reaction?: string | null;
  reaction_summary: {
    total: number;
    counts: Record<string, number>;
  };
  author: {
    id: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    profile_picture?: string | null;
    verification_status?: string | null;
  };
  reviews: PostReview[];
};

const getUserDisplayName = (user: {
  username: string;
  fname?: string | null;
  lname?: string | null;
}) => [user.fname, user.lname].filter(Boolean).join(" ") || user.username;

const REVIEW_EDIT_WINDOW_MS = 60 * 60 * 1000;

const canManageReviewInUi = (review: PostReview, now: number) => {
  if (!review.date_added || !review.time_added) {
    return false;
  }

  const createdAt = new Date(`${review.date_added}T${review.time_added}`);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return now - createdAt.getTime() <= REVIEW_EDIT_WINDOW_MS;
};

const getReviewSource = (review: PostReview) => ({
  district_id: review.district_id || null,
  constituency_id: review.constituency_id || null,
  subcounty_id: review.subcounty_id || null,
  parish_id: review.parish_id || null,
});

const PostArticlePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const [sessionUser, setSessionUser] = useState(() => getStoredUser());
  const currentUserId = sessionUser?.id;
  const sharedToken = searchParams.get("token") || undefined;
  const isSharedRoute = location.pathname.startsWith("/shared-post/");
  const [post, setPost] = useState<PostArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const defaultSource = {
    district_id: sessionUser?.district_id ?? null,
    constituency_id: sessionUser?.constituency_id ?? null,
    subcounty_id: sessionUser?.subcounty_id ?? null,
    parish_id: sessionUser?.parish_id ?? null,
  };
  const [reviewSource, setReviewSource] = useState({
    district_id: defaultSource.district_id,
    constituency_id: defaultSource.constituency_id,
    subcounty_id: defaultSource.subcounty_id,
    parish_id: defaultSource.parish_id,
  });
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [reviewActionNow, setReviewActionNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setReviewActionNow(Date.now());
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const reactionToggleSx = (
    reactionType: "like" | "dislike",
    active: boolean,
  ) => {
    const paletteColor = reactionType === "like" ? "#2e7d32" : "#d32f2f";

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
      color: active ? "#fff" : paletteColor,
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
    bgcolor: alpha("#111827", 0.04),
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
    textTransform: "none",
    "& .MuiButton-startIcon": {
      marginRight: 0.5,
      marginLeft: 0,
    },
  };

  const loadPost = async (postIdToLoad: string, viewerId: number) => {
    const response = await api.get<PostArticle>(`/posts/${postIdToLoad}`, {
      params: {
        viewer_user_id: viewerId,
        shared_token: sharedToken,
        review_limit: 100,
        review_offset: 0,
      },
    });
    setPost(response.data);
  };

  useEffect(() => {
    const loadPostData = async () => {
      if (isSharedRoute && !currentUserId) {
        setLoading(false);
        setError("");
        return;
      }
      if (!postId || !currentUserId) {
        setLoading(false);
        setError("Unable to open this article.");
        return;
      }

      try {
        setError("");
        await loadPost(postId, currentUserId);
        try {
          const viewResponse = await api.post<{ view_count: number; counted: boolean }>(
            `/posts/${postId}/views`,
            null,
            {
              params: {
                viewer_user_id: currentUserId,
                viewer_key: getOrCreateViewerKey(),
                shared_token: sharedToken,
              },
            },
          );
          setPost((current) =>
            current
              ? {
                  ...current,
                  view_count: viewResponse.data.view_count,
                }
              : current,
          );
        } catch {
          // Keep the article usable even if view tracking fails.
        }
      } catch {
        setError("Unable to load this article right now.");
      } finally {
        setLoading(false);
      }
    };

    void loadPostData();
  }, [currentUserId, postId, sharedToken]);

  const handleSubmitReview = async () => {
    if (!post || !currentUserId) {
      return;
    }
    if (!reviewDraft.trim()) {
      setReviewSuccess("");
      setReviewError("Review is required.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewError("");
      setReviewSuccess("");
      if (editingReviewId !== null) {
        const response = await api.put<PostReview>(
          `/posts/${post.id}/reviews/${editingReviewId}`,
          {
            content: reviewDraft.trim(),
            district_id: reviewSource.district_id,
            constituency_id: reviewSource.constituency_id,
            subcounty_id: reviewSource.subcounty_id,
            parish_id: reviewSource.parish_id,
          },
          {
            params: {
              actor_user_id: currentUserId,
              shared_token: sharedToken,
            },
          },
        );
        setPost((current) =>
          current
            ? {
                ...current,
                reviews: current.reviews.map((review) =>
                  review.id === editingReviewId ? response.data : review,
                ),
              }
            : current,
        );
        setReviewDraft(response.data.content);
        setReviewSource(getReviewSource(response.data));
        setReviewSuccess("Your review has been updated successfully.");
      } else {
        const response = await api.post<PostReview>(`/posts/${post.id}/reviews`, {
          author_user_id: currentUserId,
          content: reviewDraft.trim(),
          district_id: reviewSource.district_id,
          constituency_id: reviewSource.constituency_id,
          subcounty_id: reviewSource.subcounty_id,
          parish_id: reviewSource.parish_id,
        }, {
          params: {
            shared_token: sharedToken,
          },
        });
        setPost((current) =>
          current
            ? {
                ...current,
                review_count: current.review_count + 1,
                viewer_has_reviewed: true,
                reviews: [response.data, ...current.reviews],
              }
            : current,
        );
        setReviewDraft(response.data.content);
        setReviewSource(getReviewSource(response.data));
        setReviewSuccess("Your review has been submitted successfully.");
      }
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to submit your review."
          : "Unable to submit your review.";
      setReviewSuccess("");
      setReviewError(message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleEditReview = (review: PostReview) => {
    setReviewError("");
    setReviewSuccess("");
    setEditingReviewId(review.id);
    setReviewDraft(review.content);
    setReviewSource(getReviewSource(review));
    setReviewDialogOpen(true);
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

  const handleDeleteReview = async (reviewId: number) => {
    if (!post || !currentUserId) {
      return;
    }

    try {
      await api.delete(`/posts/${post.id}/reviews/${reviewId}`, {
        params: {
          actor_user_id: currentUserId,
          shared_token: sharedToken,
        },
      });
      setPost((current) =>
        current
          ? {
              ...current,
              review_count: Math.max(0, current.review_count - 1),
              viewer_has_reviewed: false,
              reviews: current.reviews.filter((review) => review.id !== reviewId),
            }
          : current,
      );
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "response" in caughtError
          ? (
              caughtError as {
                response?: { data?: { detail?: string } };
              }
            ).response?.data?.detail || "Unable to delete your review."
          : "Unable to delete your review.";
      setError(message);
    }
  };

  const handleReaction = async (reactionType: "like" | "dislike") => {
    if (!post || !currentUserId || !postId) {
      return;
    }

    try {
      await api.post(`/posts/${post.id}/reactions`, {
        user_id: currentUserId,
        reaction_type: reactionType,
      }, {
        params: {
          shared_token: sharedToken,
        },
      });
      await loadPost(postId, currentUserId);
    } catch {
      setError("Unable to update reaction.");
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 320, display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Stack spacing={2.5}>
        <Button
          variant="text"
          startIcon={<WestRoundedIcon />}
          onClick={() => {
            if (isSharedRoute) {
              navigate("/dashboard/feed");
              return;
            }
            navigate(-1);
          }}
          sx={{ alignSelf: "flex-start" }}
        >
          {isSharedRoute ? "Back to feed" : "Back"}
        </Button>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {post ? (
          <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
            <Stack spacing={2.5}>
              <PostThumbnail
                postId={post.id}
                thumbnail={post.thumbnail}
                postTitle={post.title}
                sx={{ height: { xs: 220, md: 320 } }}
              />

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ButtonBase
                    onClick={() => navigate(`/dashboard/users/${post.author.id}`)}
                    sx={{ borderRadius: "50%", p: 0.25 }}
                  >
                    <UserAvatar
                      username={post.author.username}
                      fname={post.author.fname}
                      lname={post.author.lname}
                      profile_picture={post.author.profile_picture}
                      sx={{ width: 48, height: 48 }}
                    />
                  </ButtonBase>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {post.title || "Untitled post"}
                    </Typography>
                    <ButtonBase
                      onClick={() => navigate(`/dashboard/users/${post.author.id}`)}
                      sx={{
                        borderRadius: 2,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        mt: 0.5,
                        px: 0.25,
                      }}
                    >
                      <Typography
                        color="text.secondary"
                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Box component="span">
                          {post.author.id === currentUserId
                            ? "By you"
                            : getUserDisplayName(post.author)}
                        </Box>
                        <VerifiedBadge
                          verificationStatus={post.author.verification_status}
                          sx={{ fontSize: 16 }}
                        />
                      </Typography>
                    </ButtonBase>
                  </Box>
                </Stack>
              </Stack>

              <Typography color="text.secondary">
                {formatViewCount(post.view_count)} • {formatReviewCount(post.review_count)} •{" "}
                {formatPostAge(post.date_added, post.time_added)}
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
                  "&::-webkit-scrollbar": { height: 6 },
                  "&::-webkit-scrollbar-thumb": {
                    backgroundColor: alpha("#111827", 0.18),
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
                    onClick={() => void handleReaction("like")}
                    sx={reactionToggleSx("like", post.viewer_reaction === "like")}
                  >
                    <ThumbUpAltRoundedIcon fontSize="small" />
                    {post.reaction_summary.counts.like || 0}
                  </ToggleButton>
                  <ToggleButton
                    value="dislike"
                    onClick={() => void handleReaction("dislike")}
                    sx={reactionToggleSx("dislike", post.viewer_reaction === "dislike")}
                  >
                    <ThumbDownAltRoundedIcon fontSize="small" />
                    {post.reaction_summary.counts.dislike || 0}
                  </ToggleButton>
                </ToggleButtonGroup>
                <Button
                  size="small"
                  startIcon={<ShareRoundedIcon />}
                  onClick={() => setShareDialogOpen(true)}
                  sx={secondaryActionButtonSx}
                  aria-label="Share"
                >
                  {null}
                </Button>
                <Button
                  variant="text"
                  size="small"
                  startIcon={<RateReviewRoundedIcon />}
                  onClick={() => {
                    const viewerReview = post.reviews.find(
                      (review) => review.author.id === currentUserId,
                    );
                    setReviewError("");
                    setReviewSuccess("");
                    setEditingReviewId(null);
                    setReviewDraft(viewerReview?.content || "");
                    setReviewDialogOpen(true);
                    setReviewSource(
                      viewerReview
                        ? getReviewSource(viewerReview)
                        : {
                            district_id: defaultSource.district_id,
                            constituency_id: defaultSource.constituency_id,
                            subcounty_id: defaultSource.subcounty_id,
                            parish_id: defaultSource.parish_id,
                          },
                    );
                  }}
                  sx={secondaryActionButtonSx}
                >
                  {post.viewer_has_reviewed ? "Review submitted" : "Add review"}
                </Button>
                {post.attachment ? (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<DescriptionRoundedIcon />}
                    onClick={() => setPdfViewerOpen(true)}
                    sx={secondaryActionButtonSx}
                  >
                    View attachment
                  </Button>
                ) : null}
              </Box>

              <Divider />

              <Typography
                sx={{
                  color: "text.primary",
                  lineHeight: 1.9,
                  whiteSpace: "pre-wrap",
                }}
              >
                {post.content}
              </Typography>

              <Divider />

              <Stack spacing={1.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Reviews
                </Typography>
                {post.reviews.length ? (
                  post.reviews.map((review) => (
                    <Paper key={review.id} elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <UserAvatar
                          username={review.author.username}
                          fname={review.author.fname}
                          lname={review.author.lname}
                          profile_picture={review.author.profile_picture}
                          sx={{ width: 34, height: 34 }}
                        />
                        <Box>
                          {(() => {
                            const canManageReview = canManageReviewInUi(
                              review,
                              reviewActionNow,
                            );

                            return (
                              <>
                          <Typography
                            sx={{
                              fontWeight: 600,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <Box component="span">{getUserDisplayName(review.author)}</Box>
                            <VerifiedBadge
                              verificationStatus={review.author.verification_status}
                              sx={{ fontSize: 16 }}
                            />
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {formatPostAge(review.date_added, review.time_added)}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mb: 0.75 }} useFlexGap flexWrap="wrap">
                            {review.is_edited ? <Chip label="Edited" size="small" /> : null}
                            {review.author.id === currentUserId && canManageReview ? (
                              <Button size="small" onClick={() => handleEditReview(review)}>
                                Edit
                              </Button>
                            ) : null}
                            {review.author.id === currentUserId && canManageReview ? (
                              <Button
                                size="small"
                                color="error"
                                onClick={() => void handleDeleteReview(review.id)}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </Stack>
                          <Typography color="text.secondary">{review.content}</Typography>
                              </>
                            );
                          })()}
                        </Box>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography color="text.secondary">No reviews yet.</Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>

      <PostReviewDialog
        open={reviewDialogOpen}
        postTitle={post?.title}
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
          setReviewDialogOpen(false);
          setEditingReviewId(null);
          setReviewDraft("");
          setReviewSource({
            district_id: defaultSource.district_id,
            constituency_id: defaultSource.constituency_id,
            subcounty_id: defaultSource.subcounty_id,
            parish_id: defaultSource.parish_id,
          });
          setReviewError("");
          setReviewSuccess("");
        }}
        onSubmit={handleSubmitReview}
        loading={reviewSubmitting}
        hasReviewed={post?.viewer_has_reviewed}
        error={reviewError}
        success={reviewSuccess}
        mode={editingReviewId !== null ? "edit" : "create"}
        source={reviewSource}
        onSourceChange={handleReviewSourceChange}
      />
      <PdfViewerDialog
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        title={post?.title ? `${post.title} attachment` : "PDF attachment"}
        pdfUrl={post?.attachment}
      />
      <SharePostDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        title={post?.title || `${post ? getUserDisplayName(post.author) : "Shared"}'s post`}
        content={post?.content}
        shareUrl={
          post
            ? `${window.location.origin}${
                isSharedRoute
                  ? `${location.pathname}${location.search}`
                  : post.visibility === "private" && post.share_url
                    ? post.share_url
                    : `/shared-post/${post.id}`
              }`
            : null
        }
      />
      <SharedPostLoginDialog
        open={Boolean(isSharedRoute && !currentUserId)}
        onCancel={() => navigate("/")}
        onSuccess={(user) => {
          storeUser(user);
          setSessionUser(user);
        }}
      />
    </Container>
  );
};

export default PostArticlePage;
