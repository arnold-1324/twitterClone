import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Avatar, Button, Spinner } from "@chakra-ui/react";
import { FiBookmark, FiEdit3, FiMessageCircle, FiUsers } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import MessageContainer from "../components/MessageContainer";
import PeopleSearch from "../components/PeopleSearch";
import GroupUIComponents from "../components/GroupUIComponents";
import { conversationsAtom, selectedConversationAtom } from "../atom/messagesAtom";
import userAtom from "../atom/userAtom";
import { useSocket } from "../context/SocketContext";

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
  const [selected, setSelected] = useRecoilState(selectedConversationAtom);
  const [conversations, setConversations] = useRecoilState(conversationsAtom);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [groupOpen, setGroupOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inboxTools = useRef(null);
  const currentUser = useRecoilValue(userAtom);
  const { socket, onlineUsers } = useSocket();
  const laterKey = `dayline-later:${currentUser._id}`;
  const [later, setLater] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(laterKey));
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "string").slice(0, 100) : [];
    } catch {
      return [];
    }
  });
  const [laterOnly, setLaterOnly] = useState(false);

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
        setConversations(items);
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
    const events = ["connect", "newMessage", "newGroupMessage", "groupCreated"];
    events.forEach((event) => socket?.on(event, scheduleRefresh));
    return () => {
      clearTimeout(timer);
      controller.abort();
      events.forEach((event) => socket?.off(event, scheduleRefresh));
    };
  }, [socket, currentUser._id, setConversations, refresh]);

  function startConversation(person) {
    const existing = conversations.find((chat) => !chat.isGroup && chat.participants?.[0]?._id === person._id);
    setSelected(conversationDetails(existing ?? { _id: `draft:${person._id}`, mock: true, participants: [person] }));
  }

  const rows = conversations.map(conversationDetails).filter(({ _id, username }) =>
    (!laterOnly || later.includes(_id)) && username.toLowerCase().includes(filter.trim().toLowerCase()));
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
        <div className="inbox-list">
          <label className="inbox-filter">
            <span>Conversations</span>
            <input type="search" placeholder="Filter" aria-label="Filter conversations" value={filter}
              onChange={(event) => setFilter(event.target.value)} />
          </label>
          <button type="button" className="inbox-later-filter" aria-pressed={laterOnly} onClick={() => setLaterOnly((value) => !value)}>
            <FiBookmark /> Later{later.length ? ` (${later.length})` : ""}
          </button>
          {loading && <Spinner size="sm" aria-label="Loading conversations" />}
          {error && <p role="alert">{error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></p>}
          {!loading && !error && !rows.length && <p className="inbox-muted">{filter ? "No matching conversations." : laterOnly ? "Nothing saved for later." : "Your chats will appear here."}</p>}
          {rows.map((chat) => (
            <div key={chat._id} className="inbox-entry">
            <button type="button" className="inbox-row" aria-pressed={selected._id === chat._id}
              onClick={() => setSelected(chat)}>
              <Avatar size="md" name={chat.username} src={chat.userProfilePic} icon={chat.isGroup ? <FiUsers /> : undefined} />
              <span>
                <strong>{chat.username}</strong>
                <small>{chat.lastMessage?.text || (chat.isGroup ? `${chat.participants.length} members` : onlineUsers.includes(chat.userId) ? "Online" : "Direct message")}</small>
              </span>
            </button>
            <button type="button" className="inbox-later-toggle" aria-pressed={later.includes(chat._id)}
              aria-label={later.includes(chat._id) ? `Remove ${chat.username} from Later` : `Save ${chat.username} for later`}
              onClick={() => toggleLater(chat._id)}><FiBookmark /></button>
            </div>
          ))}
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
