import crypto from "node:crypto";
import { promisify } from "node:util";
import { Pool, type QueryResultRow } from "pg";
import type { DatabaseError } from "pg";
import type { AuthRole, AuthStatus, AuthUser, UserAccount } from "@myusic/shared";
import type { ApiConfig } from "./config";

const scrypt = promisify(crypto.scrypt);

export interface AuthSession {
  user: AuthUser;
  expiresAt: string;
}

export interface CreateUserOptions {
  provisionNavidrome?: (input: {
    id: string;
    username: string;
    password: string;
    role: AuthRole;
  }) => Promise<{
    navidromeUserId: string;
    navidromeLibraryId: string;
  }>;
}

export interface ProvisionUserNavidromeOptions {
  provisionNavidrome: (input: {
    id: string;
    username: string;
    password: string;
    role: AuthRole;
  }) => Promise<{
    navidromeUserId: string;
    navidromeLibraryId: string;
  }>;
}

export class AuthService {
  private readonly pool: Pool;
  private migration?: Promise<void>;

  constructor(private readonly config: ApiConfig) {
    if (!config.database.url) {
      throw new Error("DATABASE_URL is required when auth is enabled.");
    }

    this.pool = new Pool({ connectionString: config.database.url });
  }

  get cookieName() {
    return this.config.auth.cookieName;
  }

  async getStatus(token?: string): Promise<AuthStatus> {
    await this.ensureMigrated();
    const setupRequired = await this.isSetupRequired();
    const session = token ? await this.authenticate(token) : undefined;

    return {
      enabled: true,
      setupRequired,
      authenticated: Boolean(session),
      user: session?.user
    };
  }

  async initializeAdmin(username: string, password: string): Promise<AuthSession & { token: string }> {
    await this.ensureMigrated();
    if (!(await this.isSetupRequired())) {
      throw new AuthError(409, "管理员已经创建，请直接登录。");
    }

    const normalizedUsername = normalizeUsername(username);
    validatePassword(password);
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      role: "admin"
    };

    await this.pool.query(
      `insert into users (id, username, password_hash, role, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $5)`,
      [user.id, user.username, passwordHash, user.role, now]
    );

