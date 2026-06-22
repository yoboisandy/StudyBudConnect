import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    inviter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invitee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  },
  { timestamps: true }
);

invitationSchema.index({ group: 1, invitee: 1 }, { unique: true });

const Invitation = mongoose.model("Invitation", invitationSchema);
export default Invitation;
