// Synthetic local regression identities only. Never read a real user's cookie.
export async function setFixtureBrowserUser(context,user) {
 const session={access_token:user.testToken,refresh_token:"fixture-refresh-token",token_type:"bearer",expires_in:600,expires_at:Math.floor(Date.now()/1000)+600,user:{id:user.id,email:user.email}};
 await context.addCookies([{name:"sb-127-auth-token",value:`base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,domain:"localhost",path:"/",httpOnly:true,sameSite:"Lax"}]);
}
