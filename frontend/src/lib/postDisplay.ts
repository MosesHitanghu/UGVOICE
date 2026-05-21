export const formatPostAge = (
  dateAdded?: string | null,
  timeAdded?: string | null,
) => {
  if (!dateAdded) {
    return "Unknown time";
  }

  const isoValue = timeAdded ? `${dateAdded}T${timeAdded}` : `${dateAdded}T00:00:00`;
  const postedAt = new Date(isoValue);
  if (Number.isNaN(postedAt.getTime())) {
    return "Unknown time";
  }

  const diffMs = Date.now() - postedAt.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (diffMs < weekMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (diffMs < monthMs) {
    const weeks = Math.max(1, Math.floor(diffMs / weekMs));
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  if (diffMs < yearMs) {
    const months = Math.max(1, Math.floor(diffMs / monthMs));
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.max(1, Math.floor(diffMs / yearMs));
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

export const formatViewCount = (viewCount?: number | null) => {
  const count = Math.max(0, viewCount || 0);
  return `${count} view${count === 1 ? "" : "s"}`;
};

export const formatReviewCount = (reviewCount?: number | null) => {
  const count = Math.max(0, reviewCount || 0);
  return `${count} review${count === 1 ? "" : "s"}`;
};
