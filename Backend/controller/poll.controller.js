import Message from "../models/message.model.js";
import Group from "../models/group.model.js";

// ✅ FIXED: order of parameters (req, res)
export const createPoll = async (req, res) => {
  try {
    const { conversationId, question, options, multiSelect, expiresAt } = req.body;
    const sender = req.user._id.toString();

    if (!question || !options || options.length < 2) {
      return res
        .status(400)
        .json({ message: "Poll must have a question and at least two options" });
    }

    const PollMessage = new Message({
      conversationId,
      sender,
      type: "poll",
      poll: {
        question,
        options: options.map((opt) => ({ optionText: opt, votes: [] })),
        multiSelect: !!multiSelect,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        totalVotes: 0,
        closed: false,
      },
    });

    const savedPoll = await PollMessage.save();

    await Group.findOneAndUpdate(
      { conversation: conversationId },
      { $push: { messages: savedPoll._id } }
    );

    return res
      .status(201)
      .json({ message: "Poll created successfully", poll: savedPoll });
  } catch (error) {
    console.error("Error creating poll:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const vote = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { selectedOptions } = req.body; // ✅ renamed correctly
    const userId = req.user._id.toString();

    if (!selectedOptions || selectedOptions.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one option must be selected" });
    }

    const pollMessage = await Message.findById(messageId);
    if (!pollMessage || pollMessage.type !== "poll") {
      return res.status(404).json({ message: "Poll not found" });
    }

    if (pollMessage.poll.closed) {
      return res.status(400).json({ message: "Poll is closed" });
    }

    if (pollMessage.poll.expiresAt && new Date() > pollMessage.poll.expiresAt) {
      return res.status(400).json({ message: "Poll has expired" });
    }

    const options = pollMessage.poll.options;

    // Remove user votes from all options first
    options.forEach((opt) => {
      opt.votes = opt.votes.filter((id) => id.toString() !== userId);
    });

    // Add votes according to multiSelect
    if (pollMessage.poll.multiSelect) {
      selectedOptions.forEach((index) => {
        if (options[index]) options[index].votes.push(userId);
      });
    } else {
      if (selectedOptions.length > 1)
        return res
          .status(400)
          .json({ message: "This poll only allows one vote." });

      const index = selectedOptions[0];
      if (options[index]) options[index].votes.push(userId);
    }

    pollMessage.poll.totalVotes = options.reduce(
      (sum, o) => sum + o.votes.length,
      0
    );

    await pollMessage.save();

    return res.status(200).json({ message: "Vote recorded.", poll: pollMessage });
  } catch (error) {
    console.error("Error voting in poll:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const closePoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const pollMessage = await Message.findById(messageId);

    if (!pollMessage || pollMessage.type !== "poll") {
      return res.status(404).json({ message: "Poll not found." });
    }

    pollMessage.poll.closed = true;
    await pollMessage.save();

    return res
      .status(200)
      .json({ message: "Poll closed.", poll: pollMessage });
  } catch (err) {
    console.error("Error closing poll:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