    return this.createSession(user);
  }

  async login(username: string, password: string): Promise<AuthSession & { token: string }> {
    await this.ensureMigrated();
    const result = await this.pool.query(
      `select id, username, password_hash, role, navidrome_user_id, navidrome_library_id, navidrome_synced_at, navidrome_sync_error
       from users
       where username = $1
       limit 1`,
      [normalizeUsername(username)]
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, String(row.password_hash || "")))) {
      throw new AuthError(401, "用户名或密码不正确。");
    }

    return this.createSession(rowToUser(row));
  }

  async listUsers(token: string | undefined): Promise<UserAccount[]> {
    await this.requireAdmin(token);
    const result = await this.pool.query(
      `select id, username, role, created_at, updated_at
       from users
       order by created_at asc`
    );
    return result.rows.map(rowToUserAccount);
  }

  async createUser(
    token: string | undefined,
    username: string,
    password: string,
    role: AuthRole = "member",
    options: CreateUserOptions = {}
  ): Promise<UserAccount> {
    await this.requireAdmin(token);
    const normalizedUsername = normalizeUsername(username);
    const normalizedRole = role === "admin" ? "admin" : "member";
    validatePassword(password);
    const now = new Date();
    const user: UserAccount = {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      role: normalizedRole,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    try {
      await this.pool.query(
        `insert into users (id, username, password_hash, role, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $5)`,
        [user.id, user.username, await hashPassword(password), user.role, now]
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError(409, "用户名已存在。");
      }
      throw error;
    }

    if (options.provisionNavidrome) {
      try {
        const navidrome = await options.provisionNavidrome({
          id: user.id,
          username: user.username,
          password,
          role: user.role
        });
        user.navidromeUserId = navidrome.navidromeUserId;
        user.navidromeLibraryId = navidrome.navidromeLibraryId;
        user.navidromeSyncedAt = new Date().toISOString();
        await this.pool.query(
          `update users
           set navidrome_user_id = $1,
               navidrome_library_id = $2,
               navidrome_synced_at = $3,
               navidrome_sync_error = null,
               updated_at = now()
           where id = $4`,
          [user.navidromeUserId, user.navidromeLibraryId, user.navidromeSyncedAt, user.id]
        );
      } catch (error) {
        user.navidromeSyncError = error instanceof Error ? error.message : "Navidrome provisioning failed.";
        await this.pool.query(
          `update users
           set navidrome_sync_error = $1,
               updated_at = now()
           where id = $2`,
          [user.navidromeSyncError, user.id]
        );
      }
    }

    return user;
  }

  async provisionUserNavidrome(
    token: string | undefined,
    userId: string,
    password: string,
    options: ProvisionUserNavidromeOptions
  ): Promise<UserAccount> {
    await this.requireAdmin(token);
    validatePassword(password);
    const user = await this.getUserById(userId);
    if (!user) {
      throw new AuthError(404, "User not found.");
    }

    try {
      const navidrome = await options.provisionNavidrome({
        id: user.id,
        username: user.username,
        password,
        role: user.role
      });
      const syncedAt = new Date().toISOString();
      await this.pool.query(
        `update users
         set navidrome_user_id = $1,
             navidrome_library_id = $2,
             navidrome_synced_at = $3,
             navidrome_sync_error = null,
             updated_at = now()
         where id = $4`,
        [navidrome.navidromeUserId, navidrome.navidromeLibraryId, syncedAt, user.id]
      );
    } catch (error) {
      await this.pool.query(
        `update users
         set navidrome_sync_error = $1,
             updated_at = now()
         where id = $2`,
        [error instanceof Error ? error.message : "Navidrome provisioning failed.", user.id]
      );
    }

    const updated = await this.getUserById(user.id);
    if (!updated) throw new AuthError(404, "User not found.");
    return updated;
  }

  async authenticate(token: string): Promise<AuthSession | undefined> {
    await this.ensureMigrated();
    const tokenHash = hashToken(token);
    const result = await this.pool.query(
      `select
        s.expires_at,
        u.id,
        u.username,
        u.role,
        u.navidrome_user_id,
        u.navidrome_library_id,
        u.navidrome_synced_at,
        u.navidrome_sync_error
       from user_sessions s
       join users u on u.id = s.user_id
       where s.token_hash = $1
        and s.expires_at > now()
        and s.revoked_at is null
       limit 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return undefined;

    return {
      user: rowToUser(row),
      expiresAt: requiredIsoValue(row.expires_at)
    };
  }

  async requireSession(token: string | undefined): Promise<AuthSession> {
    const session = token ? await this.authenticate(token) : undefined;
    if (!session) {
      throw new AuthError(401, "请先登录。");
    }
    return session;
  }

  async requireAdmin(token: string | undefined): Promise<AuthSession> {
    const session = await this.requireSession(token);
    if (session.user.role !== "admin") {
      throw new AuthError(403, "需要管理员权限。");
    }
    return session;
  }

  async changePassword(token: string | undefined, currentPassword: string, nextPassword: string): Promise<void> {
    const session = token ? await this.authenticate(token) : undefined;
    if (!session) {
      throw new AuthError(401, "请先登录。");
    }

    validatePassword(nextPassword);
    const result = await this.pool.query(
      `select password_hash from users where id = $1 limit 1`,
      [session.user.id]
    );
    const passwordHash = String(result.rows[0]?.password_hash || "");
    if (!(await verifyPassword(currentPassword, passwordHash))) {
      throw new AuthError(401, "当前密码不正确。");
    }

    await this.pool.query(
      `update users set password_hash = $1, updated_at = now() where id = $2`,
      [await hashPassword(nextPassword), session.user.id]
    );
  }

  async logout(token?: string): Promise<void> {
    if (!token) return;
    await this.ensureMigrated();
    await this.pool.query(`update user_sessions set revoked_at = now() where token_hash = $1`, [hashToken(token)]);
  }

  async logoutAll(token?: string): Promise<void> {
    const session = token ? await this.authenticate(token) : undefined;
    if (!session) {
      throw new AuthError(401, "请先登录。");
    }

    await this.pool.query(
      `update user_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`,
      [session.user.id]
    );
  }

  buildSessionCookie(token: string, expiresAt: string) {
    return buildCookie(this.cookieName, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: this.config.auth.secureCookie,
      path: "/",
      expires: new Date(expiresAt)
    });
  }

  buildClearCookie() {
    return buildCookie(this.cookieName, "", {
      httpOnly: true,
      sameSite: "Lax",
      secure: this.config.auth.secureCookie,
      path: "/",
      maxAge: 0
    });
  }

  private ensureMigrated() {
    this.migration ||= this.migrate();
    return this.migration;
  }

  private async migrate() {
    await this.pool.query(`
      create table if not exists users (
        id text primary key,
        username text not null unique,
        password_hash text not null,
        role text not null,
        navidrome_user_id text,
        navidrome_library_id text,
        navidrome_synced_at timestamptz,
        navidrome_sync_error text,
        created_at timestamptz not null,
        updated_at timestamptz not null
      );

      create table if not exists user_sessions (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        token_hash text not null unique,
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null
      );

      create index if not exists users_username_idx on users (username);
      create index if not exists user_sessions_user_id_idx on user_sessions (user_id);
      create index if not exists user_sessions_expires_at_idx on user_sessions (expires_at);
    `);

    await this.pool.query(`
      alter table users add column if not exists navidrome_user_id text;
      alter table users add column if not exists navidrome_library_id text;
      alter table users add column if not exists navidrome_synced_at timestamptz;
      alter table users add column if not exists navidrome_sync_error text;
    `);
  }

  private async isSetupRequired() {
    const result = await this.pool.query(`select count(*)::int as count from users`);
    return Number(result.rows[0]?.count || 0) === 0;
  }

  private async getUserById(id: string): Promise<UserAccount | undefined> {
    await this.ensureMigrated();
    const result = await this.pool.query(
      `select id, username, role, created_at, updated_at,
              navidrome_user_id, navidrome_library_id, navidrome_synced_at, navidrome_sync_error
       from users
       where id = $1
       limit 1`,
      [id]
    );
    const row = result.rows[0];
    return row ? rowToUserAccount(row) : undefined;
  }

  private async createSession(user: AuthUser): Promise<AuthSession & { token: string }> {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.auth.sessionDays * 24 * 60 * 60 * 1000);

    await this.pool.query(
      `insert into user_sessions (id, user_id, token_hash, expires_at, created_at)
       values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), user.id, hashToken(token), expiresAt, now]
    );

    return {
      token,
      user,
      expiresAt: expiresAt.toISOString()
    };
  }
}

