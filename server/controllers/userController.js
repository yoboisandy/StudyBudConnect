import User from "../models/User.js";

export const getProfile = async (req, res) => {
  res.json(req.user);
};

export const updateProfile = async (req, res) => {
  try {
    const { name, courses, learningStyle, availability, accessibilityNeeds, communicationPrefs } =
      req.body;
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        name,
        courses,
        learningStyle,
        availability,
        accessibilityNeeds,
        communicationPrefs,
        profileComplete: true,
      },
      { new: true, runValidators: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Rule-based matching: same courses + overlapping availability
export const getMatches = async (req, res) => {
  try {
    const me = req.user;
    if (!me.courses?.length) {
      return res.json([]);
    }
    const candidates = await User.find({
      _id: { $ne: me._id },
      courses: { $in: me.courses },
      profileComplete: true,
    }).limit(20);

    const scored = candidates.map((u) => {
      const sharedCourses = u.courses.filter((c) => me.courses.includes(c));
      const myDays = me.availability?.map((a) => a.day) || [];
      const theirDays = u.availability?.map((a) => a.day) || [];
      const overlapDays = myDays.filter((d) => theirDays.includes(d)).length;
      return { user: u, score: sharedCourses.length * 10 + overlapDays };
    });

    scored.sort((a, b) => b.score - a.score);
    res.json(scored.map((s) => s.user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .select("name email avatar")
      .limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
