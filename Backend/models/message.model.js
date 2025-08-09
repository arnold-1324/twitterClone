import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: {
            type: String,
            default: "",
        },
        type: {
            type: String,
            enum: ["text", "image", "video","post","audio"], 
            default: "text",
        },
        iv: {
      type: String,
      required: function () {
        return this.text && typeof this.text === "string" && this.text.trim().length > 0;
      },
    },
        seen: {
            type: Boolean,
            default: false,
        },
        img: {
            type: String,
            default: "",
        },
        audio: {
            type: String,
            default: "",
        },
        video:{
            type:String,
            default: "",    
        },

        postReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },

        reactions: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                type: { type: String }, 
            },
        ],
        edited: {
            type: Boolean,
            default: false,
        },
        replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, 
        deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    },
    { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
