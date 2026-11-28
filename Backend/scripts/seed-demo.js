import { randomBytes } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import AccountHistory from "../models/accountHistory.model.js";
import Conversation from "../models/conversation.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import Notification from "../models/notification.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { saveMedia } from "../lib/mediaStore.js";
import { communities } from "./demo-profiles.js";

const database = process.env.DEMO_DATABASE_NAME;
const mediaDirectory = process.env.MEDIA_DIR;
const mongoUrl = process.env.MONGODB_URL;
const demoPassword = process.env.DEMO_LOGIN_PASSWORD;
const manifestPath = process.argv[2];
const expectedPerTopic = 10;
const hour = 60 * 60 * 1000;
const day = 24 * hour;
const now = Date.now();

if (!/^demo_[a-z0-9_]{1,48}$/.test(database ?? "") || !mongoUrl || !mediaDirectory || !manifestPath
    || !process.env.ENCRYPTION_SECRET || !demoPassword || demoPassword.length < 12
    || Buffer.byteLength(demoPassword, "utf8") > 72) {
  throw new Error("Set MONGODB_URL, a new DEMO_DATABASE_NAME beginning with demo_, MEDIA_DIR, ENCRYPTION_SECRET, and a 12–72 byte DEMO_LOGIN_PASSWORD. Pass the media manifest path.");
}

const { encrypt } = await import("../lib/utils/Msg_encryption/encrypt.js");
const manifestDirectory = dirname(await realpath(manifestPath));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const mediaByTopic = new Map();
const sourceFiles = new Set();

function httpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

for (const { topic } of communities) {
  const photos = manifest.photos.filter((entry) => entry.topic === topic);
  const reels = manifest.reels.filter((entry) => entry.topic === topic);
  if (photos.length !== expectedPerTopic * 2 || reels.length !== expectedPerTopic) {
    throw new Error(`Expected 20 photos and 10 reels for ${topic}.`);
  }
  for (const entry of [...photos, ...reels]) {
    const { file, credit, duration, original } = entry;
    const path = await realpath(resolve(manifestDirectory, file));
    if (!path.startsWith(manifestDirectory + sep) || sourceFiles.has(path) || !(await stat(path)).isFile()
        || !credit?.title || !credit.creator || !credit.license || !httpsUrl(credit.source)
        || (credit.licenseUrl && !httpsUrl(credit.licenseUrl))
        || (original && !httpsUrl(original))
        || (reels.includes(entry) && (!Number.isFinite(duration) || duration <= 0 || duration > 120))) {
      throw new Error(`Invalid demo media entry for ${file}.`);
    }
    sourceFiles.add(path);
  }
  mediaByTopic.set(topic, { photos, reels });
}

