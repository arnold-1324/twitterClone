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
    savedPosts: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
    hideBio: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
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
    isFrozen: {
        type: Boolean,
        default: false,
    },

    profileImg: {
        type: String,
        default: "",
    },

    bio: {
        type: String,
        default: "",
    },

 

  
  

}, { timestamps: true });

userSchema.index({ savedPosts: 1 }, { sparse: true });

const User = mongoose.model("User", userSchema);

export default User;