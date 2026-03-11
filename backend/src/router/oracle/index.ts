import { Router } from "express";
import { oracle } from "../../controller";
import { proposeValidator } from "../../middleware/proposeValidator";

const router = Router();

// Legacy route (kept for compatibility)
router.post("/registFeed", proposeValidator, oracle.registFeed);

// OptimisticOracle routes
router.post("/request", oracle.requestResolution);
router.post("/propose", oracle.propose);
router.post("/dispute", oracle.dispute);
router.post("/settle", oracle.settle);
router.post("/resolve", oracle.resolve);
router.post("/finalize", oracle.finalize);
router.get("/status/:questionId", oracle.getOracleStatus);
router.get("/bond/:address", oracle.getBondAmount);

export default router;
