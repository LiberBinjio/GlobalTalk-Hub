const inputdata = document.querySelector("#inputdata");
const result = document.querySelector("#result");

//Translate the data
const translateme = (datainp, source_lan, res_lan) => {
  fetch(
    `${window.location.origin}/translate_service?source_lan=${source_lan}&res_lan=${res_lan}&inputstring=${datainp}`
  ).then((res) => {
    res.json().then((data) => {
      // console.log(data);

      if ($("body").data("title") === "my_translate_page") {
        result.value = "Loading....";

        if (data.error) {
          result.value = data.error;
        } else {
          result.value = data.translatedText;
        }
        var speechBtn = document.querySelector("#speakme");
        speechBtn.disabled = false;
      } else {
        const input = document.getElementById("input");
        input.value = data.translatedText;
      }
    });
  });
};

//Speech Recognition
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

recognition.onstart = () => {
  // console.log("Voices activated!!");
};

// recognition.onsoundend = () => {
//   console.log("Voice deactivated!")
//   var inputArea = document.querySelector("#inputdata");
//   inputArea.value = "";
// };

recognition.onresult = (event) => {
  // console.log(event);
  const current = event.resultIndex;

  const transcript = event.results[current][0].transcript;
  inputdata.value = transcript;
  performTranslation(event);
};

const readOutLoud = (message, lang) => {
  languages_list = ["mr", "kn", "gu", "ml", "ta", "ur", "ta", "te", "sd"];
  if (languages_list.includes(lang)) {
    lang = "hi";
  }
  const speech = new SpeechSynthesisUtterance();
  // console.log(speech);

  speech.text = message;
  speech.voulme = 1;
  speech.rate = 1;
  speech.lang = lang;

  window.speechSynthesis.speak(speech);
};
