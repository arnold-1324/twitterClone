import { Container,Box } from "@chakra-ui/react"
import { Routes, Route, useLocation } from 'react-router-dom';
import Userpage from "./Pages/Userpage";
import PostPage from "./Pages/PostPage";
import Header from "./components/Header";
import AuthPage from "./Pages/AuthPage";
import HomePage from "./Pages/Home/Home";
import { Navigate } from "react-router-dom";
import { useRecoilValue } from "recoil";
import userAtom from "./atom/userAtom";
import Logout from "./components/Logout";
import UpdateProfile from "./Pages/UpdateProfile";
import ResetPasswordForm from "./components/ForgotpassCard";
import CreatePost from "./components/CreatePost";

function App() {
  const { pathname } = useLocation();
  const user = useRecoilValue(userAtom);

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
        <Routes>
          <Route
            path="/"
            element={user ? <HomePage /> : <Navigate to="/auth" />}
          />
          <Route
            path="/auth"
            element={!user ? <AuthPage /> : <Navigate to="/" />}
          />
          <Route
            path="/auth/reset-password/:token"
            element={<ResetPasswordForm />}
          />
          <Route
            path="/update"
            element={user ? <UpdateProfile /> : <Navigate to="/auth" />}
          />
          <Route
            path="/:username"
            element={
              user ? (
                <>
                  <Userpage />
                  <CreatePost />
                </>
              ) : (
                <Userpage />
              )
            }
          />
         <Route path='/:username/post/:pid' element={<PostPage />} />
        </Routes>
        {user && <Logout />}
      </Container>
    </Box>
  );
}

export default App
