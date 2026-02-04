const adminUser = process.env.ADMIN_USER;
const adminPassword = process.env.ADMIN_PASSWORD;

function adminAuth(req, res, next) {
  // Headerul de basic auth arata asa: "Basic base64(user:parola)"
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin OFAI"');
    return res.status(401).send("Autentificare necesara pentru admin");
  }

  const base64Credentials = authHeader.slice("Basic ".length).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(base64Credentials, "base64").toString("utf8");
  } catch (err) {
    return res.status(401).send("Credentiale invalide");
  }

  const [user, password] = decoded.split(":");

  if (!user || !password) {
    return res.status(401).send("Credentiale invalide");
  }

  if (user === adminUser && password === adminPassword) {
    return next();
  }

  return res.status(401).send("Credentiale gresite pentru admin");
}

module.exports = adminAuth;
