import type { AuthUser } from "@myusic/shared";
import { AuthError } from "../auth";
import type { ApiConfig } from "../config";
import type { NavidromeContext } from "../navidrome";

export function getUserNavidromeContext(config: ApiConfig, user?: AuthUser): NavidromeContext | undefined {
  if (!user) return undefined;
  return {
    baseUrl: config.navidrome.baseUrl,
    username: config.navidrome.username,
    password: config.navidrome.password,
    libraryId: user.navidromeLibraryId
  };
}

export function requireUserNavidromeContext(config: ApiConfig, user: AuthUser | undefined, message: string) {
  const context = getUserNavidromeContext(config, user);
  if (context && !context.libraryId) {
    throw new AuthError(409, message);
  }
  return context;
}
