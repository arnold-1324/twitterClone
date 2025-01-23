import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Box, Button } from '@chakra-ui/react';

const ImageEditor = ({ }) => {
  const editorRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!editorRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
     
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(editorRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2, // Increase quality
        logging: false,
        onclone: (doc) => {
          // Ensure all elements are visible in the clone
          const clone = doc.querySelector('#editor-container');
          if (clone) {
            clone.style.overflow = 'visible';
            clone.style.height = 'auto';
          }
        }
      });
      
      // Convert to blob for better quality
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box>
      <Box
        id="editor-container"
        ref={editorRef}
        position="relative"
        width="100%"
        height="100%"
        overflow="hidden"
      >
        {/* ...existing editor content... */}
      </Box>
      <Button
        onClick={handleDownload}
        isLoading={isDownloading}
        loadingText="Downloading..."
        mt={4}
      >
        Download Image
      </Button>
    </Box>
  );
};

export default ImageEditor;
