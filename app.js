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

const isUserFollowing = async (request, response, next) => {
  const { tweetId } = request.params;
  const { username } = request.headers;

  const getUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];
  //   console.log(userId);
  const followingQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${userId};`;
  const userFollowingData = await db.all(followingQuery);
  //   console.log(userFollowingData);
  const tweetUserQuery = `
    SELECT * FROM tweet WHERE tweet_id = '${tweetId}';`;
  const tweetData = await db.get(tweetUserQuery);
  const tweetUserID = tweetData["user_id"];
  //   console.log(tweetUserID);
  let isTweetUserIDInFollowingIds = false;
  userFollowingData.forEach((each) => {
    if (each["following_user_id"] === tweetUserID) {
      isTweetUserIDInFollowingIds = true;
    }
  });

  if (isTweetUserIDInFollowingIds) {
    next();
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
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
  const { username } = request.headers;
  const getQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getQuery);
  const userId = dbUser["user_id"];
  const getUsers = `SELECT name FROM user INNER JOIN follower
   ON user.user_id = follower.following_user_id
   WHERE follower_user_id = ${userId};`;

  const dbResponse = await db.all(getUsers);
  response.send(dbResponse);
});

app.get("/user/followers/", authenticate, async (request, response) => {
  const { username } = request.headers;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];

  const getUsers = `SELECT name FROM user INNER JOIN follower 
  ON user.user_id = follower.follower_user_id
  WHERE following_user_id = '${userId}';`;
  const dbResponse = await db.all(getUsers);
  response.send(dbResponse);
});

app.get(
  "/tweets/:tweetId/",
  authenticate,
  isUserFollowing,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT tweet, COUNT() AS replies, date_time AS dateTime 
    FROM tweet INNER JOIN reply
    ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.tweet_id = '${tweetId}';`;
    const data = await db.get(query);
    const likesQuery = `SELECT COUNT() AS likes
    FROM like WHERE tweet_id = ${tweetId};`;
    const { likes } = await db.get(likesQuery);
    data.likes = likes;
    response.send(data);
  }
);
app.get(
  "/tweets/:tweetId/likes/",
  authenticate,
  isUserFollowing,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT username FROM like NATURAL JOIN user
    WHERE tweet_id = '${tweetId}';`;

    const data = await db.all(query);
    const usernameArray = data.map((each) => each.username);
    response.send({ likes: usernameArray });
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticate,
  isUserFollowing,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `SELECT name, reply
    FROM reply NATURAL JOIN user 
    WHERE tweet_id = ${tweetId};`;
    const data = await db.all(query);

    response.send({ replies: data });
  }
);

app.get("/user/tweets/", authenticate, async (request, response) => {
  const { username } = request.headers;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];

  const query = `SELECT tweet , COUNT() AS likes , date_time AS dateTime
    FROM tweet INNER JOIN like
    ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id = '${userId}'
    GROUP BY tweet.tweet_id;`;
  let likesData = await db.all(query);

  const repliesQuery = `SELECT tweet, COUNT() AS replies 
    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.user_id = '${userId}'
    GROUP BY tweet.tweet_id;`;

  const repliesData = await db.all(repliesQuery);

  likesData.forEach((each) => {
    for (let data of repliesData) {
      if (each.tweet == data.tweet) {
        each.replies = data.replies;
        break;
      }
    }
  });
  response.send(likesData);
});

app.post("/user/tweets/", authenticate, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request.headers;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];
  const query = `INSERT INTO tweet(tweet, user_id) 
    VALUES('${tweet}', '${userId}');'`;
  await db.run(query);
  response.send("Created a Tweet");
});

app.delete("/tweets/:tweetId", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  //   console.log(tweetId);
  const { username } = request.headers;
  //   console.log(username);
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const userId = dbUser["user_id"];
  //   console.log(userId);
  const userTweetsQuery = `SELECT tweet_id, user_id
    FROM tweet
    WHERE user_id = '${userId}';`;

  const userTweetsData = await db.all(userTweetsQuery);

  let isTweetUsers = false;
  userTweetsData.forEach((each) => {
    if (each["tweet_id"] == tweetId) {
      isTweetUsers = true;
    }
  });

  if (isTweetUsers) {
    const query = `DELETE FROM tweet WHERE tweet_id = '${tweetId}';`;
    await db.run(query);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
