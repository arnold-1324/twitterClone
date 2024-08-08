import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      caption: {
        type: String,
        maxLength: 280,
      },
      images: {
        type: String,
      },
      likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
      retweets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }],
      replies: [{
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
        ProfileImg: {
          type: String,
          default:"",
        },
        username: {
          type: String,
        },
      }],
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }, {
      timestamps: true,
    });
    
 const Post = mongoose.model('Post',postSchema);

 export default Post;