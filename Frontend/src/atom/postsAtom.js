import { defineState } from "../state/store";

const postsAtom = defineState({
	key: "postsAtom",
	default: [],
});

export default postsAtom;