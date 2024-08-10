import { mailtrapclient, sender } from "./mail.config.js";
import {PASSWORD_RESET_REQUEST_TEMPLATE, VERIFICATION_EMAIL_TEMPLATE,WELCOME_EMAIL_TEMPLATE,PASSWORD_RESET_SUCCESS_TEMPLATE } from "./emailTemplate.js";

export const sendVerificationEmail= async(email,verificationToken)=>{
    const recipient = [{email}]

    try{
     const response = await mailtrapclient.send({
        from:sender,
        to:recipient,
        subject:"Verifiy your email",
        html: VERIFICATION_EMAIL_TEMPLATE.replace("{verificationCode}",verificationToken),
        category: "Email Verification"
     })
     console.log("Email sent sucessfully",response);
    }catch(error){
        console.log("Error sending verification",error);
      throw new Error(`Error sending verification email: ${error}`);
    }
}

export const sendWelcomeEmail = async (email, username) => {
    const recipient = [{ email }];
    const dashboardURL = `http://localhost:5173/${username}`;

    try {
        
        let emailContent = WELCOME_EMAIL_TEMPLATE;
        emailContent = emailContent.replace(/{username}/g, username);
        emailContent = emailContent.replace(/{dashboardURL}/g, dashboardURL);

        const response = await mailtrapclient.send({
            from: sender,
            to: recipient,
            subject: "Welcome to Our Community!",
            html: emailContent,
            category: "Welcome Email"
        });
        console.log("Welcome email sent successfully", response);
    } catch (error) {
        console.log("Error sending welcome email", error);
        throw new Error(`Error sending welcome email: ${error}`);
    }
};

export const sendResetPasswordEmail = async (email, resetPasswordUrl) => {
    const recipient = [{ email }];
  
    try {
      const response = await mailtrapclient.send({
        from: sender,
        to: recipient,
        subject: "Reset your Password",
        html: PASSWORD_RESET_REQUEST_TEMPLATE.replace("{resetURL}", resetPasswordUrl),
        category: "Password Reset",
      });
  
      console.log("Password reset email sent successfully", response);
      return response;  
    } catch (error) {
      console.log("Error sending password reset email", error);
      throw new Error(`Error sending password reset email: ${error}`);
    }
  };
  


export const sendPasswordResetSuccessEmail = async (email) => {
    const recipient = [{ email }];

    try {
        const response = await mailtrapclient.send({
            from: sender,
            to: recipient,
            subject: "Password Reset Successful",
            html: PASSWORD_RESET_SUCCESS_TEMPLATE,
            category: "Password Reset"
        });
        console.log("Password reset success email sent successfully", response);
    } catch (error) {
        console.log("Error sending password reset success email", error);
        throw new Error(`Error sending password reset success email: ${error}`);
    }
};



  