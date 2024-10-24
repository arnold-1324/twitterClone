import { Container,Box } from "@chakra-ui/react"
import { Routes, Route, useLocation } from 'react-router-dom';
import Userpage from "./Pages/Userpage";
import PostPage from "./Pages/PostPage";
import Header from "./components/Header";
import AuthPage from "./Pages/AuthPage";
import HomePage from "./Pages/Home/Home";
//import { Navigate } from "react-router-dom";

function App() {
  const { pathname } = useLocation();
  return (
    <Box position={"relative"} w='full'>
			<Container maxW={pathname === "/" ? { base: "620px", md: "900px" } : "620px"}>
				<Header />
      <Routes>
         <Route path="/" element={<HomePage />} />
         <Route path='/auth' element={ <AuthPage /> } />
         <Route path="/:username" element={<Userpage />} />
         <Route path="/:username/post/:pid" element={<PostPage />} />
      </Routes>
     </Container>
     </Box>
  )
}

export default App
