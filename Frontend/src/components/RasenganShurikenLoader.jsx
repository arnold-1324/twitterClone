import { Box, Flex, Text } from "@chakra-ui/react";

const RasenganShurikenLoader = ({ text = "Unleashing Rasenshuriken..." }) => {
  return (
    <Flex direction="column" justify="center" align="center" my={6}>
      <Box position="relative" w="120px" h="120px">
        {/* Core Orb */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          w="50px"
          h="50px"
          borderRadius="full"
          bgGradient="radial(cyan.200, cyan.500)"
          transform="translate(-50%, -50%)"
          boxShadow="0 0 40px 20px rgba(0, 255, 255, 0.7), 0 0 80px 40px rgba(0, 180, 255, 0.4)"
          animation="pulse 1.2s ease-in-out infinite"
        />

        {/* Chakra Aura Ring */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          w="100px"
          h="100px"
          borderRadius="full"
          border="2px solid rgba(0,255,255,0.5)"
          transform="translate(-50%, -50%)"
          animation="aura-spin 3s linear infinite"
          filter="blur(2px)"
        />

        {/* Shuriken Blades */}
        {["0", "90", "180", "270"].map((angle, i) => (
          <Box
            key={i}
            position="absolute"
            top="50%"
            left="50%"
            w="0"
            h="0"
            borderLeft="15px solid transparent"
            borderRight="15px solid transparent"
            borderBottom="40px solid rgba(0, 255, 255, 0.9)"
            filter="drop-shadow(0 0 15px cyan)"
            transform={`translate(-50%, -50%) rotate(${angle}deg)`}
            transformOrigin="center"
          />
        ))}

        {/* Orbiting Particles */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Box
            key={i}
            position="absolute"
            top="50%"
            left="50%"
            w="6px"
            h="6px"
            bg="cyan.300"
            borderRadius="full"
            boxShadow="0 0 10px 3px rgba(0,255,255,0.6)"
            animation={`particle-spin-${i} 2s linear infinite`}
          />
        ))}
      </Box>

      {/* Loading text */}
      <Text mt={3} fontSize="sm" fontWeight="bold" color="cyan.400">
        {text}
      </Text>
    </Flex>
  );
};

export default RasenganShurikenLoader;

// Inject animations
const styles = `
@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; }
}

@keyframes aura-spin {
  0% { transform: translate(-50%, -50%) rotate(0deg); }
  100% { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Particles orbiting */
${Array.from({ length: 8 })
  .map(
    (_, i) => `
@keyframes particle-spin-${i} {
  0% { transform: rotate(${i * 45}deg) translateX(50px) rotate(-${i * 45}deg); }
  100% { transform: rotate(${i * 45 + 360}deg) translateX(50px) rotate(-${
      i * 45 + 360
    }deg); }
}`
  )
  .join("\n")}
`;

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = styles;
  document.head.appendChild(style);
}
