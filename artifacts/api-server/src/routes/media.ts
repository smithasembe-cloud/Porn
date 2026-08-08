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

const router: IRouter = Router();

router.get("/media", async (req: Request, res: Response): Promise<void> => {
  const parsed = ListMediaQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, q, limit } = parsed.data;
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
    .orderBy(desc(mediaTable.createdAt))
    .limit(limit);

  res.json(ListMediaResponse.parse(rows));
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

  const [row] = await db
    .insert(mediaTable)
    .values({
      ...parsed.data,
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

  res.json(GetMediaResponse.parse({ ...row, views: row.views + 1 }));
});

export default router;