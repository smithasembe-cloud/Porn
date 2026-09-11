import {
  CreateMediaBody,
  CreateMediaResponse,
  GetMediaParams,
  GetMediaResponse,
  ListMediaQueryParams,
  ListMediaResponse,
} from "@workspace/api-zod";
import { db, mediaTable } from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const execFileAsync = promisify(execFile);
const relatedCache = new Map<number, { expiresAt: number; items: RelatedImage[] }>();
const thumbnailRepairAttempts = new Set<number>();

type RelatedImage = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  source: string;
  width?: number;
  height?: number;
};

async function createVideoThumbnail(objectPath: string): Promise<string | null> {
  const source = await objectStorageService.getObjectEntityFile(objectPath);
  const [video] = await source.download();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "picha-pulse-"));
  const inputPath = path.join(tempDir, "source-video");
  const outputPath = path.join(tempDir, "poster.jpg");
  try {
    await fs.writeFile(inputPath, video);
    await execFileAsync("ffmpeg", ["-y", "-ss", "0", "-i", inputPath, "-frames:v", "1", "-q:v", "2", outputPath], { timeout: 30_000 });
    const poster = await fs.readFile(outputPath);
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const upload = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: poster });
    if (!upload.ok) throw new Error(`Poster upload failed with ${upload.status}`);
    return objectStorageService.normalizeObjectEntityPath(uploadURL);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureVideoThumbnail(row: typeof mediaTable.$inferSelect) {
  if (row.type !== "video" || row.thumbnailObjectPath || thumbnailRepairAttempts.has(row.id)) return row;
  thumbnailRepairAttempts.add(row.id);
  try {
    const thumbnailObjectPath = await createVideoThumbnail(row.objectPath);
    if (!thumbnailObjectPath) return row;
    await db.update(mediaTable).set({ thumbnailObjectPath }).where(eq(mediaTable.id, row.id));
    return { ...row, thumbnailObjectPath };
  } catch {
    return row;
  }
}

router.get("/media", async (req: Request, res: Response): Promise<void> => {
  const parsed = ListMediaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, q, limit, sort } = parsed.data;
  const filters = [];
  if (type !== "all") {
    filters.push(eq(mediaTable.type, type));
  }
  if (q?.trim()) {
    const search = `%${q.trim()}%`;
    filters.push(
      or(
        ilike(mediaTable.title, search),
        ilike(mediaTable.description, search),
        ilike(mediaTable.location, search),
      ),
    );
  }

  const rows = await db
    .select()
    .from(mediaTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(sort === "trending" ? desc(mediaTable.views) : desc(mediaTable.createdAt), desc(mediaTable.createdAt))
    .limit(limit);

  const hydratedRows = await Promise.all(rows.map(ensureVideoThumbnail));
  res.json(ListMediaResponse.parse(hydratedRows));
});

router.post("/media", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateMediaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let thumbnailObjectPath = parsed.data.thumbnailObjectPath ?? null;
  if (parsed.data.type === "video" && !thumbnailObjectPath) {
    try {
      thumbnailObjectPath = await createVideoThumbnail(parsed.data.objectPath);
    } catch (error) {
      req.log.warn({ err: error, objectPath: parsed.data.objectPath }, "Could not generate video poster");
    }
  }

  const [row] = await db
    .insert(mediaTable)
    .values({
      ...parsed.data,
      thumbnailObjectPath,
      description: parsed.data.description ?? "",
      location: parsed.data.location ?? "Kenya",
      uploaderName:
        parsed.data.uploaderName ??
        ([req.user.firstName, req.user.lastName].filter(Boolean).join(" ") ||
          req.user.email ||
          "Picha community"),
    })
    .returning();

  res.status(201).json(CreateMediaResponse.parse(row));
});

router.get("/media/:id/related", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid media id" });
    return;
  }
  const cached = relatedCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ items: cached.items });
    return;
  }

  const [media] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!media) {
    res.status(404).json({ error: "Media not found" });
    return;
  }

  const searchTerms = [media.title, media.location, media.description, "Kenya"]
    .filter((value) => value?.trim())
    .join(" ");
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const offset = (hourBucket * 4) % 16;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: searchTerms,
    gsrnamespace: "6",
    gsrlimit: "20",
    gsroffset: String(offset),
    prop: "imageinfo|info",
    iiprop: "url|mime|size",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "PichaPulse/1.0 related-media" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Wikimedia returned ${response.status}`);
    const payload = await response.json() as {
      query?: { pages?: Record<string, { title?: string; fullurl?: string; imageinfo?: Array<{ thumburl?: string; url?: string; mime?: string; thumbwidth?: number; thumbheight?: number }> }> };
    };
    const items = Object.values(payload.query?.pages ?? {})
      .map((page): RelatedImage | null => {
        const info = page.imageinfo?.[0];
        const imageUrl = info?.thumburl || info?.url;
        if (!imageUrl || !info?.mime?.startsWith("image/")) return null;
        return {
          title: (page.title || "Related image").replace(/^File:/, ""),
          imageUrl,
          sourceUrl: page.fullurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`,
          source: "Wikimedia Commons",
          width: info.thumbwidth,
          height: info.thumbheight,
        };
      })
      .filter((item): item is RelatedImage => Boolean(item))
      .slice(0, 4);
    relatedCache.set(id, { expiresAt: Date.now() + 3_600_000, items });
    res.json({ items });
  } catch (error) {
    req.log.warn({ err: error, mediaId: id }, "Related image search unavailable");
    res.json({ items: [] });
  }
});

router.get("/media/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetMediaParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(mediaTable)
    .where(eq(mediaTable.id, parsed.data.id));

  if (!row) {
    res.status(404).json({ error: "Media not found" });
    return;
  }

  await db
    .update(mediaTable)
    .set({ views: row.views + 1 })
    .where(eq(mediaTable.id, row.id));

  const hydratedRow = await ensureVideoThumbnail({ ...row, views: row.views + 1 });
  res.json(GetMediaResponse.parse(hydratedRow));
});

export default router;