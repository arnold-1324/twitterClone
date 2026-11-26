import { refreshSession } from "../lib/apiFetch.js";
import { useState } from "react";

export default function useUploadWithProgress() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (url, formData, onSuccess, onError, retried = false) => {
    setProgress(0);
    setIsUploading(true);
    setError(null);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.timeout = 45000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress((event.loaded / event.total) * 100);
        }
      };
      const fail = (message) => {
        setIsUploading(false);
        setError(message);
        onError?.(message);
      };
      xhr.onload = async () => {
        if (xhr.status === 401 && !retried && await refreshSession().catch(() => false)) {
          return upload(url, formData, onSuccess, onError, true);
        }
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          fail("The server returned an unreadable response.");
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          setIsUploading(false);
          onSuccess?.(data);
        } else {
          fail(data.error || data.message || "Upload failed.");
        }
      };
      xhr.onerror = () => fail("Could not connect to the server.");
      xhr.ontimeout = () => fail("The upload timed out.");
      xhr.onabort = () => fail("The upload was canceled.");
      xhr.send(formData);
    } catch (err) {
      setIsUploading(false);
      setError(err.message);
      onError && onError(err.message);
    }
  };

  return { progress, isUploading, error, upload };
}
