import { Avatar, type AvatarProps } from "@mui/material";

type UserAvatarProps = {
  username: string;
  fname?: string | null;
  lname?: string | null;
  profile_picture?: string | null;
} & AvatarProps;

const avatarColors = [
  "#D90000",
  "#111111",
  "#FCDC04",
  "#990000",
  "#D90000",
  "#FCDC04",
  "#111111",
  "#990000",
];

const demoProfilePictures: Record<string, string> = {
  "amina.owino": "/demo-profiles/amina-owino.svg",
  "brian.kato": "/demo-profiles/brian-kato.svg",
  "clara.njeri": "/demo-profiles/clara-njeri.svg",
  "esther.mutoni": "/demo-profiles/esther-mutoni.svg",
  "frank.bwire": "/demo-profiles/frank-bwire.svg",
  "grace.namuli": "/demo-profiles/grace-namuli.svg",
};

const getDisplayName = (user: {
  username: string;
  fname?: string | null;
  lname?: string | null;
}) => [user.fname, user.lname].filter(Boolean).join(" ") || user.username;

const getInitials = (user: {
  username: string;
  fname?: string | null;
  lname?: string | null;
}) => {
  const fullName = [user.fname, user.lname].filter(Boolean);
  if (fullName.length) {
    return fullName
      .map((part) => part?.trim().charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  }

  return user.username.slice(0, 2).toUpperCase();
};

const getAvatarColor = (seed: string) => {
  const hash = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return avatarColors[hash % avatarColors.length];
};

const UserAvatar = ({
  username,
  fname,
  lname,
  profile_picture,
  sx,
  ...avatarProps
}: UserAvatarProps) => {
  const identity = { username, fname, lname };
  const fallbackSeed = `${username}-${fname || ""}-${lname || ""}`;
  const resolvedProfilePicture =
    profile_picture || demoProfilePictures[username] || undefined;

  return (
    <Avatar
      src={resolvedProfilePicture}
      alt={getDisplayName(identity)}
      sx={{
        bgcolor: getAvatarColor(fallbackSeed),
        color: "#FFFFFF",
        fontWeight: 700,
        ...sx,
      }}
      {...avatarProps}
    >
      {getInitials(identity)}
    </Avatar>
  );
};

export default UserAvatar;
