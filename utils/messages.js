const { createUUID } = require("./uuid");

var links = require("../jsonData/avatars.json");
var colorData = require("../jsonData/avatarColors.json");

// Stores the avatar assigned to each user
var avatar = {};
var color = {};
// Helps assign the avatar to the next incoming using in cyclic fashion
var nextAvatarId = {};
var nextAvatarColor = {};

const generateMessage = (user, text, lang) => {
  if (!avatar[user.room] || !(avatar[user.room][user.username] + 1)) {
    // This is for the time when room is created -> id(0) is reserved for admin
    if (!avatar[user.room]) {
      avatar[user.room] = [];
      color[user.room] = [];
      nextAvatarId[user.room] = 0;
      nextAvatarColor[user.room] = 0;
    }
    // Assigning the avatar and color for the current user
    avatar[user.room][user.username] = nextAvatarId[user.room];
    color[user.room][user.username] = nextAvatarColor[user.room];

    // Updating the colors and avatar for the next user
    nextAvatarColor[user.room]++;
    nextAvatarId[user.room]++;
    if (nextAvatarId[user.room] == links.length) {
      nextAvatarId[user.room] = 1;
    }
    if (nextAvatarColor[user.room] == colorData.length) {
      nextAvatarColor[user.room] = 1;
    }
  }

  return {
    message_id: createUUID(),
    username: user.username,
    text: text,
    createdAt: new Date().getTime(),
    lang: lang,
    photo: links[avatar[user.room][user.username]],
    color: colorData[color[user.room][user.username]],
  };
};

const deleteAvatar = (user) => {
  if (avatar[user.room]) delete avatar[user.room][user.username];
  if (color[user.room]) delete color[user.room][user.username];
};

module.exports = {
  generateMessage,
  deleteAvatar,
};
