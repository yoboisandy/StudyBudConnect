import Group from "../models/Group.js";
import User from "../models/User.js";

export const createGroup = async (req, res) => {
  try {
    const { name, course, description, inviteeIds } = req.body;
    const group = await Group.create({
      name,
      course,
      description,
      createdBy: req.user._id,
      members: [req.user._id, ...(inviteeIds || [])],
    });
    await group.populate("members", "name email avatar");
    await group.populate("createdBy", "name email avatar");
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getGroups = async (req, res) => {
  try {
    const { course } = req.query;
    const filter = course ? { course: { $regex: course, $options: "i" } } : {};
    const groups = await Group.find(filter)
      .populate("members", "name email avatar")
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate("members", "name email avatar")
      .populate("createdBy", "name email avatar")
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "name email avatar accessibilityNeeds communicationPrefs")
      .populate("createdBy", "name email avatar");
    if (!group) return res.status(404).json({ message: "Group not found" });

    // Generate accessibility accommodation hints
    const allNeeds = group.members.flatMap((m) => m.accessibilityNeeds || []);
    const uniqueNeeds = [...new Set(allNeeds)];
    const hints = [];
    if (uniqueNeeds.includes("screen-reader"))
      hints.push("Use plain-text messages; avoid image-only content.");
    if (uniqueNeeds.includes("captions"))
      hints.push("Enable captions for any voice/video sessions.");
    if (uniqueNeeds.includes("high-contrast"))
      hints.push("Share content that works in high-contrast mode.");
    if (uniqueNeeds.includes("keyboard-nav"))
      hints.push("Ensure shared links and tools are keyboard-navigable.");

    res.json({ ...group.toJSON(), accessibilityHints: hints });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the owner can edit this group" });
    }
    const { name, course, description, isPrivate } = req.body;
    if (name !== undefined) group.name = name;
    if (course !== undefined) group.course = course;
    if (description !== undefined) group.description = description;
    if (isPrivate !== undefined) group.isPrivate = isPrivate;
    await group.save();
    await group.populate("members", "name email avatar");
    await group.populate("createdBy", "name email avatar");
    res.json(group);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.members.includes(req.user._id)) {
      return res.status(409).json({ message: "Already a member" });
    }
    if (group.isPrivate) {
      const alreadyRequested = group.joinRequests.some(
        (r) => r.user.toString() === req.user._id.toString()
      );
      if (alreadyRequested) {
        return res.status(409).json({ message: "Join request already sent" });
      }
      group.joinRequests.push({ user: req.user._id });
      await group.save();
      return res.status(202).json({ message: "Join request sent" });
    }
    group.members.push(req.user._id);
    await group.save();
    await group.populate("members", "name email avatar");
    res.json(group);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const removeMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the owner can remove members" });
    }
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "Owner cannot remove themselves" });
    }
    group.members = group.members.filter((m) => m.toString() !== userId);
    const alreadyRemoved = group.removedMembers.some((r) => r.user.toString() === userId);
    if (!alreadyRemoved) {
      group.removedMembers.push({ user: userId, removedAt: new Date() });
    }
    await group.save();
    res.json({ message: "Member removed" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getJoinRequests = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate(
      "joinRequests.user",
      "name email avatar"
    );
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the owner can view join requests" });
    }
    res.json(group.joinRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const respondToJoinRequest = async (req, res) => {
  try {
    const { userId, action } = req.body; // action: "accept" | "decline"
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the owner can respond to requests" });
    }
    const reqIdx = group.joinRequests.findIndex((r) => r.user.toString() === userId);
    if (reqIdx === -1) return res.status(404).json({ message: "Request not found" });

    group.joinRequests.splice(reqIdx, 1);
    if (action === "accept") {
      if (!group.members.includes(userId)) group.members.push(userId);
    }
    await group.save();
    await group.populate("members", "name email avatar");
    res.json({ message: action === "accept" ? "Member added" : "Request declined", group });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
