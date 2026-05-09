import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import reportsRouter from "./reports";
import myReportsRouter from "./myReports";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/waitlist", waitlistRouter);
router.use("/reports", reportsRouter);
router.use("/my-reports", myReportsRouter);

export default router;
