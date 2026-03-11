import mongoose from "mongoose";

const UserProfileSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true, index: true },
  avatarUrl: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

const UserProfileModel = mongoose.model("userprofile", UserProfileSchema);

export default UserProfileModel;
