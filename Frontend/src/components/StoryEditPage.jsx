import React, { useState, useRef } from "react";
import {
  Box,
  Image,
  Input,
  Text,
  Button,
  IconButton,
  VStack,
  HStack,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  useToast,
} from "@chakra-ui/react";
import { FaMusic, FaTextHeight, FaDownload } from "react-icons/fa";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Howl } from "howler";

const StoryEditPage = () => {
  const [image, setImage] = useState(null);
  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const inputRef = useRef();
  const toast = useToast();

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  const addText = () => {
    setTexts([
      ...texts,
      {
        id: Date.now(),
        content: "New Text",
        x: 50,
        y: 50,
        fontSize: 16,
        fontColor: "#ffffff",
        bgColor: "transparent",
      },
    ]);
  };

  const updateTextContent = (id, content) => {
    setTexts(texts.map((text) => (text.id === id ? { ...text, content } : text)));
  };

  const handleDragStart = (id) => setSelectedTextId(id);

  const handleDrag = (e) => {
    if (selectedTextId !== null) {
      const rect = e.target.getBoundingClientRect();
      setTexts((prevTexts) =>
        prevTexts.map((text) =>
          text.id === selectedTextId
            ? {
                ...text,
                x: e.clientX - rect.width / 2,
                y: e.clientY - rect.height / 2,
              }
            : text
        )
      );
    }
  };

  const handleDragEnd = () => setSelectedTextId(null);

  const downloadStory = async () => {
    debugger;
    const canvas = await html2canvas(document.querySelector("#story-preview"));
    const imgData = canvas.toDataURL("image/png");
    saveAs(imgData, "story.png");
  };

  const postStory = () => {
    toast({
      title: "Story Posted!",
      description: "Your story has been posted successfully.",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    setImage(null);
    setTexts([]);
  };

  return (
    <VStack spacing={4} p={4}>
      <Box w="100%" textAlign="center">
        <Input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          ref={inputRef}
          display="none"
        />
        <Button onClick={() => inputRef.current.click()} colorScheme="blue">
          Upload Image
        </Button>
      </Box>

      {image && (
        <Box
          id="story-preview"
          position="relative"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="md"
          overflow="hidden"
          w="300px"
          h="500px"
        >
          <Image src={image} w="100%" h="100%" objectFit="cover" />
          {texts.map((text) => (
            <Box
              key={text.id}
              position="absolute"
              top={`${text.y}px`}
              left={`${text.x}px`}
              fontSize={`${text.fontSize}px`}
              color={text.fontColor}
              bg={text.bgColor}
              px={2}
              borderRadius="md"
              draggable
              onDragStart={() => handleDragStart(text.id)}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
            >
              <Input
                variant="unstyled"
                value={text.content}
                onChange={(e) => updateTextContent(text.id, e.target.value)}
                textAlign="center"
              />
            </Box>
          ))}
        </Box>
      )}

      <HStack spacing={4}>
        <IconButton
          aria-label="Add Text"
          icon={<FaTextHeight />}
          onClick={addText}
          colorScheme="blue"
        />
      </HStack>

      <Button colorScheme="green" onClick={postStory}>
        Post Story
      </Button>
      <Button colorScheme="blue" onClick={downloadStory} leftIcon={<FaDownload />}>
        Download Story
      </Button>
    </VStack>
  );
};

export default StoryEditPage;
