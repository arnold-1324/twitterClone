import React, { useEffect, useState, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import "./Lyrics.css"; // Import CSS for additional styling

const Lyrics = ({ lyrics, currentTime, isPlaying }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const lyricsRef = useRef(null);
  const currentLineRef = useRef(null);

  // Update the current line periodically
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentLine((prev) => (prev + 1) % lyrics.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, lyrics.length]);

  // Reset the current line when playback stops
  useEffect(() => {
    if (!isPlaying) {
      setCurrentLine(0);
    }
  }, [isPlaying]);

  // Scroll the container to show the current line
  useEffect(() => {
    if (currentLineRef.current && lyricsRef.current) {
      const container = lyricsRef.current;
      const currentLineElement = currentLineRef.current;

      // Calculate the scroll position to keep the current line at the top
      const scrollPosition =
        currentLineElement.offsetTop - container.offsetTop;

      container.scrollTo({
        top: scrollPosition,
        behavior: "smooth",
      });
    }
  }, [currentLine]);

  return (
    <Box
      mt={6}
      p={6}
      borderRadius="lg"
      overflowY="auto"
      boxShadow="xl"
      textAlign="center"
      className="lyrics-container"
      maxH="50vh"
      ref={lyricsRef} // Reference for scrolling
    >
      {lyrics.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: index === currentLine ? 1 : 0.3,
            scale: index === currentLine ? 1.1 : 1,
            y: index === currentLine ? 0 : 20,
          }}
          transition={{ duration: 0.5 }}
          ref={index === currentLine ? currentLineRef : null} // Reference for the current line
        >
          <Text
            fontSize="2xl"
            fontWeight={index === currentLine ? "bold" : "medium"}
            color={index === currentLine ? "white" : "gray.300"}
            textShadow="0px 0px 10px rgba(0, 0, 0, 0.8)"
            mb={4}
          >
            {line}
          </Text>
        </motion.div>
      ))}
    </Box>
  );
};

export default Lyrics;
