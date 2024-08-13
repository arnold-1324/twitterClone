import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    fullName: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
        minLength: 6,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date,

    email: {
        type: String,
        required: true,
        unique: true,
    },

    followers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: [],
        }
    ],

    following: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: [],
        }
    ],
    followRequests: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: [],
        }
      ],

    profileImg: {
        type: String,
        default: "",
    },

    bio: {
        type: String,
        default: "",
    },

    accountPrivacy: {
        type: String,
        enum: ["public", "private"],
        default: "public",
    },

    isAccountFrozen: {
        type: Boolean,
        default: false,
    },

    accountFreezeUntil: {
        type: Date,
        default: null,
    },

}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;