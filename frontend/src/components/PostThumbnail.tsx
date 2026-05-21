import { useEffect, useMemo, useState } from "react";
import { Box, type BoxProps } from "@mui/material";

import { resolveApiAssetUrl } from "../lib/api";

type PostThumbnailProps = {
  postId?: number | null;
  thumbnail?: string | null;
  postTitle?: string | null;
} & BoxProps;

const DEFAULT_POST_THUMBNAIL = "/default-post-thumbnail.svg";
const DEMO_POST_THUMBNAILS = [
  "https://picsum.photos/id/1015/1200/720",
  "https://picsum.photos/id/1025/1200/720",
  "https://picsum.photos/id/1035/1200/720",
  "https://picsum.photos/id/1043/1200/720",
  "https://picsum.photos/id/1050/1200/720",
  "https://picsum.photos/id/1060/1200/720",
  "https://picsum.photos/id/1067/1200/720",
  "https://picsum.photos/id/1074/1200/720",
  "https://picsum.photos/id/1080/1200/720",
  "https://picsum.photos/id/1084/1200/720",
  "https://picsum.photos/id/1082/1200/720",
  "https://picsum.photos/id/1081/1200/720",
  "https://picsum.photos/id/1069/1200/720",
  "https://picsum.photos/id/1057/1200/720",
  "https://picsum.photos/id/1040/1200/720",
  "https://picsum.photos/id/1039/1200/720",
  "https://picsum.photos/id/1033/1200/720",
  "https://picsum.photos/id/1021/1200/720",
];

const PostThumbnail = ({
  postId,
  thumbnail,
  postTitle,
  sx,
  ...boxProps
}: PostThumbnailProps) => {
  const resolvedSrc = useMemo(() => {
    if (thumbnail) {
      return resolveApiAssetUrl(thumbnail) || DEFAULT_POST_THUMBNAIL;
    }

    if (postId && postId % 2 === 0) {
      return DEMO_POST_THUMBNAILS[postId % DEMO_POST_THUMBNAILS.length];
    }

    return DEFAULT_POST_THUMBNAIL;
  }, [postId, thumbnail]);

  const [src, setSrc] = useState(resolvedSrc);

  useEffect(() => {
    setSrc(resolvedSrc);
  }, [resolvedSrc]);

  return (
    <Box
      component="img"
      src={src}
      alt={postTitle || "Post thumbnail"}
      onError={() => {
        if (src !== DEFAULT_POST_THUMBNAIL) {
          setSrc(DEFAULT_POST_THUMBNAIL);
        }
      }}
      sx={{
        width: "100%",
        height: 180,
        objectFit: "cover",
        borderRadius: 2,
        display: "block",
        ...sx,
      }}
      {...boxProps}
    />
  );
};

export default PostThumbnail;
