import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  useColorModeValue,
  Avatar,
  Center,
} from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { useRecoilState } from "recoil";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";

export default function UpdateProfilePage() {
  const [user, setUser] = useRecoilState(userAtom);
  const [inputs, setInputs] = useState({
      _id: "",
      username: "",
      fullName: "",
      email: "",
      bio: "",
      currentPassword: "",
      newPassword: "",
      profileImg: "",
  });
  
  const [mediaUrl, setMediaUrl] = useState(""); 
  const fileRef = useRef(null);
  const [updating, setUpdating] = useState(false);
  const showToast = useShowToast();

 
  useEffect(() => {
      if (user) {
          setInputs({
              _id: user._id,
              username: user.username,
              fullName: user.fullName || "",
              email: user.email || "",
              bio: user.bio || "",
              currentPassword: "",
              newPassword: "",
              profileImg: user.profileImg || "",
          });
          setMediaUrl(user.profileImg || ""); 
      }
  }, [user]);

  const handleMediaChange = (event) => {
      const file = event.target.files[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setMediaUrl(reader.result);
          };
          reader.readAsDataURL(file); 
      }
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      if (updating) return;
      setUpdating(true);

      try {
          const formData = new FormData();
          Object.keys(inputs).forEach(key => {
              formData.append(key, inputs[key]);
          });
          const fileInput = fileRef.current.files[0];
          if (fileInput) {
              formData.append("image", fileInput);
          }

          const res = await fetch(`/api/users/update/${inputs._id}`, {
              method: "PUT",
              body: formData,
          });

          const data = await res.json();
          if (data.error) {
              showToast("Error", data.error, "error");
              return;
          }

          showToast("Success", "Profile updated successfully", "success");
          setUser(data); 
          localStorage.setItem("user-threads", JSON.stringify(data));
      } catch (error) {
          showToast("Error", error.message, "error");
      } finally {
          setUpdating(false);
      }
  };

  return (
      <form onSubmit={handleSubmit}>
          <Flex align={"center"} justify={"center"} my={6}>
              <Stack spacing={4} w={"full"} maxW={"md"} bg={useColorModeValue("white", "gray.800")} rounded={"xl"} boxShadow={"lg"} p={6}>
                  <Heading lineHeight={1.1} fontSize={{ base: "2xl", sm: "3xl" }}>
                      Update Profile
                  </Heading>
                  <FormControl>
                      <Stack direction={["column", "row"]} spacing={6}>
                          <Center>
                              <Avatar size='xl' boxShadow={"md"} src={mediaUrl || inputs.profileImg} />
                          </Center>
                          <Center w='full'>
                              <Button w='full' onClick={() => fileRef.current.click()}>
                                  Change Avatar
                              </Button>
                              <Input type='file' hidden ref={fileRef} onChange={handleMediaChange} accept="image/*" />
                          </Center>
                      </Stack>
                  </FormControl>

                  {["fullName", "username", "email", "bio"].map((field, index) => (
                      <FormControl key={index}>
                          <FormLabel>{field.charAt(0).toUpperCase() + field.slice(1)}</FormLabel>
                          <Input
                              placeholder={`Enter your ${field}`}
                              value={inputs[field]}
                              onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
                              _placeholder={{ color: "gray.500" }}
                              type={field === "email" ? 'email' : 'text'}
                          />
                      </FormControl>
                  ))}

                  {["currentPassword", "newPassword"].map((field, index) => (
                      <FormControl key={index}>
                          <FormLabel>{field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}</FormLabel>
                          <Input
                              placeholder={`Enter your ${field}`}
                              value={inputs[field]}
                              onChange={(e) => setInputs({ ...inputs, [field]: e.target.value })}
                              _placeholder={{ color: "gray.500" }}
                              type='password'
                          />
                      </FormControl>
                  ))}

                  <Stack spacing={6} direction={["column", "row"]}>
                      <Button
                          bg={"red.400"}
                          color={"white"}
                          w='full'
                          _hover={{
                              bg: "red.500",
                          }}
                      >
                          Cancel
                      </Button>
                      <Button
                          bg={"green.400"}
                          color={"white"}
                          w='full'
                          _hover={{
                              bg: "green.500",
                          }}
                          type='submit'
                          isLoading={updating}
                      >
                          Update
                      </Button>
                  </Stack>
              </Stack>
          </Flex>
      </form>
  );
}
