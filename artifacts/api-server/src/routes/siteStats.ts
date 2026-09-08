import { sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteStatsTable } from "@workspace/db";
import { GetSiteVisitorCountResponse, RecordSiteVisitResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const GLOBAL_KEY = "global";

async function ensureSiteStats() {
  const [row] = await db
    .insert(siteStatsTable)
    .values({ key: GLOBAL_KEY, visitorCount: 0 })
    .onConflictDoNothing()
    .returning();

  if (row) return row;
  const [existing] = await db.select().from(siteStatsTable);
  return existing ?? { key: GLOBAL_KEY, visitorCount: 0 };
}

router.get("/site/visitors", async (_req: Request, res: Response): Promise<void> => {
  const row = await ensureSiteStats();
  res.json(GetSiteVisitorCountResponse.parse({ count: row.visitorCount }));
});

router.post("/site/visitors/visit", async (_req: Request, res: Response): Promise<void> => {
  const [row] = await db
    .insert(siteStatsTable)
    .values({ key: GLOBAL_KEY, visitorCount: 1 })
    .onConflictDoUpdate({
      target: siteStatsTable.key,
      set: { visitorCount: sql`${siteStatsTable.visitorCount} + 1` },
    })
    .returning();

  res.json(RecordSiteVisitResponse.parse({ count: row?.visitorCount ?? 1 }));
});

export default router;