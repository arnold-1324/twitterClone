import { defineState } from "../state/store";

const authScreenAtom = defineState({
	key: "authScreenAtom",
	default: "login",
});

export default authScreenAtom;