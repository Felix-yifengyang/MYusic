import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { pipeline } from "node:stream";
import type { IncomingMessage, OutgoingHttpHeaders } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { IngestionMatchMethod, IngestionRecord, NavidromeScanStatus, NavidromeSong, NavidromeSongsResult } from "@myusic/shared";
import type { ApiConfig } from "./config";

export interface NavidromeContext {
  baseUrl?: string;
  username?: string;
  password?: string;
  libraryId?: string;
}

interface SubsonicResponse<T> {
  "subsonic-response": {
    status: "ok" | "failed";
    error?: {
      code: number;
      message: string;
    };
  } & T;
}

interface Search3Payload {
  searchResult3?: {
    song?: NavidromeSong[] | NavidromeSong;
  };
}

interface RandomSongsPayload {
  randomSongs?: {
    song?: NavidromeSong[] | NavidromeSong;
  };
}

interface SongPayload {
  song?: NavidromeSong;
}

interface ScanStatusPayload {
  scanStatus?: {
    scanning?: boolean;
    count?: number;
  };
}

export async function pingNavidrome(config: ApiConfig, context?: NavidromeContext) {
  await requestJson(config, context, "ping", {});
  return { ok: true };
}

export async function getNavidromeSongs(config: ApiConfig, query: string, context?: NavidromeContext): Promise<NavidromeSongsResult> {
  const libraryParams: Record<string, string> = context?.libraryId ? { musicFolderId: context.libraryId } : {};

  if (query.trim()) {
    const response = await requestJson<Search3Payload>(config, context, "search3", {
      ...libraryParams,
      query: query.trim(),
      songCount: "80",
      artistCount: "0",
      albumCount: "0"
    });

    return {
      songs: filterSongsByContext(normalizeArray(response.searchResult3?.song), context)
    };
  }

  const response = await requestJson<RandomSongsPayload>(config, context, "getRandomSongs", { ...libraryParams, size: "500" });
  return {
    songs: filterSongsByContext(normalizeArray(response.randomSongs?.song), context).sort(compareNavidromeSongs)
  };
}

export async function getNavidromeSong(config: ApiConfig, id: string, context?: NavidromeContext): Promise<NavidromeSong | undefined> {
  const response = await requestJson<SongPayload>(config, context, "getSong", { id });
  const song = response.song;
  if (!song) return undefined;
  return filterSongsByContext([song], context)[0];
}

export async function startNavidromeScan(config: ApiConfig, context?: NavidromeContext): Promise<NavidromeScanStatus> {
  const response = await requestJson<ScanStatusPayload>(config, context, "startScan", {});
  return normalizeScanStatus(response.scanStatus);
}

export async function getNavidromeScanStatus(config: ApiConfig, context?: NavidromeContext): Promise<NavidromeScanStatus> {
  const response = await requestJson<ScanStatusPayload>(config, context, "getScanStatus", {});
  return normalizeScanStatus(response.scanStatus);
}

export async function findNavidromeSongForIngestion(
  config: ApiConfig,
  ingestion: IngestionRecord,
  context?: NavidromeContext
): Promise<{ song: NavidromeSong; method: IngestionMatchMethod } | null> {
  const candidates = await searchIngestionCandidates(config, ingestion, context);
  if (!candidates.length) return null;

  const expectedPath = normalizeExpectedIngestionPath(ingestion, context);
  if (expectedPath) {
    const pathMatch = candidates.find((song) => normalizeLibraryPath(song.path || "") === expectedPath);
    if (pathMatch) return { song: pathMatch, method: "path" };
  }

  const expectedTitle = normalizeText(ingestion.title || path.basename(ingestion.relativeOutputPath || "", path.extname(ingestion.relativeOutputPath || "")));
  const expectedUploader = normalizeText(ingestion.uploader || "");
  if (expectedTitle && expectedUploader) {
    const titleArtistMatch = candidates.find((song) => (
      normalizeText(song.title) === expectedTitle &&
      normalizeText(song.artist || "").includes(expectedUploader)
    ));
    if (titleArtistMatch) return { song: titleArtistMatch, method: "title_artist" };
  }

  if (expectedTitle) {
    const titleMatch = candidates.find((song) => normalizeText(song.title) === expectedTitle);
    if (titleMatch) return { song: titleMatch, method: "title" };
  }

  return null;
}

export async function proxyNavidromeStream(
  config: ApiConfig,
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  context?: NavidromeContext
) {
  await proxyNavidromeBinary(config, context, "stream", { id: request.params.id }, request, reply);
}

