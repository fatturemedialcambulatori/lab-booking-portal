import { Router, type IRouter } from "express";
import healthRouter from "./health";
import examsRouter from "./exams";
import slotsRouter from "./slots";
import bookingsRouter from "./bookings";
import patientsRouter from "./patients";
import refertiRouter from "./referti";
import ocrRouter from "./ocr";
import referenceRangesRouter from "./referenceRanges";

const router: IRouter = Router();

router.use(healthRouter);
router.use(examsRouter);
router.use(referenceRangesRouter);
router.use(slotsRouter);
router.use(bookingsRouter);
router.use(patientsRouter);
router.use(refertiRouter);
router.use(ocrRouter);

export default router;
