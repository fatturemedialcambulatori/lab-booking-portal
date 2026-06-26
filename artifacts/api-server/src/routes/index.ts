import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examsRouter from "./exams";
import slotsRouter from "./slots";
import bookingsRouter from "./bookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examsRouter);
router.use(slotsRouter);
router.use(bookingsRouter);

export default router;
