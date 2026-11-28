import { stickerLabel } from "../lib/stickers";
import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Avatar, Button, IconButton, Menu, MenuButton, MenuItem, MenuList, Portal, Spinner } from "@chakra-ui/react";
import { FiArchive, FiBookmark, FiEdit3, FiMessageCircle, FiMoreHorizontal, FiUsers } from "react-icons/fi";
import { LuPin, LuPinOff } from "react-icons/lu";
import { useEffect, useRef, useState } from "react";
import { useAppState, useAppValue, useSetAppValue } from "../state/store";
import MessageContainer from "../components/MessageContainer";
import PeopleSearch from "../components/PeopleSearch";
import NotesShelf from "../components/NotesShelf";
import GroupUIComponents from "../components/GroupUIComponents";
import { conversationsAtom, mergeConversationPreference, mergeConversationTheme, messagesAtom, selectedConversationAtom } from "../atom/messagesAtom";
import userAtom from "../atom/userAtom";
import { useSocket } from "../context/SocketContext";
import usePresence from "../hooks/usePresence";
import useShowToast from "../hooks/useShowToast";
import { useLocation, useNavigate } from "react-router-dom";
import inboxUnreadAtom from "../atom/inboxUnreadAtom";

function conversationDetails(conversation) {
  const person = conversation.participants?.[0];
  return {
    ...conversation,
    username: conversation.isGroup ? conversation.groupInfo?.name || "Group" : person?.username || "Unavailable",
    userId: conversation.isGroup ? undefined : person?._id,
    userProfilePic: conversation.isGroup ? conversation.groupInfo?.profileImage : person?.profileImg,
  };
}

