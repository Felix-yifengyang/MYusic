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

export function registerPlaylistRoutes(app: FastifyInstance, options: RegisterPlaylistRoutesOptions) {
  const { config, playlists } = options;

  app.get("/api/playlists", async (request) => {
    return userPlaylists(playlists, request.auth?.user.id);
  });

  app.post<{ Body: { name?: string } }>("/api/playlists", async (request, reply) => {
    const userId = request.auth?.user.id;
    const now = new Date().toISOString();
    const name = normalizeName(request.body?.name) || nextPlaylistName(playlists, userId);

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      userId,
      name,
      songIds: [],
      createdAt: now
    };
    playlists.push(playlist);
    await options.persist();
    reply.code(201);
    return playlist;
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>("/api/playlists/:id", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const name = normalizeName(request.body?.name);
    if (name) playlist.name = name;
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

  app.post<{ Params: { id: string }; Body: { songId?: string } }>("/api/playlists/:id/songs", async (request, reply) => {
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

    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
      await options.persist();
    }
    return playlist;
  });

  app.delete<{ Params: { id: string; songId: string } }>("/api/playlists/:id/songs/:songId", async (request, reply) => {
    const playlist = findPlaylist(playlists, request.params.id, request.auth?.user.id);
    if (!playlist) {
      reply.code(404);
      return { error: "Playlist not found." };
    }

    const nextSongIds = playlist.songIds.filter((songId) => songId !== request.params.songId);
    if (nextSongIds.length === playlist.songIds.length) {
      reply.code(404);
      return { error: "Playlist song not found." };
    }

    playlist.songIds = nextSongIds;
    await options.persist();
    return playlist;
  });
}

function userPlaylists(playlists: Playlist[], userId?: string) {
  return playlists.filter((playlist) => belongsToUser(playlist, userId));
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

function normalizeId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nextPlaylistName(playlists: Playlist[], userId?: string) {
  return `歌单 ${playlists.filter((playlist) => belongsToUser(playlist, userId)).length + 1}`;
}

async function canAccessSong(config: ApiConfig, songId: string, user?: AuthUser) {
  const context = requireUserNavidromeContext(config, user, "请先绑定移动端音乐库，再添加歌曲到歌单。");
  if (!context) return true;
  return Boolean(await getNavidromeSong(config, songId, context));
}