export async function proxyNavidromeCover(
  config: ApiConfig,
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
  context?: NavidromeContext
) {
  await proxyNavidromeBinary(config, context, "getCoverArt", { id: request.params.id, size: "300" }, request, reply);
}

async function requestJson<T>(config: ApiConfig, context: NavidromeContext | undefined, endpoint: string, params: Record<string, string>) {
  const response = await fetch(buildUrl(config, context, endpoint, { ...params, f: "json" }));
  const body = await response.json() as SubsonicResponse<T>;
  const payload = body["subsonic-response"];

  if (!response.ok || payload.status !== "ok") {
    throw new Error(payload.error?.message || `Navidrome ${endpoint} failed`);
  }

  return payload;
}

async function proxyNavidromeBinary(
  config: ApiConfig,
  context: NavidromeContext | undefined,
  endpoint: string,
  params: Record<string, string>,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const headers: OutgoingHttpHeaders = {};
  const range = request.headers.range;
  if (range) headers.Range = range;

  const upstream = await requestNavidromeBinary(buildUrl(config, context, endpoint, params), headers);
  reply.hijack();
  reply.raw.statusCode = upstream.statusCode || 502;

  for (const header of ["accept-ranges", "content-length", "content-range", "content-type"] as const) {
    const value = upstream.headers[header];
    if (value) reply.raw.setHeader(header, value);
  }

  pipeline(upstream, reply.raw, (error) => {
    if (error && !reply.raw.destroyed) reply.raw.destroy(error);
  });
}

function requestNavidromeBinary(url: string, headers: OutgoingHttpHeaders): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const upstreamUrl = new URL(url);
    const transport = upstreamUrl.protocol === "https:" ? https : http;
    const upstreamRequest = transport.request(upstreamUrl, { headers, method: "GET" }, resolve);
    upstreamRequest.on("error", reject);
    upstreamRequest.end();
  });
}

function buildUrl(config: ApiConfig, context: NavidromeContext | undefined, endpoint: string, params: Record<string, string>) {
  const baseUrl = (context?.baseUrl || config.navidrome.baseUrl || "http://127.0.0.1:4533").replace(/\/+$/, "");
  const username = context?.username || config.navidrome.username || "";
  const password = context?.password || config.navidrome.password || "";

  if (!username || !password) {
    throw new Error("Navidrome username or password is not configured.");
  }

  const salt = crypto.randomBytes(8).toString("hex");
  const token = crypto.createHash("md5").update(`${password}${salt}`).digest("hex");
  const search = new URLSearchParams({
    u: username,
    t: token,
    s: salt,
    v: "1.16.1",
    c: "myusic",
    ...params
  });

  return `${baseUrl}/rest/${endpoint}.view?${search.toString()}`;
}

function normalizeArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function filterSongsByContext(songs: NavidromeSong[], context?: NavidromeContext) {
  if (context && !context.libraryId) return [];
  return songs;
}

async function searchIngestionCandidates(config: ApiConfig, ingestion: IngestionRecord, context?: NavidromeContext) {
  const basename = ingestion.relativeOutputPath
    ? path.basename(ingestion.relativeOutputPath, path.extname(ingestion.relativeOutputPath))
    : "";
  const queries = unique([ingestion.title || "", basename, ingestion.uploader || ""]).filter(Boolean);
  const songs: NavidromeSong[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const result = await getNavidromeSongs(config, query, context);
    for (const song of result.songs) {
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      songs.push(song);
    }
  }

  return songs;
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeLibraryPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function normalizeExpectedIngestionPath(ingestion: IngestionRecord, context?: NavidromeContext) {
  const relativePath = normalizeLibraryPath(ingestion.relativeOutputPath || "");
  if (!relativePath) return "";
  return relativePath;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeScanStatus(value: ScanStatusPayload["scanStatus"]): NavidromeScanStatus {
  return {
    scanning: Boolean(value?.scanning),
    count: typeof value?.count === "number" ? value.count : undefined
  };
}

function compareNavidromeSongs(left: NavidromeSong, right: NavidromeSong) {
  return compareSongText(left.title, right.title)
    || compareSongText(left.artist, right.artist)
    || compareSongText(left.album, right.album)
    || left.id.localeCompare(right.id);
}

function compareSongText(left = "", right = "") {
  return left.localeCompare(right, "zh-CN", { numeric: true, sensitivity: "base" });
}
