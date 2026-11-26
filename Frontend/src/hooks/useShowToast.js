import { useCallback } from "react";
import { useToast } from "@chakra-ui/react";

export default function useShowToast() {
  const toast = useToast();
  return useCallback((title, description, status) => {
    const id = `${status}:${description || title}`;
    if (!toast.isActive(id)) {
      toast({ id, title, description, status, duration: 5000, isClosable: true, position: "bottom-right" });
    }
  }, [toast]);
}