export default function ChatPage() {
  const [selected, setSelected] = useAppState(selectedConversationAtom);
  const [conversations, setConversations] = useAppState(conversationsAtom);
  const setMessages = useSetAppValue(messagesAtom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [groupOpen, setGroupOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inboxTools = useRef(null);
  const currentUser = useAppValue(userAtom);
  const { byConversation: unread } = useAppValue(inboxUnreadAtom);
  const { state } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!state?.noteReply) return;
    const { conversationId, author } = state.noteReply;
    setSelected(conversationDetails({ _id: conversationId, participants: [author] }));
    navigate("/chat", { replace: true });
  }, [state, navigate, setSelected]);
  const { socket } = useSocket();
  const presence = usePresence();
  const laterKey = `dayline-later:${currentUser._id}`;
  const [later, setLater] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(laterKey));
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "string").slice(0, 100) : [];
    } catch {
      return [];
    }
  });
  const [view, setView] = useState("inbox");
  const [pendingPreferences, setPendingPreferences] = useState({});
  const showToast = useShowToast();

  async function changePreference(chat, change) {
    setPendingPreferences((current) => ({ ...current, [chat._id]: true }));
    try {
      const response = await apiFetch(`/api/messages/${chat._id}/preference`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change),
      });
      const data = await readApiJson(response);
      if (!response.ok) throw new Error(data.error || "Could not update the conversation.");
      setConversations((current) => current.map((item) =>
        item._id === chat._id ? mergeConversationPreference(item, data.preference) : item));
      if (change.archived) setSelected((current) => current._id === chat._id ? {} : current);
    } catch (error) {
      showToast("Conversation settings", error.message, "error");
    } finally {
      setPendingPreferences((current) => ({ ...current, [chat._id]: false }));
    }
  }

  function toggleLater(id) {
    const next = later.includes(id) ? later.filter((item) => item !== id) : [id, ...later].slice(0, 100);
    setLater(next);
    try { localStorage.setItem(laterKey, JSON.stringify(next)); } catch { /* Keep the current tab usable. */ }
  }


  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let latest = 0;
    async function load() {
      const version = ++latest;
      try {
        const response = await apiFetch("/api/messages/getConvo/user", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load conversations.");
        const items = await readApiJson(response);
        if (version !== latest || controller.signal.aborted) return;
        setConversations((current) => {
          const previous = new Map(current.map((chat) => [chat._id, chat]));
          return items.map((chat) => {
            const prior = previous.get(chat._id);
            return mergeConversationPreference(mergeConversationTheme(chat, prior), prior?.preference);
          });
        });
        setError("");
      } catch (error) {
        if (!controller.signal.aborted && version === latest) setError(error.message);
      } finally {
        if (!controller.signal.aborted && version === latest) setLoading(false);
      }
    }
    function scheduleRefresh() {
      clearTimeout(timer);
      timer = setTimeout(load, 140);
    }
    load();
    const events = ["connect", "newMessage", "newGroupMessage", "groupCreated", "messageEdited"];
    events.forEach((event) => socket?.on(event, scheduleRefresh));
    function updateTheme(theme) {
      setConversations((current) => current.map((chat) => chat._id === theme.conversationId
        ? mergeConversationTheme(chat, theme) : chat));
      setSelected((chat) => chat._id === theme.conversationId ? mergeConversationTheme(chat, theme) : chat);
    }
    socket?.on("conversationThemeChanged", updateTheme);
    function updatePreference({ conversationId, preference }) {
      setConversations((current) => current.map((chat) => chat._id === conversationId
        ? mergeConversationPreference(chat, preference) : chat));
    }
    socket?.on("conversationPreferenceChanged", updatePreference);
    return () => {
      clearTimeout(timer);
      controller.abort();
      events.forEach((event) => socket?.off(event, scheduleRefresh));
      socket?.off("conversationThemeChanged", updateTheme);
      socket?.off("conversationPreferenceChanged", updatePreference);
    };
  }, [socket, currentUser._id, setConversations, setSelected, refresh]);

  function startConversation(person) {
    const existing = conversations.find((chat) => !chat.isGroup && chat.participants?.[0]?._id === person._id);
    setSelected(conversationDetails(existing ?? { _id: `draft:${person._id}`, mock: true, participants: [person] }));
  }

  function openNoteReply(message, author) {
    const id = message.conversationId;
    const existing = conversations.find(({ _id }) => _id === id);
    const chat = { ...(existing ?? { _id: id, participants: [author] }), lastMessage: message, updatedAt: message.createdAt };
    setConversations((current) => [chat, ...current.filter(({ _id }) => _id !== id)]);
    if (selected._id === id) {
      setMessages((items) => items.some(({ _id }) => _id === message._id) ? items : [...items, message]);
    }
    setSelected(conversationDetails(chat));
  }

  const rows = conversations.map(conversationDetails).filter(({ _id, username, preference }) =>
    (view === "archived" ? preference?.archived : !preference?.archived)
    && (view !== "later" || later.includes(_id)) && username.toLowerCase().includes(filter.trim().toLowerCase()))
    .sort((first, second) => Number(Boolean(second.preference?.pinned)) - Number(Boolean(first.preference?.pinned))
      || Number(Boolean(unread[second._id])) - Number(Boolean(unread[first._id]))
      || (Date.parse(second.updatedAt) || 0) - (Date.parse(first.updatedAt) || 0));
  return (
    <main className={`inbox-layout ${selected._id ? "inbox-has-selection" : ""}`}>
      <aside className="inbox-sidebar" aria-label="Conversations">
        <div className="inbox-tools" ref={inboxTools}>
          <div className="inbox-heading">
            <h1>Inbox</h1>
            <Button size="sm" leftIcon={<FiUsers />} onClick={() => setGroupOpen(true)}>New group</Button>
          </div>
          <PeopleSearch label="Find someone to message" onSelect={startConversation} />
        </div>
        <NotesShelf user={currentUser} onReply={openNoteReply} />
        <div className="inbox-list">
          <label className="inbox-filter">
            <span>Conversations</span>
            <input type="search" placeholder="Filter" aria-label="Filter conversations" value={filter}
              onChange={(event) => setFilter(event.target.value)} />
          </label>
          <div className="inbox-views" aria-label="Conversation views">
            <button type="button" className="inbox-later-filter" aria-pressed={view === "inbox"} onClick={() => setView("inbox")}>All</button>
            <button type="button" className="inbox-later-filter" aria-pressed={view === "later"} onClick={() => setView("later")}>
              <FiBookmark /> Later
            </button>
            <button type="button" className="inbox-later-filter" aria-pressed={view === "archived"} onClick={() => setView("archived")}>
              <FiArchive /> Archived
            </button>
          </div>
          {loading && <Spinner size="sm" aria-label="Loading conversations" />}
          {error && <p role="alert">{error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></p>}
          {!loading && !error && !rows.length && <p className="inbox-muted">{filter ? "No matching conversations."
            : { inbox: "Your chats will appear here.", later: "Nothing saved for later.", archived: "No archived conversations." }[view]}</p>}
          {rows.map((chat) => {
            const status = chat.isGroup ? {} : presence(chat.participants?.[0]);
            const unreadCount = unread[chat._id] || 0;
            return (
            <div key={chat._id} className="inbox-entry" data-unread={unreadCount > 0}>
            <button type="button" className="inbox-row" aria-pressed={selected._id === chat._id}
              onClick={() => setSelected(chat)}>
              <span className="presence-avatar">
                <Avatar size="md" name={chat.username} src={chat.userProfilePic} icon={chat.isGroup ? <FiUsers /> : undefined} />
                {status.online && <span className="presence-dot" role="img" aria-label="Active now" />}
              </span>
              <span className="inbox-row-details">
                <strong>{chat.preference?.pinned && <LuPin className="inbox-pin" aria-label="Pinned" />}{chat.username}</strong>
                <small>{chat.lastMessage?.mentionedUsers?.includes(currentUser._id) && <b className="inbox-mention">Mentioned you · </b>}
                  {stickerLabel(chat.lastMessage?.text) || chat.lastMessage?.text || (chat.isGroup ? `${chat.participants.length} members` : status.label || "Direct message")}</small>
              </span>
              {unreadCount > 0 && <span className="inbox-unread-count" aria-label={`${unreadCount} unread messages`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>}
            </button>
            <Menu placement="bottom-end" isLazy>
              <MenuButton as={IconButton} variant="ghost" size="sm" icon={<FiMoreHorizontal />}
                isDisabled={pendingPreferences[chat._id]} aria-label={`Conversation options for ${chat.username}`} />
              <Portal><MenuList>
                <MenuItem icon={chat.preference?.pinned ? <LuPinOff /> : <LuPin />}
                  onClick={() => changePreference(chat, { pinned: !chat.preference?.pinned })}>
                  {chat.preference?.pinned ? "Unpin chat" : "Pin chat"}
                </MenuItem>
                <MenuItem icon={<FiArchive />} onClick={() => changePreference(chat, { archived: !chat.preference?.archived })}>
                  {chat.preference?.archived ? "Restore to inbox" : "Archive chat"}
                </MenuItem>
                <MenuItem icon={<FiBookmark />} onClick={() => toggleLater(chat._id)}>
                  {later.includes(chat._id) ? "Remove from Later" : "Save for later"}
                </MenuItem>
              </MenuList></Portal>
            </Menu>
            </div>
            );
          })}
        </div>
      </aside>
      <section className="inbox-thread" aria-label="Message thread">
        {selected._id ? (
          <MessageContainer key={selected.userId || selected.groupId || selected._id}
            isMobileView setSelectedConversation={setSelected} />
        ) : (
          <div className="inbox-empty">
            <span><FiMessageCircle /></span>
            <h2>Start a conversation</h2>
            <p>Find someone or choose a chat from your inbox.</p>
            <Button size="sm" leftIcon={<FiEdit3 />} onClick={() => inboxTools.current?.querySelector('input[type="search"]')?.focus()}>
              Find a person
            </Button>
          </div>
        )}
      </section>
      <GroupUIComponents isOpen={groupOpen} onClose={() => setGroupOpen(false)} mode="create"
        onCreated={(chat) => setSelected(conversationDetails(chat))} />
    </main>
  );
}
