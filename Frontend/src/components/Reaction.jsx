import { useEffect, useState } from "react";
import {
  IconButton, Popover, PopoverBody, PopoverContent, PopoverTrigger, Portal, SimpleGrid, Wrap, useColorModeValue,
} from "@chakra-ui/react";
import { FiSmile } from "react-icons/fi";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import useShowToast from "../hooks/useShowToast";

const choices = [
  ["👍", "Thumbs up"], ["❤️", "Heart"], ["😂", "Laugh"], ["😮", "Surprised"], ["😢", "Sad"], ["😡", "Angry"],
];
const noReactions = [];
const viewportModifiers = [
  { name: "flip", options: { rootBoundary: "viewport", padding: 10 } },
  { name: "preventOverflow", options: { rootBoundary: "viewport", altAxis: true, tether: false, padding: 10 } },
];

export default function Reaction({ messageId, initialReactions = noReactions, onUpdateReactions }) {
  const [reactions, setReactions] = useState(initialReactions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const showToast = useShowToast();
  const surface = useColorModeValue("white", "#202832");
  const border = useColorModeValue("gray.200", "#394755");
  const hover = useColorModeValue("gray.100", "#334555");

  useEffect(() => setReactions(initialReactions), [initialReactions]);

  async function send(emoji) {
    setOpen(false);
    setLoading(true);
    try {
      const response = await apiFetch("/api/messages/reaction", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji }),
      });
      const data = await readApiJson(response);
      if (!response.ok || !Array.isArray(data.reactions)) {
        throw new Error(data.error || "Could not add a reaction.");
      }
      setReactions(data.reactions);
      onUpdateReactions?.(messageId, data.reactions);
    } catch (error) {
      showToast("Reaction unavailable", error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return <>
    {reactions.length > 0 && <Wrap spacing={1} aria-label="Reactions">
      {reactions.map((reaction, index) => (
        <span key={reaction._id || index}>{reaction.type}</span>
      ))}
    </Wrap>}
    <Popover isOpen={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)}
      placement="top" strategy="fixed" modifiers={viewportModifiers} isLazy>
      <PopoverTrigger>
        <IconButton alignSelf="flex-start" size="sm" variant="ghost" aria-label="Add reaction"
          icon={<FiSmile size={18} />} />
      </PopoverTrigger>
      <Portal>
        <PopoverContent aria-label="Message reactions" width="min(17rem, calc(100vw - 20px))"
          bg={surface} borderColor={border} rounded="xl" shadow="xl">
          <PopoverBody p={2}>
            <SimpleGrid columns={6} gap={1}>
              {choices.map(([emoji, label]) => (
                <IconButton key={emoji} variant="ghost" aria-label={label} title={label}
                  icon={<span aria-hidden="true">{emoji}</span>} minW={0} height="40px"
                  fontSize="1.16rem" _hover={{ bg: hover }} isDisabled={loading} onClick={() => send(emoji)} />
              ))}
            </SimpleGrid>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  </>;
}
