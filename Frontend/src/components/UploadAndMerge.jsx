import React, { useState, useRef } from 'react';
import { Button, Slider, Text, Box, Image, Input } from '@chakra-ui/react';

const UploadAndMerge = () => {
  const [image, setImage] = useState(null);
  const [audio, setAudio] = useState(null);
  const [duration, setDuration] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const audioRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(URL.createObjectURL(file));
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setAudio(URL.createObjectURL(file));
      const audioElement = new Audio(URL.createObjectURL(file));
      audioElement.onloadedmetadata = () => {
        setDuration(audioElement.duration);
      };
    }
  };

  const handleDurationChange = (value) => {
    setDuration(value);
  };

  const mergeFiles = async () => {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('audio', audio);
    formData.append('duration', duration);

    const response = await fetch('/api/merge', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    setVideoUrl(data.videoUrl);
  };

  return (
    <Box>
      <Text fontSize="2xl" mb={4}>Upload and Merge</Text>
      <Input type="file" accept="image/*" onChange={handleImageUpload} mb={4} />
      {image && <Image src={image} alt="Preview" boxSize="200px" mb={4} />}
      <Input type="file" accept="audio/*" onChange={handleAudioUpload} mb={4} />
      {audio && (
        <Box mb={4}>
          <audio ref={audioRef} controls src={audio}></audio>
          <Slider
            value={duration}
            min={0}
            max={audioRef.current?.duration || 100}
            onChange={handleDurationChange}
            aria-label="duration-slider"
            mb={4}
          />
          <Text>Duration: {duration.toFixed(2)} seconds</Text>
        </Box>
      )}
      <Button colorScheme="blue" onClick={mergeFiles} mb={4}>
        Merge and Export
      </Button>
      {videoUrl && (
        <Box>
          <video controls src={videoUrl} width="400"></video>
          <a href={videoUrl} download="output.mp4">
            Download Video
          </a>
        </Box>
      )}
    </Box>
  );
};

export default UploadAndMerge;
