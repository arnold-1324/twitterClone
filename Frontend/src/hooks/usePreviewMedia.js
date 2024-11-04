import { useState } from "react";
import useShowToast from "./useShowToast";

const usePreviewMedia = () => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const showToast = useShowToast();

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const MAX_SIZE = 7 * 1024 * 1024; 
      if (file.size > MAX_SIZE) {
          showToast("Error", "File size exceeds 2 MB limit.", "error");
          return;
      }
      if (file.type.startsWith("image/")) {
        previewFile(file, "image");
      } else if (file.type.startsWith("video/")) {
        previewFile(file, "video");
      } else if (file.type.startsWith("audio/")) {
        previewFile(file, "audio");
      } else {
        showToast("Invalid file type", "Please select an image, video, or audio file", "error");
        setMediaUrl(null);
        setMediaType(null);
      }
    }
  };

  const previewFile = (file, type) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaUrl(reader.result);
      setMediaType(type);
    };
    reader.readAsDataURL(file);
  };

  return { handleMediaChange, mediaUrl, mediaType, setMediaUrl, setMediaType };
};

export default usePreviewMedia;
