import type { AuthUser } from "@myusic/shared";
import type { ApiConfig } from "../config";
import type { NavidromeContext } from "../navidrome";
import { getUserMusicDir } from "./download-service";

export interface UserLibraryContext {
  user: AuthUser;
  musicDir: string;
  navidrome: NavidromeContext;
}

export function getUserLibraryContext(config: ApiConfig, user: AuthUser): UserLibraryContext {
  const userLibraryPathPrefix = `users/${sanitizePathSegment(user.id)}`;
  const libraryPathPrefix = user.navidromeLibraryId ? undefined : userLibraryPathPrefix;

  return {
    user,
    musicDir: getUserMusicDir(config, user.id),
    navidrome: {
      baseUrl: config.navidrome.baseUrl,
      username: config.navidrome.username,
      password: config.navidrome.password,
      userLibraryPathPrefix,
      libraryPathPrefix
    }
  };
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
