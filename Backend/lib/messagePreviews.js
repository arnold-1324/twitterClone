import Note from "../models/note.model.js";
import User from "../models/user.model.js";
import { canSeeNote } from "./noteAudience.js";
import { resolveContentReference } from "./contentReference.js";

export async function storyMessagePreview(id) {
  const story = await resolveContentReference({ type: "story", id });
  if (!story || story.expiresAt <= new Date()) return null;
  const { id: storyId, username, profileImg, caption, expiresAt, media, composition, music } = story;
  return { id: storyId, username, profileImg, caption, expiresAt, media: media[0], composition, music };
}

export async function messagePreviews(messages, viewer) {
  const storyIds = new Set(messages.flatMap(({ storyReference }) => storyReference?.id ? [String(storyReference.id)] : []));
  const noteIds = [...new Set(messages.flatMap(({ noteReference }) => noteReference?.author && canSeeNote(viewer, noteReference.author)
    ? [String(noteReference.author)] : []))];
  const [stories, notes, authors] = await Promise.all([
    Promise.all([...storyIds].map(async (id) => [id, await storyMessagePreview(id)])),
    noteIds.length ? Note.find({ _id: { $in: noteIds }, expiresAt: { $gt: new Date() } })
      .select("text theme trackId albumId musicId expiresAt updatedAt").lean() : [],
    noteIds.length ? User.find({ _id: { $in: noteIds }, isFrozen: { $ne: true } }).select("username").lean() : [],
  ]);
  const byStory = new Map(stories);
  const byNote = new Map(notes.map((note) => [String(note._id), note]));
  const byAuthor = new Map(authors.map(({ _id, username }) => [String(_id), username]));
  return messages.map((message) => {
    const { storyReference, noteReference } = message;
    const author = String(noteReference?.author ?? "");
    const note = byNote.get(author);
    const notePreview = byAuthor.has(author) && note && +new Date(noteReference.version) === +note.updatedAt
      ? { ...note, username: byAuthor.get(author) } : null;
    return {
      ...message,
      ...(storyReference?.id && { storyPreview: byStory.get(String(storyReference.id)) ?? null }),
      ...(message.noteReply && { notePreview }),
    };
  });
}
