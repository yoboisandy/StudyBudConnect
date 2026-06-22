import Invitation from "../models/Invitation.js";
import Group from "../models/Group.js";

export const sendInvitation = async (req, res) => {
  try {
    const { groupId, inviteeId } = req.body;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: "Only members can invite" });
    }
    const inv = await Invitation.create({
      group: groupId,
      inviter: req.user._id,
      invitee: inviteeId,
    });
    await inv.populate(["group", "inviter", "invitee"]);
    res.status(201).json(inv);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Invitation already sent" });
    res.status(400).json({ message: err.message });
  }
};

export const getMyInvitations = async (req, res) => {
  try {
    const invitations = await Invitation.find({ invitee: req.user._id, status: "pending" })
      .populate("group", "name course")
      .populate("inviter", "name email avatar");
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const respondToInvitation = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "Status must be accepted or declined" });
    }
    const inv = await Invitation.findOne({ _id: req.params.id, invitee: req.user._id });
    if (!inv) return res.status(404).json({ message: "Invitation not found" });
    inv.status = status;
    await inv.save();
    if (status === "accepted") {
      await Group.findByIdAndUpdate(inv.group, {
        $addToSet: { members: req.user._id },
      });
    }
    res.json(inv);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
