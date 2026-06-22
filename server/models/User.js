import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    slots: [{ type: String, enum: ["morning", "afternoon", "evening"] }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    googleId: { type: String, sparse: true },
    avatar: { type: String },
    courses: [{ type: String, trim: true }],
    learningStyle: {
      type: String,
      enum: ["visual", "auditory", "reading-writing", "kinesthetic", "mixed"],
    },
    availability: [availabilitySchema],
    accessibilityNeeds: [
      {
        type: String,
        enum: ["screen-reader", "captions", "keyboard-nav", "high-contrast", "none"],
      },
    ],
    communicationPrefs: [
      {
        type: String,
        enum: ["text-chat", "voice", "video", "async"],
      },
    ],
    profileComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
