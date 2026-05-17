import { Router, type IRouter } from "express";
import healthRouter from "./health";
import claudeRouter from "./claude";
import parseJobRouter from "./parse-job";

const router: IRouter = Router();

router.use(healthRouter);
router.use(claudeRouter);
router.use(parseJobRouter);

export default router;
