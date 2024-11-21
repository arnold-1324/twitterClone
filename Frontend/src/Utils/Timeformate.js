import { format } from "date-fns";

const formatMessageTime = (timestamp) => {
  try {
    const messageDate = new Date(timestamp); 
    if (isNaN(messageDate)) throw new Error("Invalid Date"); 

    const today = new Date(); 
    const yesterday = new Date(); 
    yesterday.setDate(today.getDate() - 1); 

    const isToday = format(messageDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
    const isYesterday = format(messageDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd");

    if (isToday) {
      return format(messageDate, "hh:mm a"); 
    } else if (isYesterday) {
      return "Yesterday"; 
    } else {
      return format(messageDate, "MM/dd/yyyy"); 
    }
  } catch (error) {
    console.error("Error formatting timestamp:", error.message);
    return "Invalid Date"; 
  }
};

export default formatMessageTime;
