import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import userAtom from "../atom/userAtom";
import { useSetAppValue } from "../state/store";
import useShowToast from "./useShowToast";

const useLogout = () => {
	const setUser = useSetAppValue(userAtom);
	const showToast = useShowToast();

	const logout = async () => {
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
	};

	return logout;
};

export default useLogout;