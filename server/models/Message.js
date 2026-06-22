import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    fileType: { type: String, enum: ["image", "video", "document"], required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "", trim: true },
    attachments: [attachmentSchema],
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
