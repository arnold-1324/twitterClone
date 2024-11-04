'use client'

import {
  Flex,
  Box,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Button,
  Heading,
  Text,
  useColorModeValue,
  Link,
} from '@chakra-ui/react'
import { useState } from 'react';
import useShowToast from '../hooks/useShowToast';
import { useSetRecoilState } from "recoil";
import userAtom from '../atom/userAtom';

export default function VerifyEmail() {
  const [verificationCode, setVerificationCode] = useState("");
  const setUser = useSetRecoilState(userAtom);
  const showToast = useShowToast();

  const handleVerifyEmail = async () => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verificationCode })
      });

      const data = await res.json();
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }
      
      
      showToast("Success", "Email verified successfully!", "success");
      setUser(data);

    } catch (error) {
      console.log(error);
      showToast("Error", "An error occurred during verification", "error");
    }
  };

  return (
    <Flex
      align={'center'}
      justify={'center'}>
      <Stack spacing={8} mx={'auto'} maxW={'md'} py={12} px={6}>
        <Stack align={'center'}>
          <Heading fontSize={'3xl'}>Verify Your Email</Heading>
          <Text fontSize={'md'} color={'gray.500'}>
            A verification code has been sent to your email. Please enter it below to verify your account.
          </Text>
        </Stack>
        <Box
          rounded={'lg'}
          bg={useColorModeValue('white', 'gray.800')}
          boxShadow={'lg'}
          p={8} w={{
            base: "full",
            sm: "400px",
          }}>
          <Stack spacing={4}>
            <FormControl id="verificationCode" isRequired>
              <FormLabel>Verification Code</FormLabel>
              <Input 
                type="number" 
                maxLength={6}
                placeholder="Enter verification code"
                onChange={(e) => setVerificationCode(e.target.value)}
                value={verificationCode}
              />
            </FormControl>
            <Stack spacing={6}>
              <Button
                bg={'#1DA1F2'}
                color={'white'}
                _hover={{
                  bg: '#1A91DA',
                }}
                onClick={handleVerifyEmail}
              >
                Verify Email
              </Button>
            </Stack>
            <Stack pt={6}>
              <Text align={"center"}>
                Didn't receive the code?{" "}
                 <Link color={"blue.400"} >
                  Resend Code
                </Link> 
              </Text>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Flex>
  );
}
