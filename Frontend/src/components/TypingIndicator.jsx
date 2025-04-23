import React from "react";
import { Box, Flex, useColorModeValue, Image } from "@chakra-ui/react";
import { motion } from "framer-motion";
import kitten from "../../public/kitten.png";

const TypingIndicator = ({ usernames = [] }) => {
  const dotColor     = useColorModeValue("blue.500", "white");
  const waveColor    = useColorModeValue("blue.400", "blue.200");

  return (
    <Box
      position="absolute"
      bottom={{ base: "-4px", md: "4px" }}      
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
      pointerEvents="none"
    >
      <Flex align="flex-end" justify="center" gap={2}>
     
        <Image
          src={kitten}
          alt="Kitten peeking"
          boxSize={{ base: "28px", md: "36px" }}
          objectFit="contain"
          style={{ transform: "scaleX(-1)" }}
        />

        
        <Flex
          align="flex-end"
          gap={1}
          mb={{ base: "2px", md: "6px" }}       
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 0.9,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "loop",
                delay: i * 0.15,
              }}
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: dotColor,
              }}
            />
          ))}
        </Flex>
      </Flex>

      
      {usernames.length > 0 && (
        <Box
          mt={1}
          fontSize="0.8em"
          textAlign="center"
          color={waveColor}
          fontWeight="medium"
          pointerEvents="auto"
        >
          {usernames.join(", ")} {usernames.length === 1 ? "is" : "are"} typing
        </Box>
      )}
    </Box>
  );
};

export default TypingIndicator;
