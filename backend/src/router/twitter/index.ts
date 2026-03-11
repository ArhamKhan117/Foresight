import { Router } from "express";
import { getTweet } from "../../controller/twitter";

const twitterRouter = Router();

twitterRouter.get("/tweet/:tweetId", getTweet);

export default twitterRouter;
