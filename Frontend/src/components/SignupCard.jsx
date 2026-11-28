import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Flex, Box, FormControl, FormLabel, Input, InputGroup, HStack, InputRightElement, Stack, Button, Heading, Text, useColorModeValue, Link, Center } from '@chakra-ui/react';
import { useState } from 'react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import authScreenAtom from '../atom/authAtom';
import { useSetAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import useShowToast from '../hooks/useShowToast';
import { useNavigate } from 'react-router-dom';
import { PinInput, PinInputField } from '@chakra-ui/react';

export default function SignupCard() {
  const [showPassword, setShowPassword] = useState(false);
  const showToast = useShowToast();
  const [confPass, setConfPass] = useState(false);
  const navigate = useNavigate();
  const setAuthScreen = useSetAppValue(authScreenAtom);
  const [inputs, setInputs] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const setUser = useSetAppValue(userAtom);
  const [verificationCode, setVerificationCode] = useState("");
  const [isOptSent, setIsOptSent] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(inputs),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        showToast("Error", data.error || data.Error || "Could not sign up.", "error");
        return;
      }
      if (data.user && !data.verificationRequired) {
        localStorage.setItem("user-threads", JSON.stringify(data.user));
        setUser(data.user);
        navigate("/");
        return;
      }
      showToast('Success', 'Signup successful! Please verify your email.', 'success');
      setIsOptSent(true);
    } catch (error) {
      showToast("Error", error.message || "An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (event) => {
    event.preventDefault();
    if (submitting || verificationCode.length !== 6) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: inputs.email, verificationCode })
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        showToast("Error", data.error || data.message || "Verification failed.", "error");
        return;
      }
      showToast("Success", "Email verified successfully!", "success");
      localStorage.setItem("user-threads", JSON.stringify(data.user));
      setUser(data.user); 
      navigate('/');
    } catch (error) {
      showToast("Error", "An error occurred during verification", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const surface = useColorModeValue("white", "gray.800");
  const hint = useColorModeValue("gray.600", "gray.300");

  return (
    <Flex align={'center'} justify={'center'}>
      <Stack spacing={8} mx={'auto'} maxW={'lg'} py={5} px={4} w="full">
        <Stack align={'center'}>
          <Heading fontSize={'3xl'} textAlign={'center'}>
            {isOptSent ? 'Verify Your Email' : 'Create your account'}
          </Heading>
        </Stack>
        <Box
          rounded={'lg'}
          bg={surface}
          boxShadow={'lg'}
          p={{ base: 1, sm: 3 }}
          w="full">
          <Stack as="form" onSubmit={isOptSent ? handleVerifyEmail : handleSignup} spacing={4}>
            {!isOptSent ? (
              <>
                {/* Signup Form */}
                <HStack>
                  <Box>
                    <FormControl id="fullname" isRequired>
                      <FormLabel>Full Name</FormLabel>
                      <Input autoComplete="name" type="text" onChange={(e) => setInputs({ ...inputs, fullName: e.target.value })} value={inputs.fullName} />
                    </FormControl>
                  </Box>
                  <Box>
                    <FormControl id="username" isRequired>
                      <FormLabel>User Name</FormLabel>
                      <Input autoComplete="username" type="text" onChange={(e) => setInputs({ ...inputs, username: e.target.value })} value={inputs.username} />
                    </FormControl>
                  </Box>
                </HStack>
                <FormControl id="email" isRequired>
                  <FormLabel>Email address</FormLabel>
                  <Input autoComplete="email" type="email" onChange={(e) => setInputs({ ...inputs, email: e.target.value })} value={inputs.email} />
                </FormControl>
                <FormControl id="password" isRequired>
                  <FormLabel>Password</FormLabel>
                  <InputGroup>
                    <Input autoComplete="new-password" type={showPassword ? 'text' : 'password'} onChange={(e) => setInputs({ ...inputs, password: e.target.value })} value={inputs.password} />
                    <InputRightElement h={'full'}>
                      <Button type="button" aria-label={showPassword ? "Hide password" : "Show password"} variant={'ghost'} onClick={() => setShowPassword((showPassword) => !showPassword)}>
                        {showPassword ? <ViewIcon /> : <ViewOffIcon />}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                <FormControl id="ConfirmPassword" isRequired>
                  <FormLabel>Confirm Password</FormLabel>
                  <InputGroup>
                    <Input autoComplete="new-password" type={confPass ? 'text' : 'password'} onChange={(e) => setInputs({ ...inputs, confirmPassword: e.target.value })} value={inputs.confirmPassword} />
                    <InputRightElement h={'full'}>
                      <Button type="button" aria-label={confPass ? "Hide password confirmation" : "Show password confirmation"} variant={'ghost'} onClick={() => setConfPass((confPass) => !confPass)}>
                        {confPass ? <ViewIcon /> : <ViewOffIcon />}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
                <Stack spacing={6} pt={2}>
                  <Button
                    size="lg"
                    className="dayline-primary"
                    type="submit" isLoading={submitting}>
                    Sign up
                  </Button>
                </Stack>
                <Stack pt={6}>
                  <Text align={'center'}>
                    Already a user?{' '}
                    <Link as="button" type="button" color="var(--dayline-accent)" onClick={() => setAuthScreen("login")}>Login</Link>
                  </Text>
                </Stack>
              </>
            ) : (
              <>
                {/* Email Verification Form */}
                <Center color={hint} fontWeight="bold">
                  {inputs.email}
                </Center>
                <FormControl>
                  <Center>
                    <HStack>
                      <PinInput onChange={(val) => setVerificationCode(val)}>
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                        <PinInputField maxW={{ base: "36px", sm: "42px" }} />
                      </PinInput>
                    </HStack>
                  </Center>
                </FormControl>
                <Stack spacing={6}>
                  <Button
                    className="dayline-primary"
                    type="submit" isLoading={submitting} isDisabled={verificationCode.length !== 6}>
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
