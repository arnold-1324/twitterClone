import { MailtrapClient } from  "mailtrap";
import dotenv from "dotenv" 


dotenv.config();
export const mailtrapclient = new MailtrapClient({ token: process.env.TOKEN });

export const sender = {
  email: "mailtrap@demomailtrap.com",
  name: "Twitter",
};