let randomState = 5393112;
function random() {
  randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
  return randomState / 2 ** 32;
}
function shuffled(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

const id = () => new mongoose.Types.ObjectId();
const people = communities.flatMap((community, groupIndex) =>
  community.profiles.map(([fullName, username, bio, caption], position) => ({
    _id: id(), fullName, username, email: `${username}@example.invalid`,
    bio: `Fictional demo profile · ${bio}`, caption, position, groupIndex,
    joined: new Date(now - (55 + groupIndex * 6 + position) * day),
    notifications: [], saves: [], following: [], followers: [],
  })),
);
const viewer = people.find(({ username }) => username === "isha_builds");
const cohorts = communities.map((_, index) => people.filter(({ groupIndex }) => groupIndex === index));

for (const person of people) {
  const peers = cohorts[person.groupIndex].filter((peer) => peer !== person);
  const otherCommunities = people.filter(({ groupIndex }) => groupIndex !== person.groupIndex);
  const choices = [
    ...shuffled(peers).slice(0, 4 + Math.floor(random() * 5)),
    ...shuffled(otherCommunities).slice(0, 2 + Math.floor(random() * 9)),
  ];
  const following = person === viewer
    ? cohorts.flatMap((cohort) => cohort.filter((candidate) => candidate !== viewer).slice(0, 7))
    : choices;
  for (const peer of following) {
    person.following.push(peer._id);
    peer.followers.push(person._id);
    if (random() < 0.65) {
      peer.notifications.push({
        from: person._id, to: peer._id, type: "follow", read: random() > 0.13,
        createdAt: new Date(now - (1 + random() * 45) * day),
      });
    }
  }
}

const conversations = [];
const groups = [];
const messages = [];
const inboxByPerson = new Map(people.map((person) => [person, []]));

function createConversation(kind, members) {
  const participants = members.map(({ _id }) => _id);
  const thread = { _id: id(), kind, participants, createdAt: new Date(now - 36 * day) };
  if (kind === "direct") thread.directKey = participants.map(String).sort().join(":");
  for (const person of members) inboxByPerson.get(person).push(thread);
  conversations.push(thread);
  return thread;
}

function addMessage(thread, sender, text, at, extras = {}) {
  const { iv, encryptedData } = encrypt(text);
  const message = {
    _id: id(), conversationId: thread._id, sender: sender._id, type: "text",
    text: encryptedData, iv, seen: random() > 0.15, createdAt: at, updatedAt: at,
    ...extras,
  };
  messages.push(message);
  if (!thread.lastMessage || thread.lastMessage.sentAt < at) {
    thread.lastMessage = { messageId: message._id, sentAt: at, text: encryptedData, iv, sender: sender._id, seen: message.seen };
    thread.updatedAt = at;
  }
  return message;
}

const pollOptions = [
  ["Small-sided game", "Passing drills"],
  ["On the bench", "Live demo"],
  ["Share a first draft", "Bring a finished piece"],
  ["Morning train", "Late afternoon train"],
  ["Something sweet", "Something savoury"],
  ["Woodland trail", "River loop"],
];

for (const [index, cohort] of cohorts.entries()) {
  const community = communities[index];
  const members = [...new Set([...cohort, viewer])];
  const thread = createConversation("group", members);
  groups.push({
    name: community.group, description: `Demo group for the ${community.topic} community.`,
    owner: cohort[0]._id, admins: [cohort[0]._id, cohort[1]._id],
    members: thread.participants, conversation: thread._id, createdAt: thread.createdAt,
  });
  const chat = community.chat.map((line, position) => addMessage(
    thread, cohort[position], line, new Date(now - (34 - index) * day + position * hour),
    { ...(position > 0 && { reactions: [{ user: cohort[0]._id, type: "👍" }] }) },
  ));
  chat[2].replyTo = chat[0]._id;
  addMessage(thread, cohort[0], "What should we try next time?", new Date(now - (31 - index) * day), {
    type: "poll",
    poll: {
      question: "What should we try next time?",
      options: pollOptions[index].map((optionText, option) => ({
        optionText, votes: cohort.slice(option * 3 + 1, option * 3 + 4).map(({ _id }) => _id),
      })),
      totalVotes: 6,
    },
  });

  for (const [position, person] of cohort.entries()) {
    const partner = position % 3 === 0 && person !== viewer ? viewer : cohort[(position + 1) % cohort.length];
    const direct = createConversation("direct", [person, partner]);
    const at = new Date(now - (20 + random() * 10) * day);
    addMessage(direct, person, "Did you get a chance to look at the references I sent?", at);
    addMessage(direct, partner, "Just did. Send me the one you meant in the group too.", new Date(at.getTime() + hour));
  }
}

const captions = [
  "A few seconds from the session that made me want to try this.",
  "Short reference clip for the next session. Saving this one for later.",
  "Here’s the moment I wanted to show in the group chat.",
  "Worth a second watch. There’s a detail I missed the first time.",
  "A short clip that made me pause and look twice.",
  "A quick clip for the mood board this week.",
  "A small detail from a longer piece I’ve been watching.",
  "Putting this in my reference folder for the weekend.",
  "I’d missed this angle the first time through.",
  "One to send to the group for our next get-together.",
];

async function upload(entry, kind) {
  const { file, credit, mime, original } = entry;
  const buffer = await readFile(resolve(manifestDirectory, file));
  const { key } = await saveMedia({ buffer, mimetype: mime, originalname: file }, { kind });
  return { key, type: kind, credit: { ...credit, original } };
}

function createPost(person, kind, media, caption, at) {
  const community = communities[person.groupIndex];
  const peers = cohorts[person.groupIndex].filter((candidate) => candidate !== person);
  const otherUsers = people.filter((candidate) => candidate.groupIndex !== person.groupIndex);
  const engagement = shuffled([...shuffled(peers).slice(0, 6), ...shuffled(otherUsers).slice(0, 9)]);
  const audience = engagement.slice(0, 3 + Math.floor(random() * 12));
  const post = {
    _id: id(), postedBy: person._id, kind, media, topics: [community.topic], caption,
    images: kind === "post" ? media[0].key : "", likes: audience.map(({ _id }) => _id),
    createdAt: at, updatedAt: at,
    replies: shuffled(peers).slice(0, 1 + Math.floor(random() * 4)).map((commenter, index) => ({
      userId: commenter._id, username: commenter.username,
      comment: community.comments[(person.position + index + (kind === "reel" ? 2 : 0)) % community.comments.length],
      createdAt: new Date(at.getTime() + (index + 1) * hour),
    })),
    sharedBy: [],
  };
  for (const liker of audience) {
    const reacted = new Date(at.getTime() + (1 + random() * 8) * hour);
    if (random() < 0.68) person.notifications.push({
      from: liker._id, to: person._id, type: "like", post: post._id, read: random() > 0.09, createdAt: reacted,
    });
    if (random() < 0.24) liker.saves.push(post._id);
  }
  for (const sharer of shuffled(peers).slice(0, Math.floor(random() * 4))) {
    const threads = inboxByPerson.get(sharer);
    const thread = threads[Math.floor(random() * threads.length)];
    const sharedAt = new Date(at.getTime() + (1 + random() * 10) * hour);
    post.sharedBy.push({ userId: sharer._id, sharedAt });
    addMessage(thread, sharer, kind === "reel" ? "Have you seen this clip?" : "Thought you'd like the photos.", sharedAt, {
      type: "post", postReference: post._id,
    });
  }
  post.shareCount = post.sharedBy.length;
  return post;
}

try {
  await mongoose.connect(mongoUrl, { dbName: database, serverSelectionTimeoutMS: 10000 });
  for (const { name } of await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()) {
    if (await mongoose.connection.db.collection(name).findOne({}, { projection: { _id: 1 } })) {
      throw new Error("The demo database must be empty. Choose a fresh database name.");
    }
  }
  await Promise.all([User.init(), Post.init(), Group.init(), Conversation.init(), Message.init(), Notification.init(), AccountHistory.init()]);
  const posts = [];

  // The app allows two video encodes at once. Keep fixture preparation within that bound.
  for (const cohort of cohorts) {
    const community = communities[cohort[0].groupIndex];
    const { photos, reels } = mediaByTopic.get(community.topic);
    const entries = await Promise.all([cohort.slice(0, 5), cohort.slice(5)].map(async (half) => {
      const results = [];
      for (const person of half) {
        const index = person.position;
        const photoMedia = await Promise.all(photos.slice(index * 2, index * 2 + 2).map((entry) => upload(entry, "image")));
        const video = await upload(reels[index], "video");
        results.push({ person, photoMedia, video });
      }
      return results;
    }));
    for (const { person, photoMedia, video } of entries.flat()) {
      const posted = new Date(now - (1 + random() * 25) * day);
      const reeled = new Date(now - (0.6 + random() * 26) * day);
      const reelCaption = video.credit.original?.startsWith("https://www.youtube.com/shorts/")
        ? `${video.credit.title} · a short worth sharing.`
        : captions[person.position];
      posts.push(createPost(person, "post", photoMedia, person.caption, posted));
      posts.push(createPost(person, "reel", [video], `${reelCaption} #${community.topic}`, reeled));
    }
    console.log(`Prepared 10 carousels and 10 reels for ${community.topic}.`);
  }

  groups.forEach((group) => {
    group.messages = messages.filter(({ conversationId }) => conversationId.equals(group.conversation)).map(({ _id }) => _id);
  });

  const users = await Promise.all(people.map(async (person) => ({
    _id: person._id, username: person.username, email: person.email, fullName: person.fullName, bio: person.bio,
    password: await bcrypt.hash(person === viewer ? demoPassword : randomBytes(24).toString("base64url"), 10),
    following: person.following, followers: person.followers, savedPosts: person.saves, isVerified: true,
    createdAt: person.joined, updatedAt: new Date(now - 12 * hour), lastLogin: new Date(now - (1 + random() * 28) * hour),
  })));
  const notifications = people.flatMap((person) => person.notifications);
  const history = users.flatMap((user) => [
    { user: user._id, kind: "bio", action: "changed", profileValue: user.bio, createdAt: user.createdAt },
    { user: user._id, kind: "name", action: "changed", profileValue: user.fullName, createdAt: user.createdAt },
  ]);
  await User.insertMany(users);
  await Post.insertMany(posts);
  await Conversation.insertMany(conversations);
  await Group.insertMany(groups);
  await Message.insertMany(messages);
  await Notification.insertMany(notifications);
  await AccountHistory.insertMany(history);
  console.log(JSON.stringify({
    database, users: users.length, posts: posts.length / 2, reels: posts.length / 2,
    follows: users.reduce((count, user) => count + user.following.length, 0),
    likes: posts.reduce((count, post) => count + post.likes.length, 0),
    comments: posts.reduce((count, post) => count + post.replies.length, 0),
    shares: posts.reduce((count, post) => count + post.shareCount, 0),
    saves: users.reduce((count, user) => count + user.savedPosts.length, 0),
    conversations: conversations.length, groups: groups.length, messages: messages.length,
    notifications: notifications.length, viewer: viewer.username,
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
