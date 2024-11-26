import { format, isToday, isYesterday } from "date-fns";

const formatMessageTime = (timestamp) => {
  try {
    const messageDate = new Date(timestamp);
    if (isNaN(messageDate)) throw new Error("Invalid Date");

    if (isToday(messageDate)) {
      return format(messageDate, "hh:mm a"); // e.g., 04:53 PM
    } else if (isYesterday(messageDate)) {
      return "Yesterday"; // e.g., "Yesterday"
    } else {
      return format(messageDate, "MMM dd"); // e.g., Jan 12
    }
  } catch (error) {
    console.error("Error formatting timestamp:", error.message);
    return "Invalid Date";
  }
};

export default formatMessageTime;
