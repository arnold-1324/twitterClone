import React, { useState, useEffect } from "react";
import { Box, Image, Text } from "@chakra-ui/react";

const MediaThumbnail = ({ url }) => {
  const [mediaType, setMediaType] = useState("");

  // Detect the type of media from the URL
  useEffect(() => {
    const fetchMediaType = async () => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        const contentType = response.headers.get("Content-Type");

        if (contentType.includes("image")) {
          setMediaType("image");
        } else if (contentType.includes("video")) {
          setMediaType("video");
        } else if (contentType.includes("audio")) {
          setMediaType("audio");
        } else {
          setMediaType("unknown");
        }
      } catch (error) {
        console.error("Error fetching media type:", error);
        setMediaType("unknown");
      }
    };

    fetchMediaType();
  }, [url]);

  // Render media based on its type
  return (
    <Box maxW="300px" borderWidth="1px" borderRadius="md" overflow="hidden">
      {mediaType === "image" && <Image src={url} alt="Thumbnail" />}
      {mediaType === "video" && (
        <video width="100%" controls>
          <source src={url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}
      {mediaType === "audio" && (
        <Box p="4">
          <audio controls>
            <source src={url} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </Box>
      )}
      {mediaType === "unknown" && (
        <Text p="4" textAlign="center" fontSize="sm" color="gray.500">
          Unable to preview this content.
        </Text>
      )}
    </Box>
  );
};

export default MediaThumbnail;
