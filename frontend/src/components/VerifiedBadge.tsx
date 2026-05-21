import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { Tooltip } from "@mui/material";
import type { SxProps } from "@mui/material";
import type { Theme } from "@mui/material/styles";

type VerifiedBadgeProps = {
  verificationStatus?: string | null;
  sx?: SxProps<Theme>;
};

const isVerified = (verificationStatus?: string | null) =>
  verificationStatus?.trim().toLowerCase() === "verified";

const VerifiedBadge = ({ verificationStatus, sx }: VerifiedBadgeProps) => {
  if (!isVerified(verificationStatus)) {
    return null;
  }

  return (
    <Tooltip title="Verified">
      <CheckCircleRoundedIcon
        aria-label="Verified"
        fontSize="inherit"
        sx={[
          {
            color: "primary.main",
            flexShrink: 0,
            verticalAlign: "text-bottom",
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      />
    </Tooltip>
  );
};

export default VerifiedBadge;
