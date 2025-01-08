import React, { useState } from 'react';
import { Box, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { FaSmile } from 'react-icons/fa';
import useShowToast from "../hooks/useShowToast";

const Reaction = ({ messageId }) => {
  const [openEmojiPicker, setOpenEmojiPicker] = useState(null);
  const showToast = useShowToast();
  const toggleEmojiPicker = (id) => {
    setOpenEmojiPicker((prev) => (prev === id ? null : id));
  };

  const emojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

  const bgColor = useColorModeValue("white", "gray.800");
  const boxShadow = useColorModeValue("lg", "md");

  const handleEmojiClick = async (messageId, emoji) => {
    try {
      const response = await fetch("/api/messages/reaction", {
        method: "PUT",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messageId, emoji  }),
      });

      if (!response.ok) {
        throw new Error('Error reacting to message');
      }

      showToast({
        type: "success",
        title: "Reaction added",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: error.message,
      });
    }
  };

return (
  <div>
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
              handleEmojiClick({ messageId, emoji });
              toggleEmojiPicker(messageId);
            }}
            className="text-2xl hover:scale-110 transition transform"
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