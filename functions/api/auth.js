export async function onRequestGet(context) {
  const { env } = context;
  const client_id = env.OAUTH_CLIENT_ID;

  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo,user`;
  return Response.redirect(redirectUrl, 302);
}
