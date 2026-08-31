import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import examsRouter from "./exams";
import slotsRouter from "./slots";
import bookingsRouter from "./bookings";
import patientsRouter from "./patients";
import refertiRouter from "./referti";
import ocrRouter from "./ocr";
import referenceRangesRouter from "./referenceRanges";
import adminSettingsRouter from "./adminSettings";
import infortunisticaRouter from "./infortunistica";
import cassaRouter from "./cassa";
import paymentsRouter from "./payments";
import fatturazioneRouter from "./fatturazione";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(examsRouter);
router.use(referenceRangesRouter);
router.use(slotsRouter);
router.use(bookingsRouter);
router.use(patientsRouter);
router.use(refertiRouter);
router.use(ocrRouter);
router.use(adminSettingsRouter);
router.use(infortunisticaRouter);
router.use(cassaRouter);
router.use(paymentsRouter);
router.use(fatturazioneRouter);

export default router;
