const express = require("express");
const path = require("path");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
app.use(express.json());

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateUser = (request, response, next) => {
  console.log("user");
  next();
};
app.post("/register/", authenticateUser, async (request, response) => {
  const { username, password, name, gender } = request.body;
  console.log(username, password, name, gender);
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(username, password);
  const getUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(getUser);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      dbResponse.password
    );
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid Password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SCREAT");
      console.log(jwtToken);
      response.send(jwtToken);
    }
  }
});
