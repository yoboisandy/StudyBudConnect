import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isPrivate: { type: Boolean, default: false },
    joinRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    removedMembers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        removedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

groupSchema.virtual("memberCount").get(function () {
  return this.members.length;
});

groupSchema.set("toJSON", { virtuals: true });

const Group = mongoose.model("Group", groupSchema);
export default Group;
