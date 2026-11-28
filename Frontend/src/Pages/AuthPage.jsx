import { useAppValue } from "../state/store";
import { FiCamera, FiMessageCircle } from "react-icons/fi";
import Login from "../components/Login";
import SignupCard from "../components/SignupCard";
import authScreenAtom from "../atom/authAtom";

export default function AuthPage() {
  const screen = useAppValue(authScreenAtom);
  return (
    <main className="social-panel auth-layout">
      <section className="auth-intro" aria-labelledby="welcome-title">
        <img className="auth-symbol" src="/dark-logo-192.png" alt="" width="54" height="54" />
        <h1 id="welcome-title">Make the day worth sharing.</h1>
        <p><FiCamera /> Photos and reels <FiMessageCircle /> Posts and private chats</p>
      </section>
      <div className="auth-form">{screen === "login" ? <Login /> : <SignupCard />}</div>
    </main>
  );
}
