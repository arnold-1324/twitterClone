import { useRef, useState } from "react";
import { useToast } from "@chakra-ui/react";

export default function useShowToast() {
  const toast = useToast();
  const current = useRef(toast);
  current.current = toast;
  const [show] = useState(() => (title, description, status, position = "bottom-right") => {
    const id = `${status}:${description || title}`;
    if (!current.current.isActive(id)) {
      current.current({ id, title, description, status, duration: 5000, isClosable: true, position });
    }
  });
  return show;
}
