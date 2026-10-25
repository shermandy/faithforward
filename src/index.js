export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle /api/auth
    if (url.pathname === "/api/auth") {
      const client_id = env.OAUTH_CLIENT_ID;
      const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo,user`;
      return Response.redirect(redirectUrl, 302);
    }

    // Handle /api/callback
    if (url.pathname === "/api/callback") {
      const code = url.searchParams.get("code");

      const response = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "cloudflare-worker-decap-oauth",
            accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.OAUTH_CLIENT_ID,
            client_secret: env.OAUTH_CLIENT_SECRET,
            code,
          }),
        },
      );

      const data = await response.json();
      const token = data.access_token;

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Failed to obtain token" }),
          { status: 400 },
        );
      }

      const content = `
        <script>
          const receiveMessage = (message) => {
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify({ token, provider: "github" })}',
              message.origin
            );
            window.removeEventListener("message", receiveMessage, false);
          };
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        </script>
      `;

      return new Response(content, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // For all other requests, Cloudflare automatically serves your static files from _site
    return new Response("Not found", { status: 404 });
  },
};
