import crypto from 'crypto';


const algorithm = 'aes-256-cbc';
const secretKey = process.env.ENCRYPTION_SECRET; 
const iv = crypto.randomBytes(16); 


export const encrypt = (text) => {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), encryptedData: encrypted };
};


export const decrypt = (encryption) => {
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), Buffer.from(encryption.iv, 'hex'));
    let decrypted = decipher.update(encryption.encryptedData, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
};