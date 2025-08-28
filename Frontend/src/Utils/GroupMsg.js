import { isToday, isYesterday, format } from "date-fns";

const getMessageGroupLabel = (date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMM dd, yyyy");
};

const groupMessagesByDate = (messages) => {
  return messages.reduce((groups, msg) => {
    const date = new Date(msg.createdAt || msg.timestamp);
    const label = getMessageGroupLabel(date);

    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(msg);

    return groups;
  }, {});
};

export default groupMessagesByDate;
