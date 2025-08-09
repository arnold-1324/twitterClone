import { Button } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaPlus } from "react-icons/fa";

// Pulse animation for click feedback
const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0.7); }
  50% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(72, 187, 120, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(72, 187, 120, 0); }
`;

export default function CreateGroupButton({ onClick }) {
  return (
    <Button
      leftIcon={<FaPlus />}
      size="lg"
      colorScheme="teal"
      bgGradient="linear(to-r, teal.400, green.400)"
      _hover={{
        bgGradient: "linear(to-r, teal.500, green.500)",
        transform: "translateY(-2px)",
        boxShadow: "lg",
      }}
      _active={{
        animation: `${pulse} 0.4s ease-in-out`,
        transform: "scale(0.97)",
      }}
      transition="all 0.2s ease"
      borderRadius="full"
      fontWeight="bold"
      px={6}
      onClick={onClick}
    >
      Create Group
    </Button>
  );
}
