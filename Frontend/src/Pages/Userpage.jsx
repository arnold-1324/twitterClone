import UserHeader from "../components/UserHeader"
import UserPost from "../components/UserPost"


const Userpage = () => {
  return (
    <>
    <UserHeader />
    <UserPost likes={1200} replies={1056} postImg="/db-super.jpg" postTitle="never ever give up" />
    <UserPost likes={500} replies={225} postImg="/aot.jpg" postTitle="change is the only thing that does't change" />
    <UserPost likes={700} replies={654} postImg="/dr.stone.jpg" postTitle="Science is like a 🌊" />
    <UserPost likes={960} replies={745} postImg="/img3.png" postTitle="beauty of nature." />
    <UserPost likes={450} replies={5285} postImg="/zero.jpg" postTitle="darling in the franxx" />
    </>
  )
}

export default Userpage
