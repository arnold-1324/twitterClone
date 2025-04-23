import React from "react";
import { Flex, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";

const TypingIndicator = ({ usernames = [] }) => {
    debugger;
  const dotColor = useColorModeValue("blue.500", "white"); 
  const waveColor = useColorModeValue("blue.400", "blue.200");

  return (
    <Flex align="center" gap={2} mt={2} mb={1}>
      {usernames.length > 0 && (
        <span
          style={{
            fontWeight: 500,
            color: waveColor,
            fontSize: "0.95em",
          }}
        >
          {usernames.join(", ")} {usernames.length === 1 ? "is" : "are"} typing
        </span>
      )}
      <Flex align="center" gap={1}>
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
              margin: "0 2px",
            }}
          />
        ))}
      </Flex>
    </Flex>
  );
};

export default TypingIndicator;
