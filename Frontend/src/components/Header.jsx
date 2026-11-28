import ActivityList from "./ActivityList";
import { Avatar, IconButton, Tooltip, useBreakpointValue, Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverBody, useColorMode } from "@chakra-ui/react";
import { FiBell, FiFilm, FiHome, FiLogOut, FiMessageCircle, FiMoon, FiPlusSquare, FiSearch, FiSettings, FiSun } from "react-icons/fi";
import { Link, NavLink } from "react-router-dom";
import { useAppValue } from "../state/store";
import userAtom from "../atom/userAtom";
import NotifyAtom from "../atom/notifyAtom";
import inboxUnreadAtom from "../atom/inboxUnreadAtom";
import useLogout from "../hooks/useLogout";

const links = [
  { to: "/", label: "Feed", Icon: FiHome },
  { to: "/reels", label: "Reels", Icon: FiFilm },
  { to: "/search", label: "Search", Icon: FiSearch },
  { to: "/create", label: "Create post", Icon: FiPlusSquare },
  { to: "/chat", label: "Messages", Icon: FiMessageCircle },
];

export default function Header() {
  const user = useAppValue(userAtom);
  const { unreadCount } = useAppValue(NotifyAtom);
  const { total: unreadMessages } = useAppValue(inboxUnreadAtom);
  const { colorMode, toggleColorMode } = useColorMode();
  const logout = useLogout();
  const activityPlacement = useBreakpointValue({ base: "top-end", md: "right-start" });

  return (
    <header className="social-header">
      <Link to="/" className="social-brand" aria-label="Home">
        <img src="/dark-logo-192.png" alt="" width="36" height="36" />
      </Link>
      {user && (
        <nav className="social-nav" aria-label="Primary navigation">
          {links.map(({ to, label, Icon }) => (
            <NavLink end key={to} to={to} aria-label={label}
              aria-description={to === "/chat" && unreadMessages > 0 ? `${unreadMessages} unread messages` : undefined}
              className={`social-nav-link${to === "/create" ? " nav-desktop-create" : ""}`}>
              <Icon />
              {to === "/" && <img className="mobile-feed-mark" src="/dark-logo-192.png" alt="" width="19" height="19" />}
              <span>{label}</span>
              {to === "/chat" && unreadMessages > 0 && <small className="messages-badge" aria-hidden="true">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </small>}
            </NavLink>
          ))}
          <Popover placement={activityPlacement} isLazy lazyBehavior="unmount">
            {({ onClose }) => <>
              <PopoverTrigger><button type="button" className="social-nav-link activity-toggle" aria-label="Toggle activity">
                <FiBell /><span>Activity</span>{unreadCount > 0 && <small aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? "99+" : unreadCount}</small>}
              </button></PopoverTrigger>
              <PopoverContent className="activity-popover" maxW="calc(100vw - 20px)">
                <PopoverHeader><strong>Activity</strong><Link to="/notifications" onClick={onClose}>View all</Link></PopoverHeader>
                <PopoverBody><ActivityList compact onNavigate={onClose} /></PopoverBody>
              </PopoverContent>
            </>}
          </Popover>
          <NavLink to="/settings" className="social-nav-link mobile-settings" aria-label="Settings">
            <FiSettings /><span>Settings</span>
          </NavLink>
          <NavLink end to={`/${encodeURIComponent(user.username)}`} className="social-nav-link social-mobile-profile" aria-label="Your profile">
            <Avatar size="xs" name={user.fullName || user.username} src={user.profileImg} />
          </NavLink>
        </nav>
      )}
      <div className="social-tools">
        <Tooltip label="Toggle color mode">
          <IconButton variant="ghost" size="sm" aria-label="Toggle color mode" onClick={toggleColorMode}
            icon={colorMode === "dark" ? <FiSun /> : <FiMoon />} />
        </Tooltip>
        {user && <>
          <IconButton as={Link} to="/settings" variant="ghost" size="sm" aria-label="Settings" icon={<FiSettings />} />
          <IconButton variant="ghost" size="sm" onClick={logout} aria-label="Log out" icon={<FiLogOut />} />
          <Link to={`/${user.username}`} aria-label="Your profile">
            <Avatar size="sm" name={user.fullName} src={user.profileImg} />
          </Link>
        </>}
      </div>
    </header>
  );
}
