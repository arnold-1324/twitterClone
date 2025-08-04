import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { upload } from "../lib/utils/uploader.js";
import {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
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

// Group creation with file upload
router.post("/create", upload.single("profileImage"), createGroup);

// Get groups
router.get("/user-groups", getUserGroups);
router.get("/:groupId", getGroupDetails);

// Update group
router.put("/:groupId", upload.single("profileImage"), updateGroup);

// Invite management
router.post("/invite", inviteToGroup);
router.post("/accept-invite", acceptInvite);
router.post("/deny-invite", denyInvite);

// Membership controls
router.post("/leave", leaveGroup);

// Permissions
router.put("/permissions", setGroupPermissions);

// Blocking users
router.post("/block", blockUserInGroup);
router.post("/unblock", unblockUserInGroup);

// Invite links
router.post("/generate-invite-link", generateInviteLink);
router.post("/join-with-token", joinWithInvite);

// Analytics
router.get("/:groupId/analytics", getGroupAnalytics);

// Group deletion
router.delete("/delete", deleteGroup);

export default router;
