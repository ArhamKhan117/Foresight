import { Router } from "express";
import { getComments, addComment } from "../../controller/comment";

const router = Router();

router.get("/get", getComments);
router.post("/add", addComment);

export default router;
