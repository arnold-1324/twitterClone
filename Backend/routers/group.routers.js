import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import {
  createGroup,
  inviteToGroup,
  acceptInvite,
  denyInvite,
  leaveGroup,
  setGroupPermissions,
  blockUserInGroup,
  unblockUserInGroup,
  deleteGroup,
  getGroupAnalytics,
  generateInviteLink,
  joinWithInvite,
} from "../controller/group.controller.js";

const router = express.Router();


router.use(protectRoute);

// G
router.post("/create", createGroup);

// Invite management
router.post("/invite", inviteToGroup);
router.post("/accept-invite", acceptInvite);
router.post("/deny-invite", denyInvite);

// Membership controls
router.post("/leave", leaveGroup);

// Permissions
router.post("/permissions", setGroupPermissions);

// Blocking users
router.post("/block", blockUserInGroup);
router.post("/unblock", unblockUserInGroup);

// Invite links
router.post("/generate-invite-link", generateInviteLink);
router.post("/join-with-token", joinWithInvite);

// Analytics
router.get("/analytics", getGroupAnalytics);

// Group deletion
router.delete("/delete", deleteGroup);

export default router;
