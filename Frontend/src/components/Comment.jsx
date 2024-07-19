import { Avatar, Divider, Flex ,Text } from "@chakra-ui/react";
import { useState } from "react"
import { BsThreeDots } from "react-icons/bs";
import Action from "./Action";


const Comment = ({likes,comment,createdAt,username,profImg}) => {
    const [liked,setLiked]= useState(false);
  return (
    <>
    <Flex gap={4} padding={2} my={2} w={"full"}>
        <Avatar src={profImg} size={"sm"} />
        <Flex gap={1} w={"full"} flexDirection={"column"}>
            <Flex w={"full"} justifyContent={"space-between"} alignItems={"center"}>
                <Text fontSize={"sm"} fontWeight={"bold"}>{username}</Text>
                <Flex gap={2} alignItems={"center"}>
                    <Text fontSize={"sm"} color={"gray.light"}>{createdAt}</Text>
                    <BsThreeDots />
                </Flex>
            </Flex>
            <Text>{comment}</Text>
            <Action liked={liked} setLiked={setLiked} />
            <Text fontSize={"sm"} color={"gray.light"}>{likes + (liked? 1:0)} likes</Text>
        </Flex>
    </Flex>
    <Divider my={4} />
     
    </>
  )
}

export default Comment;
