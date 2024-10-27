'use client'

import {
  Flex,
  Box,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Stack,
  Button,
  Heading,
  Text,
  useColorModeValue,
  Link,
} from '@chakra-ui/react'
import authScreenAtom from '../atom/authAtom';
import { useSetRecoilState } from "recoil";
import { useState } from 'react';
import useShowToast from '../hooks/useShowToast';
import userAtom from '../atom/userAtom';

export default function SimpleCard() {
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const setUser = useSetRecoilState(userAtom);
  const [inputs,setInputs] =useState({
    username:"",
    password:""
  });
  const showToast = useShowToast();
const handlesignIn = async()=>{
  
  try {
    const res = await fetch("api/auth/login",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
      },
      body: JSON.stringify(inputs)
    })
    const data = await res.json();
    if(data.error){
      showToast("Error",data.error,"error");
      return;
    }
    console.log(data);
    localStorage.setItem("user-threads",JSON.stringify(data));
    setUser(data);
  } catch (error) {
    console.log(error);
    showToast("Error",error,"error");
  }
}
  return (
    <Flex
      align={'center'}
      justify={'center'}>
      <Stack spacing={8} mx={'auto'} maxW={'md'} py={12} px={6}>
        <Stack align={'center'}>
          <Heading fontSize={'3xl'}>Login</Heading>
        </Stack>
        <Box
          rounded={'lg'}
          bg={useColorModeValue('white', 'gray.800')}
          boxShadow={'lg'}
          p={8} w={{
            base:"full",
            sm:"400px",
          }}>
          <Stack spacing={4}>
            <FormControl id="email" isRequired>
              <FormLabel>Username</FormLabel>
              <Input type="text"  onChange={(e)=> setInputs({...inputs, username:e.target.value})} value={inputs.username}/>
            </FormControl>
            <FormControl id="password" isRequired>
              <FormLabel>Password</FormLabel>
              <Input type="password" onChange={(e)=> setInputs({...inputs, password:e.target.value})} value={inputs.password}/>
            </FormControl>
            <Stack spacing={6}>
              <Stack
                direction={{ base: 'column', sm: 'row' }}
                align={'start'}
                justify={'space-between'}>
                <Checkbox>Remember me</Checkbox>
                <Link color={'#1DA1F2'}>Forgot password?</Link>
              </Stack>
              <Button
                bg={'#1DA1F2'}
                color={'white'}
                _hover={{
                  bg: '#1A91DA',
                }} onClick={handlesignIn}>
                Sign in
              </Button>
            </Stack>
            <Stack pt={6}>
							<Text align={"center"}>
								Don&apos;t have an account?{" "}
								<Link color={"blue.400"} onClick={() => setAuthScreen("signup")}>
									Sign up
								</Link>
							</Text>
						</Stack>
          </Stack>
        </Box>
      </Stack>
    </Flex>
  )
}
