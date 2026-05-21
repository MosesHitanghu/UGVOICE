import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import { resolveApiAssetUrl } from "../lib/api";

type PdfViewerDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string | null;
  pdfUrl?: string | null;
};

const PdfViewerDialog = ({
  open,
  onClose,
  title,
  pdfUrl,
}: PdfViewerDialogProps) => {
  const resolvedPdfUrl = resolveApiAssetUrl(pdfUrl) || "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        {title || "PDF attachment"}
        <IconButton onClick={onClose} size="small" aria-label="Close PDF viewer">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 0, pb: 0 }}>
        <iframe
          title={title || "PDF attachment"}
          src={resolvedPdfUrl}
          style={{ width: "100%", height: "75vh", border: 0, display: "block" }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          component="a"
          href={resolvedPdfUrl || undefined}
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNewRoundedIcon />}
        >
          Open in new tab
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PdfViewerDialog;