export class AuthError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

export function createAuthService(config: ApiConfig) {
  if (!config.auth.enabled) return undefined;
  if (config.database.driver !== "postgres") {
    throw new Error("Auth only supports Postgres storage. Set MYUSIC_STORAGE=postgres.");
  }
  return new AuthService(config);
}

export function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index <= 0) continue;
    if (cookie.slice(0, index) === name) {
      return decodeURIComponent(cookie.slice(index + 1));
    }
  }
  return undefined;
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString("base64url")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [, salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function normalizeUsername(value: string) {
  const username = value.trim();
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    throw new AuthError(400, "用户名只能包含字母、数字、下划线或短横线，长度 3-32。");
  }
  return username;
}

function validatePassword(value: string) {
  if (value.length < 8) {
    throw new AuthError(400, "密码至少需要 8 位。");
  }
}

function rowToUser(row: QueryResultRow): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username),
    role: normalizeRole(row.role),
    navidromeUserId: optionalString(row.navidrome_user_id),
    navidromeLibraryId: optionalString(row.navidrome_library_id),
    navidromeSyncedAt: optionalIsoValue(row.navidrome_synced_at),
    navidromeSyncError: optionalString(row.navidrome_sync_error)
  };
}

function rowToUserAccount(row: QueryResultRow): UserAccount {
  return {
    ...rowToUser(row),
    createdAt: requiredIsoValue(row.created_at),
    updatedAt: requiredIsoValue(row.updated_at),
    navidromeUserId: optionalString(row.navidrome_user_id),
    navidromeLibraryId: optionalString(row.navidrome_library_id),
    navidromeSyncedAt: optionalIsoValue(row.navidrome_synced_at),
    navidromeSyncError: optionalString(row.navidrome_sync_error)
  };
}

function normalizeRole(value: unknown): AuthRole {
  return value === "member" ? "member" : "admin";
}

function isUniqueViolation(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null && "code" in error && (error as DatabaseError).code === "23505";
}

function requiredIsoValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return new Date().toISOString();
}

function optionalIsoValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return undefined;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function buildCookie(name: string, value: string, options: {
  httpOnly: boolean;
  sameSite: "Lax" | "Strict" | "None";
  secure: boolean;
  path: string;
  expires?: Date;
  maxAge?: number;
}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `SameSite=${options.sameSite}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}
