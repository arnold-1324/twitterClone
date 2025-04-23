import React, { useState } from "react";
import { Box, useColorModeValue } from "@chakra-ui/react";
import { FaSmile } from "react-icons/fa";
import useShowToast from "../hooks/useShowToast";

const Reaction = ({ messageId, initialReactions = [], onUpdateReactions }) => {
  const [reactions, setReactions] = useState(initialReactions);
  const [openEmojiPicker, setOpenEmojiPicker] = useState(null);
  const [loading, setLoading] = useState(false);
  const showToast = useShowToast();

  const emojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];
  const bgColor = useColorModeValue("white", "gray.800");
  const boxShadow = useColorModeValue("lg", "md");

  const toggleEmojiPicker = (id) => {
    setOpenEmojiPicker((prev) => (prev === id ? null : id));
  };

  const handleEmojiClick = async (messageId, emoji) => {
    setLoading(true);

    try {
      console.log(`Sending reaction "${emoji}" for message ID: ${messageId}`); 

      const response = await fetch("/api/messages/reaction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });

      if (!response.ok) throw new Error("Error reacting to message");

      const updatedMessage = await response.json();

      console.log("API Response:", updatedMessage); 
      showToast("Success", "Reaction added", "success");

      if (!Array.isArray(updatedMessage.reactions)) {
        throw new Error("API returned invalid reactions data");
      }

     
      setReactions(updatedMessage.reactions);

      
      if (onUpdateReactions) {
        onUpdateReactions(messageId, updatedMessage.reactions);
      }
    } catch (error) {
      console.error("Error handling reaction:", error);
      showToast("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
     
      <div>
        {reactions.map((reaction, index) => (
          <span key={reaction._id || index} style={{ marginRight: "8px" }}>
            {reaction.type}
          </span>
        ))}
      </div>

     
      <FaSmile
        className="text-2xl cursor-pointer hover:text-gray-600 transition"
        onClick={() => toggleEmojiPicker(messageId)}
      />

      {openEmojiPicker === messageId && (
        <Box
          className="absolute top-12 left-0 z-50 p-4 rounded-lg flex space-x-3"
          bg={bgColor}
          boxShadow={boxShadow}
          style={{ borderRadius: "16px" }}
        >
          {emojis.map((emoji, index) => (
            <button
              key={index}
              onClick={() => {
                if (!loading) handleEmojiClick(messageId, emoji);
                toggleEmojiPicker(messageId);
              }}
              className={`text-2xl hover:scale-110 transition transform ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={loading}
            >
              {emoji}
            </button>
          ))}
        </Box>
      )}
    </div>
  );
};

export default Reaction;
