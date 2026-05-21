import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import FacebookRoundedIcon from "@mui/icons-material/FacebookRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import XIcon from "@mui/icons-material/X";

type SharePostDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string | null;
  content?: string | null;
  shareUrl?: string | null;
};

const SharePostDialog = ({
  open,
  onClose,
  title,
  content,
  shareUrl,
}: SharePostDialogProps) => {
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canUseNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const safeTitle = title || "Shared post";
  const safeContent = content || "Take a look at this post.";
  const safeUrl = shareUrl || "";

  const shareTargets = useMemo(
    () => [
      {
        label: "Copy link",
        icon: <ContentCopyRoundedIcon fontSize="small" />,
        color: "#2563eb",
        backgroundColor: "#eff6ff",
        action: async () => {
          await navigator.clipboard.writeText(safeUrl);
          setSuccessMessage("Link copied to clipboard.");
        },
      },
      {
        label: "WhatsApp",
        icon: <WhatsAppIcon fontSize="small" />,
        color: "#1f7a4f",
        backgroundColor: "#e8f8ef",
        action: async () => {
          window.open(
            `https://wa.me/?text=${encodeURIComponent(`${safeTitle}\n${safeUrl}`)}`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      {
        label: "X",
        icon: <XIcon fontSize="small" />,
        color: "#111827",
        backgroundColor: "#f3f4f6",
        action: async () => {
          window.open(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(safeTitle)}&url=${encodeURIComponent(safeUrl)}`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      {
        label: "Facebook",
        icon: <FacebookRoundedIcon fontSize="small" />,
        color: "#1877f2",
        backgroundColor: "#eff6ff",
        action: async () => {
          window.open(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(safeUrl)}`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      {
        label: "LinkedIn",
        icon: <LinkedInIcon fontSize="small" />,
        color: "#0a66c2",
        backgroundColor: "#eff6ff",
        action: async () => {
          window.open(
            `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(safeUrl)}`,
            "_blank",
            "noopener,noreferrer",
          );
        },
      },
      {
        label: "Email",
        icon: <EmailRoundedIcon fontSize="small" />,
        color: "#b45309",
        backgroundColor: "#fff7ed",
        action: async () => {
          window.location.href = `mailto:?subject=${encodeURIComponent(safeTitle)}&body=${encodeURIComponent(`${safeContent}\n\n${safeUrl}`)}`;
        },
      },
    ],
    [safeContent, safeTitle, safeUrl],
  );

  const handleClose = () => {
    setError("");
    setSuccessMessage("");
    onClose();
  };

  const handleTargetAction = async (action: () => Promise<void>) => {
    try {
      setError("");
      setSuccessMessage("");
      await action();
    } catch {
      setError("Unable to share this post right now.");
    }
  };

  const handleNativeShare = async () => {
    if (!canUseNativeShare) {
      return;
    }

    try {
      setError("");
      setSuccessMessage("");
      await navigator.share({
        title: safeTitle,
        text: safeContent,
        url: safeUrl,
      });
    } catch (shareError: any) {
      if (shareError?.name === "AbortError") {
        return;
      }
      setError("Unable to open the share sheet right now.");
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        Share post
        <IconButton onClick={handleClose} size="small" aria-label="Close share dialog">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography color="text.secondary">
            Choose where to share this post.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          <TextField
            label="Share link"
            value={safeUrl}
            fullWidth
            InputProps={{
              readOnly: true,
              startAdornment: <LinkRoundedIcon fontSize="small" style={{ marginRight: 8 }} />,
            }}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
              gap: 1,
            }}
          >
            {shareTargets.map((target) => (
              <Button
                key={target.label}
                variant="text"
                startIcon={target.icon}
                onClick={() => void handleTargetAction(target.action)}
                sx={{
                  justifyContent: "flex-start",
                  minHeight: 44,
                  borderRadius: 2,
                  color: target.color,
                  bgcolor: target.backgroundColor,
                  border: "1px solid transparent",
                  "&:hover": {
                    bgcolor: target.backgroundColor,
                    filter: "brightness(0.97)",
                  },
                }}
              >
                {target.label}
              </Button>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={handleClose}>Close</Button>
        {canUseNativeShare ? (
          <Button
            variant="contained"
            onClick={() => void handleNativeShare()}
            startIcon={<IosShareRoundedIcon />}
          >
            More
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};

export default SharePostDialog;
