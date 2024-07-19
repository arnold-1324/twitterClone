import { Container } from "@chakra-ui/react"
import { Routes, Route } from 'react-router-dom';
import Userpage from "./Pages/Userpage";
import PostPage from "./Pages/PostPage";
import Header from "./components/Header";
function App() {
  return (
    <Container maxW="620px">
      <Header />
      <Routes>
         <Route path="/:username" element={<Userpage />} />
         <Route path="/:username/post/:pid" element={<PostPage />} />
      </Routes>
     </Container>
  )
}

export default App
