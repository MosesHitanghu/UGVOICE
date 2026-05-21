import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ReviewSourceFields from "./ReviewSourceFields";

type Props = {
  open: boolean;
  postTitle?: string | null;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  hasReviewed?: boolean;
  error?: string;
  success?: string;
  mode?: "create" | "edit";
  source: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  };
  onSourceChange: (source: {
    district_id?: number | null;
    constituency_id?: number | null;
    subcounty_id?: number | null;
    parish_id?: number | null;
  }) => void;
};

const PostReviewDialog = ({
  open,
  postTitle,
  value,
  onChange,
  onClose,
  onSubmit,
  loading = false,
  hasReviewed = false,
  error = "",
  success = "",
  mode = "create",
  source,
  onSourceChange,
}: Props) => (
  <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{mode === "edit" ? "Edit Review" : "Add Review"}</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {success ? <Alert severity="success">{success}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Typography color="text.secondary">
          {mode === "edit"
            ? postTitle
              ? `Update your review for "${postTitle}".`
              : "Update your review for this post."
            : postTitle
              ? `Share your review for "${postTitle}".`
              : "Share your review for this post."}
        </Typography>
        <TextField
          label="Your review"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          multiline
          minRows={4}
          fullWidth
          disabled={loading || (mode === "create" && hasReviewed)}
          error={Boolean(error)}
          helperText={
            mode === "create" && hasReviewed
              ? "You have already reviewed this post."
              : mode === "edit"
                  ? "Your updated review will appear on the full article page."
                  : "Your review will be added to the full article page."
          }
        />
        <ReviewSourceFields
          value={source}
          onChange={onSourceChange}
          disabled={loading || (mode === "create" && hasReviewed)}
        />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={loading}>
        Close
      </Button>
      <Button
        onClick={() => void onSubmit()}
        variant="contained"
        disabled={loading || (mode === "create" && hasReviewed)}
      >
        {loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : mode === "edit" ? (
          "Save changes"
        ) : (
          "Submit review"
        )}
      </Button>
    </DialogActions>
  </Dialog>
);

export default PostReviewDialog;
