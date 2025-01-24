import React from "react";
import { Box, Image, Text, IconButton, Flex } from "@chakra-ui/react";
import { FaPlay, FaPause } from "react-icons/fa";
import "./SongCard.css"; // Import CSS for rotating animation

const SongCard = ({ song, isPlaying, onPlay }) => {
  return (
    <Box bg="gray.800" borderRadius="md" overflow="hidden" p={4} className="song-card">
      <Flex alignItems="center">
        <Image
          borderRadius="full"
          src={song.image}
          alt={song.title}
          width="24"
          height="24"
          className={isPlaying ? "rotating" : ""}
        />
        <Box ml={4}>
          <Text color="white" fontSize="lg" fontWeight="bold">
            {song.title}
          </Text>
          <Text color="gray.400">{song.subtitle}</Text>
        </Box>
        <IconButton
          ml="auto"
          colorScheme="green"
          aria-label="Play"
          icon={isPlaying ? <FaPause /> : <FaPlay />}
          onClick={onPlay}
        />
      </Flex>
    </Box>
  );
};

export default SongCard;
