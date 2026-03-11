import { Router } from "express";
import { getProfile } from "../../controller";
import { getAvatar, setAvatar, getAvatarsBatch } from "../../controller/profile";

const router = Router();

router.get("/", getProfile.getProfileData);
router.get("/get", getProfile.getProfileData);
router.get("/avatar", getAvatar);
router.post("/avatar", setAvatar);
router.get("/avatars", getAvatarsBatch);

export default router;
