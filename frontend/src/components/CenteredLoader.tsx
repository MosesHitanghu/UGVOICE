import { Box, CircularProgress } from "@mui/material";

type CenteredLoaderProps = {
  minHeight?: string | number;
  size?: number;
};

const CenteredLoader = ({ minHeight = 180, size = 32 }: CenteredLoaderProps) => {
  return (
    <Box sx={{ minHeight, display: "grid", placeItems: "center", width: "100%" }}>
      <CircularProgress size={size} />
    </Box>
  );
};

export default CenteredLoader;
