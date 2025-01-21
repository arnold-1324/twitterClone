import React, { Suspense, useEffect } from "react";
import { Container, Box } from "@chakra-ui/react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import Header from "./components/Header";
import { useRecoilValue, useSetRecoilState } from "recoil";
import userAtom from "./atom/userAtom";
import NotifyAtom from "./atom/notifyAtom";
import useShowToast from "./hooks/useShowToast";

// Lazy-loaded components
const Userpage = React.lazy(() => import("./Pages/Userpage"));
const PostPage = React.lazy(() => import("./Pages/PostPage"));
const AuthPage = React.lazy(() => import("./Pages/AuthPage"));
const Home = React.lazy(() => import("./Pages/Home"));
const ChatPage = React.lazy(() => import("./Pages/ChatPage"));
const UpdateProfile = React.lazy(() => import("./Pages/UpdateProfile"));
const ResetPasswordForm = React.lazy(() => import("./components/ForgotpassCard"));
const CreatePost = React.lazy(() => import("./components/CreatePost"));
const NotificationPage = React.lazy(() => import("./Pages/NotificationPage"));

function App() {
  const { pathname } = useLocation();
  const user = useRecoilValue(userAtom);
  const setNotify = useSetRecoilState(NotifyAtom);
  const showToast = useShowToast();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notification/");
        if (!res.ok) throw new Error("Failed to fetch notifications");

        const data = await res.json();
        const unreadCount = data.filter((notif) => !notif.read).length;

        setNotify({ notifications: data, unreadCount });
      } catch (error) {
        showToast("Error", error.message || "Failed to fetch data", "error");
      }
    };

    fetchNotifications();
  }, [setNotify, showToast]);

  return (
    <Box position={"relative"} w="full" minHeight="100vh">
      <Container
        maxW={pathname === "/" ? { base: "620px", md: "900px" } : "620px"}
        height="full"
        minHeight="100vh"
        display="flex"
        flexDirection="column"
      >
        <Header />
        {user && (
          <Suspense fallback={<div>Loading CreatePost...</div>}>
            <CreatePost />
          </Suspense>
        )}
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={user ? <Home /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
            <Route path="/auth/reset-password/:token" element={<ResetPasswordForm />} />
            <Route path="/update" element={user ? <UpdateProfile /> : <Navigate to="/auth" />} />
            <Route path="/:username" element={user ? <Userpage /> : <Navigate to="/auth" />} />
            <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/auth" />} />
            <Route path="/notifications" element={user ? <NotificationPage /> : <Navigate to="/auth" />} />
            <Route path="/:username/post/:pid" element={<PostPage />} />
          </Routes>
        </Suspense>
      </Container>
    </Box>
  );
}

export default App;
