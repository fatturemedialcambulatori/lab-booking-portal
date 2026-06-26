import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examsRouter from "./exams";
import slotsRouter from "./slots";
import bookingsRouter from "./bookings";
import patientsRouter from "./patients";
import refertiRouter from "./referti";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examsRouter);
router.use(slotsRouter);
router.use(bookingsRouter);
router.use(patientsRouter);
router.use(refertiRouter);

export default router;
