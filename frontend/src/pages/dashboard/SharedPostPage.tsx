import { useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";

import { api } from "../../lib/api";
import PdfViewerDialog from "../../components/PdfViewerDialog";
import PostThumbnail from "../../components/PostThumbnail";
import UserAvatar from "../../components/UserAvatar";
import VerifiedBadge from "../../components/VerifiedBadge";
import { getOrCreateViewerKey, getStoredUser } from "../../lib/session";
import { formatPostAge } from "../../lib/postDisplay";

type SharedPostDetail = {
  id: number;
  title?: string | null;
  content: string;
  category?: string | null;
  visibility: string;
  thumbnail?: string | null;
  attachment?: string | null;
  author: {
    id?: number;
    username: string;
    fname?: string | null;
    lname?: string | null;
    profile_picture?: string | null;
    verification_status?: string | null;
  };
  reviews: Array<{
    id: number;
    content: string;
    date_added?: string | null;
    time_added?: string | null;
    is_edited?: boolean;
    author: {
      username: string;
      fname?: string | null;
      lname?: string | null;
      profile_picture?: string | null;
      verification_status?: string | null;
    };
  }>;
  analytics: {
    total_reviews: number;
    total_reactions: number;
    reactions: Record<string, number>;
  };
};

const POST_VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  constituency: "My constituency",
  private: "Private",
};

const getPostVisibilityLabel = (visibility?: string | null) =>
  POST_VISIBILITY_LABELS[visibility || "public"] || "Public";

const getUserDisplayName = (user: {
  username: string;
  fname?: string | null;
  lname?: string | null;
}) => [user.fname, user.lname].filter(Boolean).join(" ") || user.username;

const SharedPostPage = () => {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const currentUserId = currentUser?.id;
  const { postId } = useParams();
  const [searchParams] = useSearchParams();
  const [post, setPost] = useState<SharedPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) {
        setError("Missing shared post id.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.get<SharedPostDetail>(`/posts/${postId}`, {
          params: {
            viewer_user_id: currentUserId,
            shared_token: searchParams.get("token") || undefined,
          },
        });
        setPost(response.data);
        try {
          await api.post(`/posts/${postId}/views`, null, {
            params: {
              viewer_user_id: currentUserId,
              viewer_key: getOrCreateViewerKey(),
              shared_token: searchParams.get("token") || undefined,
            },
          });
        } catch {
          // Keep the shared post usable even if view tracking fails.
        }
      } catch {
        setError("This shared post link is invalid or no longer available.");
      } finally {
        setLoading(false);
      }
    };

    void loadPost();
  }, [currentUserId, postId, searchParams]);

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F8FAFC", py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                Shared Post
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.75 }}>
                Private posts can be opened through direct links shared by their authors.
              </Typography>
            </Box>
            <Button component={RouterLink} to={currentUser ? "/dashboard/feed" : "/"} variant="outlined">
              {currentUser ? "Back to feed" : "Back home"}
            </Button>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}

          {post ? (
            <Paper elevation={4} sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Stack spacing={2.5}>
                <PostThumbnail
                  postId={post.id}
                  thumbnail={post.thumbnail}
                  postTitle={post.title}
                  sx={{ height: { xs: 220, md: 280 } }}
                />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <ButtonBase
                    onClick={() => {
                      if (post.author.id) {
                        navigate(`/dashboard/users/${post.author.id}`);
                      }
                    }}
                    sx={{ borderRadius: "50%", p: 0.25 }}
                    disabled={!post.author.id}
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
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {post.title || "Untitled post"}
                    </Typography>
                    <ButtonBase
                      onClick={() => {
                        if (post.author.id) {
                          navigate(`/dashboard/users/${post.author.id}`);
                        }
                      }}
                      sx={{
                        borderRadius: 2,
                        justifyContent: "flex-start",
                        textAlign: "left",
                        mt: 0.5,
                        px: 0.25,
                      }}
                      disabled={!post.author.id}
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

                <Typography sx={{ lineHeight: 1.8 }}>{post.content}</Typography>

                {post.attachment ? (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<DescriptionRoundedIcon />}
                    onClick={() => setPdfViewerOpen(true)}
                    sx={{
                      alignSelf: "flex-start",
                      borderRadius: "20px",
                      textTransform: "none",
                      px: 1,
                    }}
                  >
                    View PDF attachment
                  </Button>
                ) : null}

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={getPostVisibilityLabel(post.visibility)} size="small" />
                  <Chip label={`${post.analytics.total_reviews} reviews`} size="small" />
                  <Chip label={`${post.analytics.total_reactions} reactions`} size="small" />
                </Stack>

                <Paper elevation={2} sx={{ p: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Reviews</Typography>
                  <Stack spacing={1.5}>
                    {post.reviews.map((review) => (
                      <Stack
                        key={review.id}
                        direction="row"
                        spacing={1.25}
                        alignItems="flex-start"
                      >
                        <UserAvatar {...review.author} sx={{ width: 34, height: 34 }} />
                        <Box>
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
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 0.5 }}
                          >
                            {formatPostAge(review.date_added, review.time_added)}
                          </Typography>
                          {review.is_edited ? (
                            <Chip label="Edited" size="small" sx={{ mb: 0.75 }} />
                          ) : null}
                          <Typography color="text.secondary">{review.content}</Typography>
                        </Box>
                      </Stack>
                    ))}
                    {!post.reviews.length ? (
                      <Typography color="text.secondary">No reviews yet.</Typography>
                    ) : null}
                  </Stack>
                </Paper>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Container>
      <PdfViewerDialog
        open={pdfViewerOpen}
        onClose={() => setPdfViewerOpen(false)}
        title={post?.title ? `${post.title} attachment` : "PDF attachment"}
        pdfUrl={post?.attachment}
      />
    </Box>
  );
};

export default SharedPostPage;
