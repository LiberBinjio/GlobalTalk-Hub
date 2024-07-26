const path = require("path");
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const Filter = require("bad-words");
const fs = require("fs");
var https = require("https");
const { generateMessage, deleteAvatar } = require("./utils/messages");

const {
  fetchLocation,
  getLocation,
  deleteLocation,
} = require("./utils/location");
const translateRoutes = require("./routes/translate");
const translatte = require("translatte");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");
// var tlsOptions={

// key: fs.readFileSync(__dirname + '/server.key'),

// cert: fs.readFileSync(__dirname + '/server.crt')

// };
const app = express();
app.use(express.static(__dirname+"/views",{index:"Index.html"}));
var server = http.createServer(app);

app.use(translateRoutes);
app.use(express.static(path.join(__dirname, "./views")));

const io = socketio(server);

io.on("connection", (socket) => {
  // console.log("New user connected!");

  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, username, room });

    if (error) {
      return callback(error);
    }
    
    socket.join(user.room);

    socket.emit("message", {
      message: generateMessage(
        { id: "admin_id", username: "Broadcast", room: user.room },
        "Welcome!\nYou are free to chat!"
      ),
    });
    socket.broadcast.to(user.room).emit("message", {
      message: generateMessage(
        { id: "admin_id", username: "Broadcast", room: user.room },
        `${username} has joined!`
      ),
    }); //Sends message to everyone except the user who has joined

    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });
    callback();
  });

  socket.on(
    "message",
    async ({ message, room, target_lang}, callback) => {

      const user = getUser(socket.id);
      const filter = new Filter();

      // Checking fro Profanity
      if (filter.isProfane(message)) {
        socket.emit("message", {
          message: generateMessage(
            { id: "admin_id", username: "Broadcast", room: user.room },
            "Please maintain decent language!"
          ),
        });
        return callback(
          "Please maintain your language. Profanity is prohibited!"
        );
      }
      // Translating every message to the room_language (room) by default
      // await translatte(message, { from: target_lang, to: original_lang })
      //   .then((translated_res) => {
      //     message = translated_res.text;
      //   })
      //   .catch((err) => {
      //     // res.send(err);
      //   });

      io.to(user.room).emit("message", {
        message: generateMessage(user, message, target_lang),
      });
      
      callback();
    }
  );


  socket.on("disconnect", () => {
    const user = removeUser(socket.id);
    if (user) {
      deleteAvatar(user);
      io.to(user.room).emit(
        "message",
        generateMessage(
          { id: "admin_id", username: "Curry", room: user.room },
          `${user.username} has left!`
        )
      );
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

io.on("translate", (socket) => {
  // console.log("connect");
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("server is up on localhost:" + PORT);
});

//socket.emit() --Emits it to the particular user
//io.emit()  --Emits it to all the users
//socket.broadcast.emit()  --Emits it to all users except the one generating it
