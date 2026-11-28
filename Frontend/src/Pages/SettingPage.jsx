import { apiFetch, readApiJson } from "../lib/apiFetch.js";
import { Avatar, Button, FormControl, FormLabel, Input, Stack, Switch, useColorMode } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { useAppState } from "../state/store";
import { useState } from "react";
import userAtom from "../atom/userAtom";
import useLogout from "../hooks/useLogout";
import useShowToast from "../hooks/useShowToast";
import MusicImportPanel from "../components/MusicImportPanel";

export default function SettingPage() {
  const [user, setUser] = useAppState(userAtom);
  const logout = useLogout();
  const showToast = useShowToast();
  const { colorMode, toggleColorMode } = useColorMode();
  const [privacyPending, setPrivacyPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function changeBioVisibility(hideBio) {
    setPrivacyPending(true);
    try {
      const response = await apiFetch("/api/users/profile-privacy", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hideBio }),
      });
      if (!response.ok) throw new Error("Could not update bio visibility.");
      const result = await readApiJson(response);
      setUser((account) => account && ({ ...account, hideBio: result.hideBio }));
    } catch (error) {
      showToast("Privacy setting unavailable", error.message, "error");
    } finally {
      setPrivacyPending(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const currentPassword = fields.get("current");
    const newPassword = fields.get("next");
    if (newPassword !== fields.get("confirm")) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch(`/api/users/update/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await readApiJson(response);
      if (!response.ok || !result.reauthenticate) throw new Error(result.error || "Could not change your password.");
      localStorage.removeItem("user-threads");
      setUser(null);
      showToast("Password changed", "Sign in again with your new password.", "success");
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dayline-tool-page">
      <h1>Settings</h1>
      <Stack className="social-panel dayline-tool-panel" spacing={5}>
        <div className="settings-account">
          <Avatar name={user.fullName} src={user.profileImg} />
          <Link to={`/${user.username}`}>{user.fullName}<small>@{user.username}</small></Link>
          <Button as={Link} to="/update" size="sm" variant="outline">Edit profile</Button>
        </div>
        <div className="settings-row">
          <span><strong>Account activity</strong><small>Review account changes, media and likes.</small></span>
          <Button as={Link} to="/activity" size="sm" variant="outline">View activity</Button>
        </div>
        <label className="settings-row">
          <span><strong>Hide my bio</strong><small>Keep your bio visible only to you. Your posts remain public.</small></span>
          <Switch aria-label="Hide my bio" colorScheme="purple" isChecked={Boolean(user.hideBio)} isDisabled={privacyPending}
            onChange={(event) => changeBioVisibility(event.target.checked)} />
        </label>
        <label className="settings-row">
          <span><strong>Dark mode</strong><small>Change the theme on this device.</small></span>
          <Switch aria-label="Dark mode" colorScheme="purple" isChecked={colorMode === "dark"} onChange={toggleColorMode} />
        </label>
        <MusicImportPanel userId={user._id} />
        <form className="settings-password" onSubmit={changePassword}>
          <Stack spacing={4}>
            <h2>Change password</h2>
            <FormControl isRequired>
              <FormLabel>Current password</FormLabel>
              <Input name="current" autoComplete="current-password" type="password" />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>New password</FormLabel>
              <Input name="next" autoComplete="new-password" type="password" minLength={6} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Confirm new password</FormLabel>
              <Input name="confirm" autoComplete="new-password" type="password" minLength={6} />
            </FormControl>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" className="dayline-primary" alignSelf="start" isLoading={saving}>Save password</Button>
          </Stack>
        </form>
        <Button variant="outline" alignSelf="start" onClick={logout}>Log out</Button>
      </Stack>
    </main>
  );
}
