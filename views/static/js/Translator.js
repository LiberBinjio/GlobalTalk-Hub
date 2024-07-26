// 会议记录导出时的日期、星期和时间
var now_date_object = new Date(),
    date = now_date_object.toLocaleDateString(),
    week = now_date_object.getDay(),
    arr = new Array("星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六");


// 将页面中的导出会议记录标签和save_target_historymsg方法绑定
document.querySelector('#save_target_historymsg').addEventListener('click', save_target_historymsg);

// 虚假鼠标点击事件
function fake_click(obj) {
    var ev = document.createEvent("MouseEvents");
    ev.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    obj.dispatchEvent(ev);
}
// 输出文件,参数一是文件名,参数二是textarea里的数据
function export_file(name, data) {
    var urlObject = window.URL || window.webkitURL || window;
    var export_blob = new Blob([data]);
    var save_link = document.createElementNS("http://www.w3.org/1999/xhtml", "a")
    save_link.href = urlObject.createObjectURL(export_blob);
    save_link.download = name;
    fake_click(save_link);
}
// 保存目标语言会议记录的方法
function save_target_historymsg() {
    var inValue = document.querySelector('#target_lang_historymsg').value;
    var now_time_object = new Date();
    var time = now_time_object.toLocaleTimeString();
    
    var file_download_fulltime = date + arr[week] + time;
    export_file(file_download_fulltime + ' 会议记录.txt', inValue);
}

// 全局变量原/目标语言initial langugae/target language
var initial_lang = "";
var target_lang = "";
//更新原语言方法实现
function update_initial_lang(event, elm) {
    document.getElementById('selectlang1').innerHTML = "Chosen: "+elm.getAttribute("name");
    document.getElementById('selectlang1').style.left = "21%";
    document.getElementById('selectlang1').style.color = "#f6c53f";
    var initial_lang_value = elm.getAttribute("value");
        speech_object.lang = initial_lang_value;
        initial_lang = initial_lang_value;
    speech_object.recognizing = false;
    speech_object.stop();
    speech_object.recognizing = true;
}
//更新目标语言方法实现
function update_target_lang(event, elm) {
    document.getElementById('selectlang2').innerHTML = "Chosen: "+elm.getAttribute("name");
    document.getElementById('selectlang2').style.left = "14%";
    document.getElementById('selectlang2').style.color = "#f6c53f";
    var target_lang_value = elm.getAttribute("value");
        target_lang = target_lang_value;
}

// clear功能实现
function Clear() {
    var initial_lang_historymsg = document.getElementById('initial_lang_historymsg'),
        target_lang_historymsg = document.getElementById('target_lang_historymsg'),
        target_lang_output = document.getElementById('target_lang_output'),
        initial_lang_input = document.getElementById('initial_lang_input');

    initial_lang_input.value = "";
    target_lang_output.value = "";
    initial_lang_historymsg.value = "";
    target_lang_historymsg.value = "";
}

// START/PAUSE功能实现
var count = 1;
var continue_record_flag = null;
function start_and_pause() {
    if(initial_lang != "" && target_lang != ""){
        count += 1;
        count % 2 == 0 ? continue_record_flag = true : continue_record_flag = false;
        speech_object.lang = initial_lang;
        continue_record_flag == true ? speech_object.start() : speech_object.stop();
        if(count % 2 == 0){
            document.getElementById("start_btn").style.color="#00D2D3";
            document.getElementById("start_btn").style.transition="0.5s";

            document.getElementById("start_btn").style.borderBottom="5px solid #00D2D3";
            document.getElementById("start_btn").textContent="P A U S E";

        
          }
          else{
            document.getElementById("start_btn").style.transition="0.5s";
            document.getElementById("start_btn").style.color="#ffffff";
            document.getElementById("start_btn").style.borderBottom="0px solid ";
            document.getElementById("start_btn").textContent="S T A R T";

          }
    }
    else{
        alert('原语言和目标语言还未被全部选择');
    }
}

function translateTotarget(message) {
    var initial_lang_historymsg = document.getElementById('initial_lang_historymsg'),
        target_lang_historymsg = document.getElementById('target_lang_historymsg'),
        now_translate_object = new Date();
        target_lang_output = document.getElementById('target_lang_output'),
        strDate = "(" + now_translate_object.toLocaleTimeString() + ") ";

    fetch(
        `${window.location.origin}/translate_service?source_lan=${initial_lang}&res_lan=${target_lang}&inputstring=${message}`
    ).then((res) => {
        res.json().then((data) => {
            var translation_result = data.translatedText;
            target_lang_output.value = translation_result;
            var oldContents_translated = target_lang_historymsg.value;
            target_lang_historymsg.value = strDate + translation_result + "\n\n" + oldContents_translated;
            var oldContents = initial_lang_historymsg.value;
            initial_lang_historymsg.value = strDate + message + "\n\n" + oldContents;

        });
    });
}

//语音对象
var speech_object = null;

//窗口重载就会执行的方法
window.onload = function () {
    if (!(window.webkitSpeechRecognition) && !(window.speechRecognition)) {
        //如果浏览器不支持录音功能就会调用这个方法，跳出这句话
        alert('Please use Edge/Chrome/Safari/Firefox for best experience');
    } else {
        var recognizing,
            initial_lang_historymsg = document.getElementById('initial_lang_historymsg'),
            target_lang_historymsg = document.getElementById('target_lang_historymsg'),
            initial_lang_input = document.getElementById('initial_lang_input'),
            target_lang_output = document.getElementById('target_lang_output');
            translate_btn = document.getElementById('button_translate');

        speech_object = new webkitSpeechRecognition() || _speechRecognition();
        speech_object.continuous = true;
        speech_object.interimResults = true;
        


        // 设置录音时间间隔
        // setInterval(function(){ speech_object.stop(); }, 10000);
        speech_object.onresult = function (event) {
            var input_voice = '';
            for (var i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal ) {
                    var now_message_object = new Date();
                    var strDate = "(" + now_message_object.toLocaleTimeString() + ") ";
                    const message = initial_lang_input.value;
                    if(message!=""){
                        fetch(
                            `${window.location.origin}/translate_service?source_lan=${initial_lang}&res_lan=${target_lang}&inputstring=${message}`
                        ).then((res) => {
                            res.json().then((data) => {
                                var translation_result = data.translatedText;
                                target_lang_output.value = translation_result;
                                var oldContents_translated = target_lang_historymsg.value;
                                target_lang_historymsg.value = strDate + translation_result + "\n\n" + oldContents_translated;
                                var oldContents = initial_lang_historymsg.value;
                                initial_lang_historymsg.value = strDate + message + "\n\n" + oldContents;
                            });
                        });
                    }
                    
                } else {
                    input_voice += event.results[i][0].transcript;
                    initial_lang_input.value = input_voice;
                    initial_lang_input.scrollTop = initial_lang_input.scrollHeight;
                    translate_btn.addEventListener('click', function () {
                        const message1 = initial_lang_input.value;
                        initial_lang_input.value = "";
                        if(message1!=""){
                            translateTotarget(message1);
                            speech_object.stop();
                        }
                        
                    },false)
                }
            }
	  
        };
        // 异常处理
        speech_object.onerror = function (event) {
            // Either 'No-speech' or 'Network connection error'
            console.error(event.error);
        };

        //录音是否继续
        speech_object.onend = function () {
            if (continue_record_flag) {
                speech_object.start();
            }
        };
    }
};


