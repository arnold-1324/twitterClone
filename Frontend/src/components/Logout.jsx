import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Button } from "@chakra-ui/react"
import { useAppState } from "../state/store";
import userAtom from "../atom/userAtom";
import useShowToast from "../hooks/useShowToast";
import { HiOutlineLogout } from "react-icons/hi";


const Logout = () => {
    const [user, setUser] = useAppState(userAtom);
   const showToast = useShowToast();
    const handleLogout = async()=>{
        //debugger
        try {
            const res =await apiFetch("/api/auth/logout",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                },
            })
            const data = await readApiJson(res);
            console.log(data);
            if(data.error){
                showToast("Error",data.error,"error");
                return;
            }
            localStorage.removeItem("user-threads");
             setUser(null);
        } catch (error) {
            console.log(error);
        }
    }
  return (
    <Button position={"fixed"} top={"30px"} right={"30px"} size={"sm"} onClick={handleLogout}>
     <HiOutlineLogout />
    </Button>
  )
}

export default Logout
