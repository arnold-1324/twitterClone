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

export default function SimpleCard() {
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
              <FormLabel>Email or Username</FormLabel>
              <Input type="text" />
            </FormControl>
            <FormControl id="password" isRequired>
              <FormLabel>Password</FormLabel>
              <Input type="password" />
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
                }}>
                Sign in
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Flex>
  )
}
