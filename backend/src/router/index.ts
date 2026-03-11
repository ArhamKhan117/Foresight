import { Router } from "express";
import marketRouter from "./market";
import oracleRouter from "./oracle";
import referralRouter from "./referral";
import profileRouter from "./profile";
import twitterRouter from "./twitter";
import commentRouter from "./comment";

const router = Router();

router.use("/market", marketRouter);
router.use("/oracle", oracleRouter);
router.use("/referral", referralRouter);
router.use("/profile", profileRouter);
router.use("/twitter", twitterRouter);
router.use("/comment", commentRouter);

export default router;
