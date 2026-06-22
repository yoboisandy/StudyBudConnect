import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "group_invite",          // user invited to join a group
  "join_request",          // owner: someone requested to join private group
  "invite_accepted",       // inviter: invitee accepted
  "invite_declined",       // inviter: invitee declined
  "join_request_accepted", // requester: owner approved
  "join_request_declined", // requester: owner declined
  "member_removed",        // member: removed from group
];

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    // flexible payload – consumers read groupId, invitationId, actorName, etc.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
