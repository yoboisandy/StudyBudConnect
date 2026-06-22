import Message from "../models/Message.js";
import Group from "../models/Group.js";

export const getMessages = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: "Not a member of this group" });
    }
    const messages = await Message.find({ group: req.params.groupId })
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 })
      .limit(100);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
