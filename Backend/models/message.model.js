import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
    optionText: { type: String, required: true },
    votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
})


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
            enum: ["text", "image", "video","post","audio","file","poll"], 
            default: "text",
        },
        iv: {
      type: String,
      required: function () {
        return this.text && typeof this.text === "string" && this.text.trim().length > 0;
      },
    },
    poll:{
     question: {
    type: String,
    required: function () {
      return this.type === "poll";
    },
  },
     options: [pollOptionSchema],
     totalVotes: { type: Number, default: 0 },
     multiSelect: { type: Boolean, default: false },
     expiresAt: { type: Date, default: null },
     closed:{type:Boolean,default:false}
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

messageSchema.pre("save", function (next) {
  if (this.type === "poll" && this.poll?.options) {
    this.poll.totalVotes = this.poll.options.reduce(
      (sum, opt) => sum + opt.votes.length,
      0
    );
  }
  next();
});


const Message = mongoose.model("Message", messageSchema);

export default Message;
