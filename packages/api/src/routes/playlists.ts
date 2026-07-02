import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AuthUser, Playlist } from "@myusic/shared";
import type { ApiConfig } from "../config";
import { getNavidromeSong } from "../navidrome";
import { requireUserNavidromeContext } from "../services/user-library-service";

export interface RegisterPlaylistRoutesOptions {
  config: ApiConfig;
  playlists: Playlist[];
  persist: () => Promise<void>;
}

const TAB_COLORS = ["rose", "ochre", "blue", "olive", "parchment"];

export function registerPlaylistRoutes(app: FastifyInstance, options: RegisterPlaylistRoutesOptions) {
  const { config, playlists } = options;

  app.get("/api/playlists", async (request) => {
    return userPlaylists(playlists, request.auth?.user.id);
  });

  app.post<{ Body: { name?: string; color?: string; songId?: string } }>("/api/playlists", async (request, reply) => {
    const userId = request.auth?.user.id;
    const now = new Date().toISOString();
    const name = normalizeName(request.body?.name) || nextPlaylistName(playlists, userId);
    const songId = normalizeId(request.body?.songId);
    if (songId && !(await canAccessSong(config, songId, request.auth?.user))) {
      reply.code(404);
      return { error: "Song not found." };
    }

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      userId,
      name,
      color: normalizeColor(request.body?.color) || TAB_COLORS[userPlaylists(playlists, userId).length % TAB_COLORS.length],
      items: songId ? [{ id: crypto.randomUUID(), songId, addedAt: now }] : [],
      createdAt: now,
      updatedAt: now
    };
    playlists.push(playlist);
    await options.persist();
    reply.code(201);
    return playlist;
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; color?: string } }>("/api/playlists/:id", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const name = normalizeName(request.body?.name);
    const color = normalizeColor(request.body?.color);
    if (name) playlist.name = name;
    if (color) playlist.color = color;
    touch(playlist);
    await options.persist();
    return playlist;
  });

  app.delete<{ Params: { id: string } }>("/api/playlists/:id", async (request, reply) => {
    const index = playlists.findIndex((playlist) => playlist.id === request.params.id && belongsToUser(playlist, request.auth?.user.id));
    if (index === -1) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    playlists.splice(index, 1);
    await options.persist();
    return userPlaylists(playlists, request.auth?.user.id);
  });

  app.post<{ Params: { id: string }; Body: { songId?: string } }>("/api/playlists/:id/items", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const songId = normalizeId(request.body?.songId);
    if (!songId) {
      reply.code(400);
      return { error: "songId is required." };
    }

    if (!(await canAccessSong(config, songId, request.auth?.user))) {
      reply.code(404);
      return { error: "Song not found." };
    }

    if (!playlist.items.some((item) => item.songId === songId)) {
      playlist.items.push({
        id: crypto.randomUUID(),
        songId,
        addedAt: new Date().toISOString()
      });
      touch(playlist);
      await options.persist();
    }
    return playlist;
  });

  app.delete<{ Params: { id: string; itemId: string } }>("/api/playlists/:id/items/:itemId", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const nextItems = playlist.items.filter((item) => item.id !== request.params.itemId);
    if (nextItems.length === playlist.items.length) {
      reply.code(404);
      return { error: "Playlist item not found." };
    }

    playlist.items = nextItems;
    touch(playlist);
    await options.persist();
    return playlist;
  });

  app.patch<{ Params: { id: string }; Body: { itemIds?: string[] } }>("/api/playlists/:id/items", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const itemIds = Array.isArray(request.body?.itemIds) ? request.body.itemIds : [];
    if (new Set(itemIds).size !== playlist.items.length) {
      reply.code(400);
      return { error: "itemIds must include every playlist item once." };
    }

    const byId = new Map(playlist.items.map((item) => [item.id, item]));
    const ordered = itemIds.map((id) => byId.get(id)).filter(Boolean) as Playlist["items"];
    if (ordered.length !== playlist.items.length) {
      reply.code(400);
      return { error: "itemIds must include every playlist item." };
    }

    playlist.items = ordered;
    touch(playlist);
    await options.persist();
    return playlist;
  });

  app.post<{ Params: { id: string } }>("/api/playlists/:id/play", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    playlist.lastPlayedAt = new Date().toISOString();
    touch(playlist);
    await options.persist();
    return playlist;
  });
}

function userPlaylists(playlists: Playlist[], userId?: string) {
  return playlists
    .filter((playlist) => belongsToUser(playlist, userId))
    .slice()
    .sort((left, right) => (
      (right.lastPlayedAt || right.updatedAt || "").localeCompare(left.lastPlayedAt || left.updatedAt || "")
      || left.name.localeCompare(right.name, "zh-CN", { numeric: true, sensitivity: "base" })
    ));
}

function findPlaylist(playlists: Playlist[], id: string, userId?: string) {
  return playlists.find((playlist) => playlist.id === id && belongsToUser(playlist, userId));
}

function belongsToUser(record: { userId?: string }, userId?: string) {
  return userId ? record.userId === userId : true;
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeColor(value: unknown) {
  const color = typeof value === "string" ? value.trim() : "";
  return TAB_COLORS.includes(color) ? color : "";
}

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nextPlaylistName(playlists: Playlist[], userId?: string) {
  return `歌单 ${userPlaylists(playlists, userId).length + 1}`;
}

function touch(playlist: Playlist) {
  playlist.updatedAt = new Date().toISOString();
}

async function canAccessSong(config: ApiConfig, songId: string, user?: AuthUser) {
  const context = requireUserNavidromeContext(config, user, "请先绑定移动端音乐库，再添加歌曲到歌单。");
  if (!context) return true;
  return Boolean(await getNavidromeSong(config, songId, context));
}
