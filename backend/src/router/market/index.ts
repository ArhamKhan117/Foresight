import { Router } from "express";
import { market } from "../../controller";
import { proposeValidator } from "../../middleware/proposeValidator";

const router = Router();

router.post("/create", proposeValidator, market.create_market);
router.post("/add", market.additionalInfo);
router.post("/betting", market.betting);
router.post("/liquidity", market.addLiquidity);
router.get("/get", market.getMarketData);
router.post("/filter", market.getFilteredMarket);
router.post("/resolve", market.resolveMarket);
router.get("/recent", market.recentActivity);
router.get("/price-history", market.getPriceHistory);
router.get("/event-group", market.getEventGroup);
router.post("/create-multi-event", market.createMultiOutcomeEvent);
router.post("/fund-event", market.fundMultiOutcomeEvent);
router.post("/hcs-log", market.logHCSEvent);

export default router;
