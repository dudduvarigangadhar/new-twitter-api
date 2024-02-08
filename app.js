const express = require("express");
const path = require("path");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let db = null;
app.use(express.json());

const initialDBAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server Running at http://localhost:3000/`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initialDBAndServer();

const authenticate = (request, response, next) => {
  let jwtToken;

  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "TOKEN", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.headers.username = payLoad.username;
        next();
      }
    });
  }
};
const getFollowedPeopleIdsOfUser = async (username) => {
  console.log("get followed", username);
  const getUsers = `SELECT following_user_id FROM follower 
    INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE user.username = '${username}';`;
  const followingPeople = await db.all(getUsers);
  console.log(followingPeople);
  const arrayOfIds = followingPeople.map(
    (eachUser) => eachUser.following_user_id
  );
  return arrayOfIds;
};
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(getQuery);
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(dbResponse);
  if (dbResponse === undefined) {
    //   const hashedpassword = await bcrypt.hash(password,dbResponse.password)
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `INSERT INTO user(username,name,password,gender)
          VALUES(
              '${username}',
              '${name}',
              '${hashedPassword}',
              '${gender}'
            );`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(getUserQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, dbResponse.password);
    if (isPassword !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "TOKEN");
      console.log(jwtToken);
      response.send({ jwtToken });
    }
  }
});

app.get("/user/tweets/feed/", authenticate, async (request, response) => {
  const { username } = request.headers;
  //   console.log(request);

  const getUser = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUser);
  const userId = dbUser["user_id"];

  //   const followingPeopleIds = await getFollowedPeopleIdsOfUser(username);
  const query = `
  SELECT username,tweet,date_time AS dateTime 
  FROM follower INNER JOIN tweet 
  ON follower.following_user_id = tweet.user_id
  NATURAL JOIN user
  WHERE follower.follower_user_id = '${userId}'
  ORDER BY dateTime DESC
    LIMIT 4
    ;`;
  const dbResponse = await db.all(query);
  response.send(dbResponse);
});

app.get("/user/following/", authenticate, async (request, response) => {
  const getUsers = `SELECT DISTINCT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id;`;
  const dbResponse = await db.all(getUsers);
  response.send(dbResponse);
});

app.get("/user/followers/", authenticate, async (request, response) => {
  const getUsers = `SELECT DISTINCT name FROM user INNER JOIN follower ON user.user_id = follower.following_user_id;`;
  const dbResponse = await db.all(getUsers);
  response.send(dbResponse);
});
module.exports = app;
