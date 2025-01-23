import { useState } from "react";
import { useToast } from "@chakra-ui/react";

const useDownloadSong = () => {
  const [showAnimation, setShowAnimation] = useState(false);
  const toast = useToast();

  const downloadSong = async (song) => {
    setShowAnimation(true);
    try {
      const response = await fetch(song.previewUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${song.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Error downloading song:", error);
      toast({
        title: "Download failed",
        description: `Failed to download ${song.title}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setTimeout(() => {
        setShowAnimation(false);
      }, 2000); 
    }
  };

  return { downloadSong, showAnimation };
};

export default useDownloadSong;
