// import { redisClient } from "../Redis.js";

// export const forgotpassLimitter = async (req, res, next) => {
//   const key = `forgot:${req.ip}`;
//   const now = Date.now();

//   let raw = await redisClient.get(key);
//   let data;
//   try {
//     data = raw ? JSON.parse(raw) : { count: 0, lastRequest: 0, resetTime: now + 24*60*60*1000 };
//   } catch {
//     data = { count: 0, lastRequest: 0, resetTime: now + 24*60*60*1000 };
//   }

//   if (now > data.resetTime) {
//     data = { count: 0, lastRequest: 0, resetTime: now + 24*60*60*1000 };
//   }

//   const FREE_LIMIT = 3;
//   const COOLDOWN_MS = 15 * 60 * 1000; 

//   if (data.count < FREE_LIMIT) {
//     data.count += 1;
//     data.lastRequest = now;
   
//     const ttl = Math.ceil((data.resetTime - now) / 1000);
//     await redisClient.setEx(key, ttl, JSON.stringify(data));
//     return next();
//   }

//   const sinceLast = now - data.lastRequest;
//   if (sinceLast < COOLDOWN_MS) {
//     const waitMin = Math.ceil((COOLDOWN_MS - sinceLast) / 60000);
//     return res.status(429).json({
//       message: `Too many attempts—please wait ${waitMin} minute(s) before retrying.`
//     });
//   }
//   console.log(data);
 
//   data.lastRequest = now;
//   const ttl = Math.ceil((data.resetTime - now) / 1000);
//   await redisClient.setEx(key, ttl, JSON.stringify(data));
//   return next();
// };
