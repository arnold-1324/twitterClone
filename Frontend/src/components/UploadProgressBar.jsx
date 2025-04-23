import { Box, Flex, Text, Progress, useColorModeValue, Icon } from "@chakra-ui/react";
import { FaCloudUploadAlt } from "react-icons/fa";

const UploadProgressBar = ({ progress = 0, fileName = "", label = "Uploading..." }) => {
  const barColor = useColorModeValue("linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)", "linear-gradient(90deg, #818cf8 0%, #f472b6 100%)");
  return (
    <Flex
      align="center"
      gap={3}
      w="full"
      px={4}
      py={2}
      borderRadius="xl"
      bg={useColorModeValue("white", "gray.800")}
      boxShadow="lg"
      position="relative"
      zIndex={100}
      mb={2}
    >
      <Icon as={FaCloudUploadAlt} boxSize={7} color="blue.400" />
      <Box flex={1}>
        <Text fontSize="sm" fontWeight="bold" mb={1} color="blue.500">
          {label} {fileName && <span style={{ color: '#64748b' }}>({fileName})</span>}
        </Text>
        <Progress
          value={progress}
          size="md"
          borderRadius="md"
          hasStripe
          isAnimated
          sx={{
            ".chakra-progress__filledTrack": {
              background: barColor,
            },
          }}
        />
      </Box>
      <Text fontSize="sm" color="gray.500" minW="40px" textAlign="right">
        {Math.round(progress)}%
      </Text>
    </Flex>
  );
};

export default UploadProgressBar;
