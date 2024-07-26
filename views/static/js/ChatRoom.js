const socket = io();

//Elements
const chatRoomTitle = document.querySelector("#chatroom__title");
const messageForm = document.querySelector("#message_form");
const messageFormInput = messageForm.querySelector("#input");
const messageFormButton = messageForm.querySelector("#button");
const messages = document.querySelector("#messages");
const checkbox = document.querySelector('#cb2');
//Templates
const messageTemplate = document.querySelector("#message-template").innerHTML;
const sidebarTemplate = document.querySelector("#sidebar-template").innerHTML;

// 标识这是什么语言的聊天室
const languages = {
  'zh-CN': "简体中文 聊天室 ",
  'zh-TW': "繁體中文 聊天室 ",
  'en': "English Chatroom ",
  'ru': "Русский комната чата ",
  'ja': "日本語 チャットルーム ",
  'ko': "한국어 채팅방 ",
  'de': "Deutsch Chatroom ",
  'hi': "हिंदी चैट रूम ",
  'ml': "മലേഷ്യൻ ഭാഷ ചാറ്റ് റൂം ",
  'es': "Español sala de chat ",
};

//Options --This is the qs library whose link we've included in the html file
//location.search is a browser side tool which gives us the querystring
//eg : ?username=yashchachad1&room=myroom
//Qs.parse returns all the query parameters as object
const { username, room, target_lang } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});

if (!username || !room  || !target_lang) {
  window.location.href = window.location.origin;
}

const autoscroll = () => {
  messages.scrollTop = messages.scrollHeight;
};

var num = 1;
var original_text_flag = false;
checkbox.addEventListener('change',()=>{
  num += 1;
  num % 2 == 0 ? original_text_flag = true : original_text_flag = false;
})

socket.on("message", (response) => {
  // console.log(response);
  var { message } = response;
  var html = null;
  if (message.lang == null) {
    fetch(
      `${window.location.origin}/translate_service?source_lan=${"en"}&res_lan=${target_lang}&inputstring=${message.text}`
    ).then((res) => {
      res.json().then((data) => {
        // console.log(lang);
        html = Mustache.render(messageTemplate, {
          username: message.username,
          message: data.translatedText,
          createdAt: moment(message.createdAt).format("h:mm a"),
          message_id: message.message_id,
          photo: message.photo,
          color: message.color,
        });

        messages.insertAdjacentHTML("beforeend", html);
        autoscroll();
      });
    })
  }
  else if (message.lang == target_lang) {
    html = Mustache.render(messageTemplate, {
      username: message.username,
      message: message.text,
      createdAt: moment(message.createdAt).format("h:mm a"),
      message_id: message.message_id,
      photo: message.photo,
      color: message.color,
    });

    messages.insertAdjacentHTML("beforeend", html);
    autoscroll();
  }
  else {
    let lang;
    lang = message.lang;
    fetch(
      `${window.location.origin}/translate_service?source_lan=${lang}&res_lan=${target_lang}&inputstring=${message.text}`
    ).then((res) => {
      res.json().then((data) => {
        var msg;
        if(original_text_flag){
          msg = data.translatedText + '<br><small>' + message.text+ '</small>';
        }
        else{
          msg = data.translatedText;
        }
        html = Mustache.render(messageTemplate, {
          username: message.username,
          message: msg,
          createdAt: moment(message.createdAt).format("h:mm a"),
          message_id: message.message_id,
          photo: message.photo,
          color: message.color,
        });


        messages.insertAdjacentHTML("beforeend", html);
        autoscroll();
      });
    })
  }

});

socket.on("roomData", ({ room, users }) => {
  const html = Mustache.render(sidebarTemplate, {
    room,
    users,
  });
  document.querySelector("#sidebar").innerHTML = html;
  document.querySelector("#usersContent").innerHTML = html;
});

var input_voice = '';

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();

  messageFormButton.setAttribute("disabled", "disabled"); //Disable send button on clicking

  //const message=e.target.elements.message.value
  var message = document.querySelector("input").value;

  messageFormInput.value = "";

  socket.emit(
    "message",
    { message, room, target_lang },
    (error) => {
      messageFormButton.removeAttribute("disabled"); //Reactivate the button on sending
      messageFormInput.focus();
      // console.log(target_lang);

      if (error) {
        // return console.log(error);
      } else {
        // console.log("Message Delivered!");
      }
    }
  );

});

const chatRoomName = languages[target_lang] + room;
chatRoomTitle.innerHTML = chatRoomName;

socket.emit("join", { username, room }, (error) => {
  if (error) {
    alert(error);
    location.href = "/ChatLogin.html";
  }
});

