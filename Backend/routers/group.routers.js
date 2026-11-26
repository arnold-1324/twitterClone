import { limitResource, limitUpload } from "../lib/rateLimits.js";
import express from "express";
import { protectRoute } from "../middleware/protectRoute.js";
import { uploadPostImage, validateImageBytes } from "../lib/utils/uploader.js";
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



// Group creation with file upload
router.post("/create", protectRoute, limitResource, limitUpload, uploadPostImage.single("profileImage"), validateImageBytes, createGroup);

// Get groups
router.get("/user-groups", protectRoute, limitResource, getUserGroups);
router.get("/:groupId", protectRoute, limitResource, getGroupDetails);

// Update group
router.put("/permissions", protectRoute, limitResource, setGroupPermissions);
router.put("/:groupId", protectRoute, limitResource, limitUpload, uploadPostImage.single("profileImage"), validateImageBytes, updateGroup);

// Invite management
router.post("/invite", protectRoute, limitResource, inviteToGroup);
router.post("/accept-invite", protectRoute, limitResource, acceptInvite);
router.post("/deny-invite", protectRoute, limitResource, denyInvite);

// Membership controls
router.post("/leave", protectRoute, limitResource, leaveGroup);

// Permissions

// Blocking users
router.post("/block", protectRoute, limitResource, blockUserInGroup);
router.post("/unblock", protectRoute, limitResource, unblockUserInGroup);

// Invite links
router.post("/generate-invite-link", protectRoute, limitResource, generateInviteLink);
router.post("/join-with-token", protectRoute, limitResource, joinWithInvite);

// Analytics
router.get("/:groupId/analytics", protectRoute, limitResource, getGroupAnalytics);

// Group deletion
router.delete("/delete", protectRoute, limitResource, deleteGroup);

export default router;
