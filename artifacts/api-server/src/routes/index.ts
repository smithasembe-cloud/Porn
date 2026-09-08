import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import mediaRouter from "./media";
import siteStatsRouter from "./siteStats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(mediaRouter);
router.use(siteStatsRouter);

export default router;