function sharelink() {
  var url = window.location.toString();
  const params = new URL(url).searchParams;
  var room = "";
  var target_lang = "";
  if (params.get('room')) {
    room = params.get('room');
  }
  if (params.get('target_lang')) {
    target_lang = params.get('target_lang');
  }

  var url_login = "https://trans.mirrorchatgpt.com/ChatLogin.html";
  var url_invitation = url_login + "?room=" + room + "&target_lang=" + target_lang;
  // document.getElementById('lnkInvitation').innerText = url_invitation;
  copyToClipboard(url_invitation);
  alert("You have copy the chatroom's link. You can paste and share your invitation now.")
}

function copyToClipboard(text) {
  if (window.clipboardData && window.clipboardData.setData) {
    // Internet Explorer-specific code path to prevent textarea being shown while dialog is visible.
    return window.clipboardData.setData("Text", text);

  }
  else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
    var textarea = document.createElement("textarea");
    textarea.textContent = text;
    textarea.style.position = "fixed";  // Prevent scrolling to bottom of page in Microsoft Edge.
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");  // Security exception may be thrown by some browsers.
    }
    catch (ex) {
      // console.warn("Copy to clipboard failed.", ex);
      return prompt("Copy to clipboard: Ctrl+C, Enter", text);
    }
    finally {
      document.body.removeChild(textarea);
    }
  }
}
// function translateToNative(message_id) {
//   chatMessage = document.getElementById(`text_${message_id}`);
//   translation = document.getElementById(`translation_${message_id}`);
//   message = chatMessage.innerHTML;
//   fetch(
//     `${window.location.origin}/translate_service?source_lan=${original_lang}&res_lan=${target_lang}&inputstring=${message}`
//   ).then((res) => {
//     res.json().then((data) => {
//       // console.log(data);
//       translation.innerHTML = data.translatedText;
//     });
//   });
// }

// function hello(e, message_id) {
//   viewSummary = document.getElementById(`view_${message_id}`);
//   if (!e.open) viewSummary.innerHTML = "Hide translation";
//   else viewSummary.innerHTML = "View translation";
//   if (!e.open &&
//     document.getElementById(`translation_${message_id}`).innerHTML == ""
//   ) {
//     document.getElementById(`translation_${message_id}`).innerHTML =
//       "Translating...";
//     translateToNative(message_id);
//   }
// }
//语音对象
var speech_object = null;
var continue_record_flag = null;
var count = 1;
// 是否开启录音的方法
function start_to_talk() {
  count += 1;
  count % 2 == 0 ? continue_record_flag = true : continue_record_flag = false;
  speech_object.lang = target_lang;
  continue_record_flag == true ? speech_object.start() : speech_object.stop();
  if (count % 2 == 0) {
    document.getElementById("mic_button").style.backgroundColor = "#4285f2";
    document.getElementById("mic_button").style.color = "#ffffff";

  }
  else {
    document.getElementById("mic_button").style.backgroundColor = "#ffffff";
    document.getElementById("mic_button").style.color = "#4285f2";
  }
}
//如果浏览器不支持录音功能就会调用这个方法，跳出这句话
function warning() {
  alert('Please use Edge/Chrome/Safari/Firefox for best experience');
}
// setTimeout(function() {
// var e = document.createEvent("MouseEvents");
// e.initEvent("click", true, true);
// document.getElementById("clickme").dispatchEvent(e);

// }, 5000);
//窗口重载就会执行的方法
window.onload = function () {
  if (!(window.webkitSpeechRecognition) && !(window.speechRecognition)) {
    warning();
  } else {
    var original_lang_input = document.getElementById('input'),
      value = "";
    speech_object = new webkitSpeechRecognition() || _speechRecognition();
    speech_object.continuous = true;
    speech_object.interimResults = true;
    speech_object.lang = target_lang;

    speech_object.onresult = function (event) {
      var input_voice = '';
      for (var i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const message = document.querySelector("input").value;
          messageFormInput.value = "";
          if (message != "") {
            socket.emit(
              "message",
              { message, room, target_lang },

              (error) => {
                if (error) {
                }
              }
            );
          }
          // document.getElementById("trans").value=message;
        } else {

          input_voice += event.results[i][0].transcript;
          original_lang_input.value = input_voice;
          document.addEventListener('keyup', function (e) {
            if (e.key == 'Enter') {
              speech_object.speechRecognition = false;
              speech_object.stop();
              speech_object.speechRecognition = true;

            }
          })

        }
      }
    };
    // 异常处理
    speech_object.onerror = function (event) {
      // Either 'No-speech' or 'Network connection error'
      // console.error(event.error);
    };

    //录音是否继续的标志位

    speech_object.onend = function () {
      // When recognition ends
      original_lang_input.value = '';
      if (continue_record_flag) {
        speech_object.start();
      }

    };
  }
}