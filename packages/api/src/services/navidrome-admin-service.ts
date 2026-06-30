import path from "node:path";
import type { ApiConfig } from "../config";

export interface NavidromeProvisionInput {
  userId: string;
  username: string;
  password: string;
  isAdmin: boolean;
}

export interface NavidromeProvisionResult {
  userId: string;
  libraryId: string;
}

interface NavidromeLoginResult {
  token?: string;
}

interface NavidromeUser {
  id: string;
  userName: string;
  isAdmin?: boolean;
}

interface NavidromeLibrary {
  id: number | string;
  name: string;
  path: string;
}

export async function provisionNavidromeUserLibrary(
  config: ApiConfig,
  input: NavidromeProvisionInput
): Promise<NavidromeProvisionResult> {
  const client = await createNavidromeAdminClient(config);
  const library = await ensureLibrary(client, config, input);
  const user = await ensureUser(client, input);

  if (!input.isAdmin) {
    await client.request(`user/${encodeURIComponent(user.id)}/library`, {
      method: "PUT",
      body: { libraryIds: [library.id] }
    });
  }

  return {
    userId: String(user.id),
    libraryId: String(library.id)
  };
}

async function createNavidromeAdminClient(config: ApiConfig) {
  const baseUrl = (config.navidrome.baseUrl || "http://127.0.0.1:4533").replace(/\/+$/, "");
  const username = config.navidrome.username || "";
  const password = config.navidrome.password || "";
  if (!username || !password) {
    throw new Error("Navidrome admin username or password is not configured.");
  }

  const login = await requestJson<NavidromeLoginResult>(`${baseUrl}/auth/login`, {
    method: "POST",
    body: { username, password }
  });
  if (!login.token) {
    throw new Error("Navidrome login did not return a token.");
  }

  return {
    request: <T = unknown>(resource: string, options: { method?: string; body?: unknown } = {}) => (
      requestJson<T>(`${baseUrl}/api/${resource.replace(/^\/+/, "")}`, {
        method: options.method || "GET",
        token: login.token,
        body: options.body
      })
    )
  };
}

async function ensureLibrary(
  client: Awaited<ReturnType<typeof createNavidromeAdminClient>>,
  config: ApiConfig,
  input: NavidromeProvisionInput
) {
  const libraries = await client.request<NavidromeLibrary[]>(`library?_sort=name&_order=ASC&_start=0&_end=500`);
  const libraryPath = navidromeUserLibraryPath(config, input.userId);
  const existing = libraries.find((library) => normalizePath(library.path) === normalizePath(libraryPath));
  if (existing) return existing;

  const created = await client.request<{ id: string | number }>("library", {
    method: "POST",
    body: {
      name: navidromeLibraryName(input.username),
      path: libraryPath,
      remotePath: "",
      defaultNewUsers: false
    }
  });

  return {
    id: created.id,
    name: navidromeLibraryName(input.username),
    path: libraryPath
  };
}

async function ensureUser(
  client: Awaited<ReturnType<typeof createNavidromeAdminClient>>,
  input: NavidromeProvisionInput
) {
  const userName = navidromeUsername(input.username);
  const users = await client.request<NavidromeUser[]>(`user?_sort=userName&_order=ASC&_start=0&_end=500`);
  const existing = users.find((user) => user.userName.toLowerCase() === userName.toLowerCase());
  if (existing) return existing;

  const created = await client.request<{ id: string }>("user", {
    method: "POST",
    body: {
      userName,
      name: input.username,
      password: input.password,
      isAdmin: input.isAdmin,
      changePassword: false
    }
  });

  return {
    id: created.id,
    userName,
    isAdmin: input.isAdmin
  };
}

function navidromeUserLibraryPath(config: ApiConfig, userId: string) {
  const base = config.navidrome.musicFolder || config.musicDir;
  return path.posix.join(normalizePath(base), "users", sanitizePathSegment(userId));
}

function navidromeUsername(username: string) {
  return username.trim();
}

function navidromeLibraryName(username: string) {
  return `${username.trim()} Library`;
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function requestJson<T>(
  url: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  }
) {
  const headers = new Headers({ accept: "application/json", "X-ND-Client-Unique-Id": "myusic" });
  if (options.token) headers.set("X-ND-Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json().catch(() => undefined) as T | { error?: string } | undefined;
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && body.error
      ? body.error
      : `Navidrome admin API failed: ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}
