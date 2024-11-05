import { Avatar, Flex, Image, Text,Box, Divider,Button } from "@chakra-ui/react"
import { BsThreeDots } from "react-icons/bs"
import Action from "../components/Actions";
import { useState } from "react";
import Comment from "../components/Comment";

const PostPage = () => {
  const [liked,setLiked]= useState(false);
  return (
    <>
    <Flex>
      <Flex w={"full"} alignItems={"center"} gap={3}>
        <Avatar src="/zero.jpg" size={{base:"md",md:"xl",}} name="arnold" />
        <Flex>
          <Text fontSize={"sm"} fontWeight={"bold"} >Arnold</Text>
          <Image src="/verified.png" w="4" h={4} ml={4} />
        </Flex>
      </Flex>
      <Flex gap={4} alignItems={"center"}>
        <Text fontSize={"sm"} color={"gray.light"}>1d</Text>
        <BsThreeDots />
      </Flex>
    </Flex>
    <Text my={3}>Let's talk about Thread.</Text>

    <Box borderRadius={6} overflow={"hidden"} border={"1px solid"} borderColor={"gray.light"}>
      <Image src={"/db-super.jpg"} w={"full"} />
    </Box>

    <Flex gap={3}>
       <Action liked={liked} setLiked={setLiked} />
    </Flex>
    <Flex gap={2} alignItems={"center"}>
      <Text color={"gray.light"} fontSize={"sm"}>228 replies</Text>
      <Box w={0.5} h={0.5} borderRadius={"full"} bg={"gray.light"}></Box>
      <Text color={"gray.light"} fontSize={"sm"}>{200 + (liked ? 1 :0)} likes</Text> 
    </Flex>
    <Divider my={4}/>

    <Flex justifyContent={"space-between"}>
      <Flex gap={2} alignItems={"center"}>
        <Text fontSize={"2xl"}>👋</Text>
        <Text color={"gray.light"}>Get the app to likes, reply and post.</Text>
      </Flex>
      <Button>Get</Button>
    </Flex>
    <Divider my={4}/>
    <Comment comment="It's looks good bro 👍"  createdAt="2d" likes={100} username="Arnold" profImg="/db-super.jpg" />
    <Comment comment="keep going bro"  createdAt="1d" likes={300} username="Max" profImg="/aot.jpg" />
    <Comment comment="lool great"  createdAt="3d" likes={324} username="John" profImg="/dr.stone.jpg" />
    <Comment comment="Mass bro"  createdAt="1d" likes={535} username="Ben 10" profImg="/zero.jpg" />
    </>
  )
}

export default PostPage
