import { useRecoilValue } from "recoil";
import Login from "../components/Login";
import SignupCard from "../components/SignupCard";
import authScreenAtom from "../atom/authAtom";

const AuthPage = () => {
	const authScreenState = useRecoilValue(authScreenAtom);

	return <>{authScreenState === "login" ? <Login /> : <SignupCard />}</>;
};

export default AuthPage;
