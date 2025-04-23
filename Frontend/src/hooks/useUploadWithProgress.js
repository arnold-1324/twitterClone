import { useState } from "react";

export default function useUploadWithProgress() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (url, formData, onSuccess, onError) => {
    setProgress(0);
    setIsUploading(true);
    setError(null);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress((event.loaded / event.total) * 100);
        }
      };
      xhr.onload = () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          onSuccess && onSuccess(JSON.parse(xhr.responseText));
        } else {
          setError(xhr.statusText);
          onError && onError(xhr.statusText);
        }
      };
      xhr.onerror = () => {
        setIsUploading(false);
        setError("Upload failed");
        onError && onError("Upload failed");
      };
      xhr.send(formData);
    } catch (err) {
      setIsUploading(false);
      setError(err.message);
      onError && onError(err.message);
    }
  };

  return { progress, isUploading, error, upload };
}
