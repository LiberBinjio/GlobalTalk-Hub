const translatte = require("translatte");

const getTranslated = ({ message, target_lang, room }) => {
  translatte(message, {
    from: target_lang,
    to: room,
  })
    .then((translated_res) => {
      // console.log(translated_res);
      return translated_res.text;
    })
    .catch((err) => {
      throw err;
    });
};

module.exports = { getTranslated };
