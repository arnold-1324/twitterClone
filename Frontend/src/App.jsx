import { apiFetch, readApiJson } from "./lib/apiFetch.js";
import React, { Suspense, useEffect } from "react";
import { Container, Box, Spinner } from "@chakra-ui/react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Header from "./components/Header";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "./atom/userAtom";
import savedPostsAtom from "./atom/savedPostsAtom";
import NotifyAtom from "./atom/notifyAtom";
import { conversationsAtom, messagesAtom, selectedConversationAtom } from "./atom/messagesAtom";
import { useSocket } from "./context/SocketContext";

// Lazy-loaded components
const Userpage = React.lazy(() => import("./Pages/Userpage"));
const PostPage = React.lazy(() => import("./Pages/PostPage"));
const AuthPage = React.lazy(() => import("./Pages/AuthPage"));
const DiscoveryPage = React.lazy(() => import("./Pages/DiscoveryPage"));
const Home = React.lazy(() => import("./Pages/Home"));
const SearchPage = React.lazy(() => import("./Pages/SearchPage"));
const ChatPage = React.lazy(() => import("./Pages/ChatPage"));
const UpdateProfile = React.lazy(() => import("./Pages/UpdateProfile"));
const ResetPasswordForm = React.lazy(() => import("./components/ForgotpassCard"));
const CreatePost = React.lazy(() => import("./components/CreatePost"));
const NotificationPage = React.lazy(() => import("./Pages/NotificationPage"));
const AccountActivityPage = React.lazy(() => import("./Pages/AccountActivityPage"));
const SettingPage = React.lazy(() => import("./Pages/SettingPage"));

function App() {
  const { pathname } = useLocation();
  const user = useRecoilValue(userAtom);
  const setNotify = useSetRecoilState(NotifyAtom);
  const setUser = useSetRecoilState(userAtom);
  const userId = user?._id;
  const { socket } = useSocket();
  const setSaved = useSetRecoilState(savedPostsAtom);
  const setConversation = useSetRecoilState(selectedConversationAtom);
  const setInbox = useSetRecoilState(conversationsAtom);
  const setMessages = useSetRecoilState(messagesAtom);

  useEffect(() => {
    const clear = () => setUser(null);
    window.addEventListener("dayline-session-ended", clear);
    return () => window.removeEventListener("dayline-session-ended", clear);
  }, [setUser]);

  useEffect(() => {
    setConversation({ _id: "" });
    setInbox([]);
    setMessages([]);
  }, [userId, setConversation, setInbox, setMessages]);

  useEffect(() => {
    if (!userId) {
      setNotify({ notifications: [], unreadCount: 0 });
      return;
    }
    let controller;
    let refresh;
    const fetchNotifications = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const res = await apiFetch("/api/notification/?markRead=false", { signal: request.signal });
        if (request.signal.aborted) return;
        if (!res.ok) return;
        const data = await readApiJson(res);
        if (!request.signal.aborted && Array.isArray(data)) {
          setNotify({ notifications: data, unreadCount: data.filter((notif) => !notif.read).length });
        }
      } catch {
        // The activity panel has its own retry UI. Background polling keeps the last good badge.
      }
    };
    const scheduleRefresh = () => {
      refresh ??= setTimeout(() => {
        refresh = undefined;
        fetchNotifications();
      }, 1000);
    };
    fetchNotifications();
    socket?.on("activityChanged", scheduleRefresh);
    socket?.on("connect", scheduleRefresh);
    return () => {
      controller?.abort();
      clearTimeout(refresh);
      socket?.off("activityChanged", scheduleRefresh);
      socket?.off("connect", scheduleRefresh);
    };
  }, [userId, socket, setNotify]);

  useEffect(() => {
    setSaved(null);
    if (!userId) return;
    const request = new AbortController();
    apiFetch("/api/posts/saved/ids", { signal: request.signal }).then((response) => response.ok ? readApiJson(response) : null)
      .then((ids) => { if (!request.signal.aborted) setSaved(ids ?? []); })
      .catch(() => { if (!request.signal.aborted) setSaved([]); });
    return () => request.abort();
  }, [userId, setSaved]);

  return (
    <Box className={user ? `dayline-shell${pathname === "/chat" ? " chat-shell" : ""}` : undefined}
      position={"relative"} w="full" minHeight="100vh">
      <Container
        maxW={pathname === "/chat" ? "none" : pathname === "/activity" ? "1080px" : pathname === "/" ? "1120px" : pathname === "/auth" ? "960px" : "760px"}
        minHeight="100vh"
       
        display="flex"
        flexDirection="column"
      >
        <Header />
        <Suspense fallback={<Spinner mx="auto" my={12} aria-label="Loading page" />}>
          <Routes>
            <Route path="/" element={user ? <Home /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
            <Route path="/auth/reset-password/:token" element={<ResetPasswordForm />} />
            <Route path="/update" element={user ? <UpdateProfile /> : <Navigate to="/auth" />} />
            <Route path="/:username" element={user ? <Userpage /> : <Navigate to="/auth" />} />
            <Route path="/search" element={user ? <SearchPage /> : <Navigate to="/auth" />} />
            <Route path="/create" element={user ? <CreatePost page /> : <Navigate to="/auth" />} />
            <Route path="/discover" element={user ? <DiscoveryPage key="discover" /> : <Navigate to="/auth" />} />
            <Route path="/saved" element={user ? <DiscoveryPage key="saved" saved /> : <Navigate to="/auth" />} />
            <Route path="/reels" element={user ? <DiscoveryPage key="reels" reels /> : <Navigate to="/auth" />} />
            <Route path="/chat" element={user ? <ChatPage key={user._id} /> : <Navigate to="/auth" />} />
            <Route path="/notifications" element={user ? <NotificationPage /> : <Navigate to="/auth" />} />
            <Route path="/activity" element={user ? <AccountActivityPage /> : <Navigate to="/auth" />} />
            <Route path="/settings" element={user ? <SettingPage /> : <Navigate to="/auth" />} />
            <Route path="/:username/post/:pid" element={<PostPage />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}

export default App;
