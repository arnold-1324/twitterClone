import { Flex, Box, FormControl, FormLabel, Input, InputGroup, HStack, InputRightElement, Stack, Button, Heading, Text, useColorModeValue, Link, Center } from '@chakra-ui/react';
import { useState } from 'react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import authScreenAtom from '../atom/authAtom';
import { useSetRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import useShowToast from '../hooks/useShowToast';
import { useNavigate } from 'react-router-dom';
import { PinInput, PinInputField } from '@chakra-ui/react';

export default function SignupCard() {
  const [showPassword, setShowPassword] = useState(false);
  const showToast = useShowToast();
  const [confPass, setConfPass] = useState(false);
  const navigate = useNavigate();
  const setAuthScreen = useSetRecoilState(authScreenAtom);
  const [inputs, setInputs] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const setUser = useSetRecoilState(userAtom);
  const [verificationCode, setVerificationCode] = useState("");
  const [isOptSent, setIsOptSent] = useState(false);

  const handleSignup = async () => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (data.Error) {
        showToast("Error", data.Error, "error");
        return;
      }
      showToast('Success', 'Signup successful! Please verify your email.', 'success');
      setIsOptSent(true); 
    } catch (error) {
      showToast("Error", error.message || "An unexpected error occurred", "error");
    }
  };

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
      localStorage.setItem("user-threads", JSON.stringify(data.user));
      setUser(data.user); 
      navigate('/');
    } catch (error) {
      showToast("Error", "An error occurred during verification", "error");
    }
  };

  return (
    <Flex align={'center'} justify={'center'}>
      <Stack spacing={8} mx={'auto'} maxW={'lg'} py={12} px={6}>
        <Stack align={'center'}>
          <Heading fontSize={'3xl'} textAlign={'center'}>
            {isOptSent ? 'Verify Your Email' : 'Create your account'}
          </Heading>
        </Stack>
        <Box
          rounded={'lg'}
          bg={useColorModeValue('white', 'gray.800')}
          boxShadow={'lg'}
          p={8}
          w={{ base: "full", sm: "400px" }}>
          <Stack spacing={4}>
            {!isOptSent ? (
              <>
                {/* Signup Form */}
                <HStack>
                  <Box>
                    <FormControl id="fullname" isRequired>
                      <FormLabel>Full Name</FormLabel>
                      <Input type="text" onChange={(e) => setInputs({ ...inputs, fullName: e.target.value })} value={inputs.fullName} />
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl id="username">
                      <FormLabel>User Name</FormLabel>
                      <Input type="text" onChange={(e) => setInputs({ ...inputs, username: e.target.value })} value={inputs.username} />
                    </FormControl>
                  </Box>
                </HStack>
                <FormControl id="email" isRequired>
                  <FormLabel>Email address</FormLabel>
                  <Input type="email" onChange={(e) => setInputs({ ...inputs, email: e.target.value })} value={inputs.email} />
                </FormControl>
                <FormControl id="password" isRequired>
                  <FormLabel>Password</FormLabel>
                  <InputGroup>
                    <Input type={showPassword ? 'text' : 'password'} onChange={(e) => setInputs({ ...inputs, password: e.target.value })} value={inputs.password} />
                    <InputRightElement h={'full'}>
                      <Button variant={'ghost'} onClick={() => setShowPassword((showPassword) => !showPassword)}>
                        {showPassword ? <ViewIcon /> : <ViewOffIcon />}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                <FormControl id="ConfirmPassword" isRequired>
                  <FormLabel>Confirm Password</FormLabel>
                  <InputGroup>
                    <Input type={confPass ? 'text' : 'password'} onChange={(e) => setInputs({ ...inputs, confirmPassword: e.target.value })} value={inputs.confirmPassword} />
                    <InputRightElement h={'full'}>
                      <Button variant={'ghost'} onClick={() => setConfPass((confPass) => !confPass)}>
                        {confPass ? <ViewIcon /> : <ViewOffIcon />}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                <Stack spacing={6} pt={2}>
                  <Button
                    size="lg"
                    bg={'#1DA1F2'}
                    color={'white'}
                    _hover={{ bg: '#1A91DA' }}
                    onClick={handleSignup}>
                    Sign up
                  </Button>
                </Stack>
                <Stack pt={6}>
                  <Text align={'center'}>
                    Already a user?{' '}
                    <Link color={'#1DA1F2'} onClick={() => setAuthScreen("login")}>Login</Link>
                  </Text>
                </Stack>
              </>
            ) : (
              <>
                {/* Email Verification Form */}
                <Center>
                  <Heading lineHeight={1.1} fontSize={{ base: '2xl', md: '3xl' }}>
                    Verify your Email
                  </Heading>
                </Center>
                <Center color={useColorModeValue('gray.800', 'gray.400')} fontWeight="bold">
                  {inputs.email}
                </Center>
                <FormControl>
                  <Center>
                    <HStack>
                      <PinInput onChange={(val) => setVerificationCode(val)}>
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                        <PinInputField />
                      </PinInput>
                    </HStack>
                  </Center>
                </FormControl>
                <Stack spacing={6}>
                  <Button
                    bg={'blue.400'}
                    color={'white'}
                    _hover={{ bg: 'blue.500' }}
                    onClick={handleVerifyEmail}>
                    Verify
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      </Stack>
    </Flex>
  );
}
