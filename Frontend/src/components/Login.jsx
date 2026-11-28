import { apiFetch, readApiJson } from "../lib/apiFetch.js";
'use client';

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
} from '@chakra-ui/react';
import authScreenAtom from '../atom/authAtom';
import { useSetAppValue } from "../state/store";
import { useState } from 'react';
import useShowToast from '../hooks/useShowToast';
import userAtom from '../atom/userAtom';

export default function SimpleCard() {
  const setAuthScreen = useSetAppValue(authScreenAtom);
  const setUser = useSetAppValue(userAtom);
  const [forgot, setForgot] = useState(false);
  const [Femail, setFemail] = useState("");
  const [inputs, setInputs] = useState({
    username: "",
    password: ""
  });
  const showToast = useShowToast();

  const handlesignIn = async () => {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputs)
      });
      const data = await readApiJson(res);

       if(!res.ok){
        showToast("Error", data.error || data.message || "Login failed", "error");
        return;
       }

      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }
     // console.log(data.user);
      localStorage.setItem("user-threads", JSON.stringify(data.user));
      setUser(data.user);
     
    } catch (error) {
      //console.log(error);
      showToast("Error", "An error occurred during login", "error");
    }
  };

  const handleForgotPassword = async () => {
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Femail })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        showToast("Error", data.message || "Request failed", "error");
        return;
      }

      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }


      showToast("Success", "A reset link has been sent to your email", "success");
      setForgot(false); 
    } catch (error) {
      //console.log(error);
      showToast("Error", "An error occurred during Reset-password", "error");
    }
  };

  const commonBoxStyles = {
    rounded: 'lg',
    bg: useColorModeValue('white', 'gray.800'),
    boxShadow: 'lg',
    p: 8,
    w: { base: "full", sm: "400px" },
  };

  return (
    <Flex align={'center'} justify={'center'}>
      <Stack spacing={5} mx="auto" maxW="md" w="full" py={5} px={4}>
        <Stack align={'center'}>
          <Heading fontSize={'3xl'}>{forgot ? 'Forgot your password?' : 'Login'}</Heading>
          {forgot && (
            <Text fontSize={{ base: 'sm', sm: 'md' }} color={"gray.500"}>
              You&apos;ll get an email with a reset link.
            </Text>
          )}
        </Stack>

        <Box {...commonBoxStyles} as="form" onSubmit={(event) => {
          event.preventDefault();
          if (forgot) handleForgotPassword();
          else handlesignIn();
        }}>
          <Stack spacing={4}>
            {forgot ? (
              <>
                <FormControl id="email" isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    placeholder="your-email@example.com"
                    _placeholder={{ color: 'gray.500' }}
                    type="email"
                    onChange={(e) => setFemail(e.target.value)}
                    value={Femail}
                  />
                </FormControl>
                <Stack spacing={6}>
                  <Button
                    bg={'blue.400'}
                    color={'white'}
                    _hover={{
                      bg: 'blue.500',
                    }}
                    type="submit"
                  >
                    Request Reset
                  </Button>
                  <Button
                    variant="link"
                    color={'blue.400'}
                    onClick={() => setForgot(false)}
                  >
                    Back to Login
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <FormControl id="username" isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input
                    type="text" autoComplete="username"
                    onChange={(e) => setInputs({ ...inputs, username: e.target.value })}
                    value={inputs.username}
                  />
                </FormControl>
                <FormControl id="password" isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password" autoComplete="current-password"
                    onChange={(e) => setInputs({ ...inputs, password: e.target.value })}
                    value={inputs.password}
                  />
                </FormControl>
                <Stack spacing={6}>
                  <Stack direction={{ base: 'column', sm: 'row' }} align={'start'} justify={'space-between'}>
                    <Link as="button" type="button" color='var(--dayline-accent)' onClick={() => setForgot(true)}>Forgot password?</Link>
                  </Stack>
                  <Button
                    className="dayline-primary"
                    color={'white'}
                    _hover={{
                      bg: '#5b2a40',
                    }}
                    type="submit"
                  >
                    Sign in
                  </Button>
                </Stack>
                <Stack pt={6}>
                  <Text align={"center"}>
                    Don&apos;t have an account?{" "}
                    <Link color="var(--dayline-accent)" as="button" type="button" onClick={() => setAuthScreen("signup")}>
                      Sign up
                    </Link>
                  </Text>
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      </Stack>
    </Flex>
  );
}
